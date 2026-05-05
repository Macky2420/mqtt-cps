import { useState, useEffect, useCallback } from "react";
import {
  DollarSign,
  ShoppingBag,
  CreditCard,
  TrendingUp,
  Plus,
  Trash2,
  Loader2,
  Wallet,
  Receipt,
  Calendar,
  PhilippinePeso,
  X,
  AlertTriangle,
  Banknote,
  ArrowUpRight,
  Package,
  Users,
  Clock,
} from "lucide-react";
import { Modal, notification } from "antd";
import {
  getTransactions,
  getProducts,
  getCards,
  getTotalIncome,
  getManualIncome,
  addManualIncome,
  deleteManualIncome,
  type Transaction,
  type ManualIncome,
} from "../utils/storage";

// ─── Reusable Ant Design Notification Hook ───
const useNotify = () => {
  const [api, contextHolder] = notification.useNotification();

  const notify = useCallback(
    (
      type: "success" | "error" | "info" | "warning",
      title: string,
      description?: string
    ) => {
      setTimeout(() => {
        const config = {
          message: title,
          description,
          placement: "topRight" as const,
        };

        if (type === "success") api.success(config);
        else if (type === "error") api.error(config);
        else if (type === "warning") api.warning(config);
        else api.info(config);
      }, 0);
    },
    [api]
  );

  return { notify, contextHolder };
};

export function Dashboard() {
  const { notify, contextHolder } = useNotify();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [manualIncomes, setManualIncomes] = useState<ManualIncome[]>([]);
  const [totalIncome, setTotalIncome] = useState(0);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalTransactions: 0,
    totalProducts: 0,
    totalCards: 0,
  });
  const [showIncomeModal, setShowIncomeModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [incomeForm, setIncomeForm] = useState({
    amount: "",
    description: "",
    type: "cash" as "cash" | "other",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      const [txns, manuals, income, products, cards] = await Promise.all([
        getTransactions(),
        getManualIncome(),
        getTotalIncome(),
        getProducts(),
        getCards(),
      ]);

      setTransactions(txns.slice().sort((a, b) => b.timestamp - a.timestamp));
      setManualIncomes(
        manuals.slice().sort((a, b) => b.timestamp - a.timestamp)
      );
      setTotalIncome(income);

      setStats({
        totalTransactions: txns.length,
        totalProducts: products.length,
        totalCards: cards.length,
      });
    } catch (error) {
      console.error("Failed to load dashboard:", error);
      notify(
        "error",
        "Failed to load dashboard",
        "Check your Firebase connection."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleAddIncome = () => {
    setIncomeForm({ amount: "", description: "", type: "cash" });
    setShowIncomeModal(true);
  };

  const handleSubmitIncome = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    const amount = Number(incomeForm.amount);

    if (isNaN(amount) || amount <= 0) {
      notify("warning", "Invalid amount", "Please enter a valid amount greater than 0.");
      return;
    }

    if (!incomeForm.description.trim()) {
      notify("warning", "Missing description", "Please enter a description for this income.");
      return;
    }

    const newIncome: ManualIncome = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      amount,
      description: incomeForm.description.trim(),
      type: incomeForm.type,
    };

    try {
      setSubmitting(true);
      await addManualIncome(newIncome);
      await loadData();
      setShowIncomeModal(false);
      setIncomeForm({ amount: "", description: "", type: "cash" });

      notify(
        "success",
        "Income added",
        `₱${amount.toLocaleString()} added to manual income.`
      );
    } catch (error) {
      console.error("Failed to add income:", error);
      notify("error", "Failed to add income");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteIncome = (id: string, description: string) => {
    Modal.confirm({
      title: (
        <div className="flex items-center gap-2 text-red-600">
          <AlertTriangle className="w-5 h-5" />
          Delete Income Entry
        </div>
      ),
      content: (
        <p className="text-slate-600">
          Are you sure you want to delete the income entry{" "}
          <span className="font-semibold text-slate-900">"{description}"</span>
          ? This action cannot be undone.
        </p>
      ),
      okText: "Delete",
      cancelText: "Cancel",
      okType: "danger",
      okButtonProps: {
        className: "bg-red-600 hover:bg-red-700",
      },
      onOk: async () => {
        try {
          await deleteManualIncome(id);
          await loadData();
          notify("success", "Income deleted", `"${description}" has been removed.`);
        } catch (error) {
          console.error("Failed to delete income:", error);
          notify("error", "Failed to delete income");
        }
      },
    });
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatRelativeTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return formatDate(timestamp);
  };

  const statCards = [
    {
      label: "Total Income",
      value: `₱${totalIncome.toLocaleString()}`,
      icon: Wallet,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      border: "border-emerald-200",
    },
    {
      label: "Transactions",
      value: stats.totalTransactions.toLocaleString(),
      icon: Receipt,
      color: "text-blue-600",
      bg: "bg-blue-50",
      border: "border-blue-200",
    },
    {
      label: "Products",
      value: stats.totalProducts.toLocaleString(),
      icon: Package,
      color: "text-violet-600",
      bg: "bg-violet-50",
      border: "border-violet-200",
    },
    {
      label: "RFID Cards",
      value: stats.totalCards.toLocaleString(),
      icon: Users,
      color: "text-amber-600",
      bg: "bg-amber-50",
      border: "border-amber-200",
    },
  ];

  return (
    <div className="max-w-7xl mx-auto">
      {contextHolder}

      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-blue-600" />
            Dashboard
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Overview of your canteen operations
          </p>
        </div>

        <button
          onClick={handleAddIncome}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 
                   text-white font-medium rounded-xl hover:bg-emerald-700 
                   active:scale-[0.98] transition-all shadow-lg shadow-emerald-200"
        >
          <Plus className="w-5 h-5" />
          Add Income
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          Loading dashboard...
        </div>
      ) : (
        <>
          {/* ─── Stats Grid ─── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
            {statCards.map((stat) => (
              <div
                key={stat.label}
                className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm
                         hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs sm:text-sm font-medium text-slate-500">
                    {stat.label}
                  </span>
                  <div
                    className={`p-2 rounded-xl ${stat.bg} ${stat.border} border`}
                  >
                    <stat.icon className={`w-4 h-4 sm:w-5 sm:h-5 ${stat.color}`} />
                  </div>
                </div>
                <div className="text-xl sm:text-2xl font-bold text-slate-900">
                  {stat.value}
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* ─── Manual Income ─── */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 sm:px-6 py-4 sm:py-5 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Banknote className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-semibold text-slate-900">Manual Income</h3>
                </div>
                <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md">
                  {manualIncomes.length} entries
                </span>
              </div>

              {manualIncomes.length === 0 ? (
                <div className="text-center py-12 sm:py-16 px-4">
                  <Banknote className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                  <p className="text-slate-500 font-medium">
                    No manual income entries yet
                  </p>
                  <p className="text-sm text-slate-400 mt-1">
                    Click "Add Income" to record cash or other income
                  </p>
                </div>
              ) : (
                <>
                  {/* Desktop Table */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            Date
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            Type
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            Description
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            Amount
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {manualIncomes.map((income) => (
                          <tr
                            key={income.id}
                            className="hover:bg-slate-50/80 transition-colors group"
                          >
                            <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap">
                              {formatDate(income.timestamp)}
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium ${
                                  income.type === "cash"
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : "bg-blue-50 text-blue-700 border border-blue-200"
                                }`}
                              >
                                {income.type === "cash" ? (
                                  <Banknote className="w-3 h-3" />
                                ) : (
                                  <DollarSign className="w-3 h-3" />
                                )}
                                {income.type === "cash" ? "Cash" : "Other"}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-900 max-w-[200px] truncate">
                              {income.description}
                            </td>
                            <td className="px-6 py-4 text-sm text-right font-semibold text-emerald-700">
                              ₱{income.amount.toLocaleString()}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button
                                type="button"
                                onClick={() =>
                                  handleDeleteIncome(income.id, income.description)
                                }
                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 
                                         rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Cards */}
                  <div className="sm:hidden divide-y divide-slate-100">
                    {manualIncomes.map((income) => (
                      <div
                        key={income.id}
                        className="p-4 hover:bg-slate-50/80 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium ${
                                  income.type === "cash"
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : "bg-blue-50 text-blue-700 border border-blue-200"
                                }`}
                              >
                                {income.type === "cash" ? "Cash" : "Other"}
                              </span>
                              <span className="text-xs text-slate-400">
                                {formatRelativeTime(income.timestamp)}
                              </span>
                            </div>
                            <p className="text-sm font-medium text-slate-900 truncate">
                              {income.description}
                            </p>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {formatDate(income.timestamp)}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-sm font-bold text-emerald-700">
                              ₱{income.amount.toLocaleString()}
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                handleDeleteIncome(income.id, income.description)
                              }
                              className="mt-2 p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 
                                       rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* ─── RFID Transactions ─── */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 sm:px-6 py-4 sm:py-5 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-blue-600" />
                  <h3 className="font-semibold text-slate-900">
                    RFID Transactions
                  </h3>
                </div>
                <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md">
                  {transactions.length} records
                </span>
              </div>

              {transactions.length === 0 ? (
                <div className="text-center py-12 sm:py-16 px-4">
                  <Receipt className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                  <p className="text-slate-500 font-medium">
                    No transactions yet
                  </p>
                  <p className="text-sm text-slate-400 mt-1">
                    Start making sales from the Order page
                  </p>
                </div>
              ) : (
                <>
                  {/* Desktop Table */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            Date
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            Card
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            Items
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            Total
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {transactions.map((transaction) => (
                          <tr
                            key={transaction.id}
                            className="hover:bg-slate-50/80 transition-colors"
                          >
                            <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap">
                              {formatDate(transaction.timestamp)}
                            </td>
                            <td className="px-6 py-4">
                              <div className="font-medium text-slate-900">
                                {transaction.cardName}
                              </div>
                              <div className="text-xs font-mono text-slate-500 mt-0.5">
                                {transaction.cardNumber}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-600">
                              <div className="space-y-1">
                                {transaction.items.map((item, idx) => (
                                  <div key={idx} className="flex items-center gap-1.5">
                                    <span className="text-xs font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                      {item.quantity}x
                                    </span>
                                    <span className="truncate max-w-[150px]">
                                      {item.productName}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-right font-bold text-slate-900">
                              ₱{transaction.total.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Cards */}
                  <div className="sm:hidden divide-y divide-slate-100">
                    {transactions.map((transaction) => (
                      <div
                        key={transaction.id}
                        className="p-4 hover:bg-slate-50/80 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div>
                            <div className="font-semibold text-slate-900">
                              {transaction.cardName}
                            </div>
                            <div className="text-xs font-mono text-slate-500">
                              {transaction.cardNumber}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-lg font-bold text-slate-900 flex items-center justify-end gap-0.5">
                              <PhilippinePeso className="w-4 h-4" />
                              {transaction.total.toLocaleString()}
                            </div>
                            <div className="text-xs text-slate-400 mt-0.5 flex items-center justify-end gap-1">
                              <Clock className="w-3 h-3" />
                              {formatRelativeTime(transaction.timestamp)}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {transaction.items.map((item, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1 text-xs bg-slate-100 
                                       text-slate-700 px-2 py-1 rounded-md"
                            >
                              <span className="font-bold text-slate-500">
                                {item.quantity}x
                              </span>
                              {item.productName}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* ─── Add Income Modal ─── */}
      {showIncomeModal && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
            onClick={() => !submitting && setShowIncomeModal(false)}
          />

          <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
            <div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md pointer-events-auto
                       animate-in fade-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <ArrowUpRight className="w-5 h-5 text-emerald-600" />
                    Add Manual Income
                  </h3>
                  <p className="text-sm text-slate-500 mt-0.5">
                    Record cash or other income
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowIncomeModal(false)}
                  disabled={submitting}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 
                           rounded-lg transition-colors disabled:opacity-50"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmitIncome} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Amount (₱)
                    </label>
                    <div className="relative">
                      <PhilippinePeso className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="number"
                        value={incomeForm.amount}
                        onChange={(e) =>
                          setIncomeForm({ ...incomeForm, amount: e.target.value })
                        }
                        className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl
                                 text-slate-900 placeholder-slate-400
                                 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 
                                 focus:border-emerald-500 transition-all"
                        placeholder="100"
                        min="1"
                        step="1"
                        required
                        autoFocus
                      />
                    </div>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Type
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          setIncomeForm({ ...incomeForm, type: "cash" })
                        }
                        className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 
                                 font-medium text-sm transition-all ${
                                   incomeForm.type === "cash"
                                     ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                                     : "border-slate-200 text-slate-600 hover:border-slate-300"
                                 }`}
                      >
                        <Banknote className="w-4 h-4" />
                        Cash
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setIncomeForm({ ...incomeForm, type: "other" })
                        }
                        className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 
                                 font-medium text-sm transition-all ${
                                   incomeForm.type === "other"
                                     ? "border-blue-500 bg-blue-50 text-blue-700"
                                     : "border-slate-200 text-slate-600 hover:border-slate-300"
                                 }`}
                      >
                        <DollarSign className="w-4 h-4" />
                        Other
                      </button>
                    </div>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Description
                    </label>
                    <input
                      type="text"
                      value={incomeForm.description}
                      onChange={(e) =>
                        setIncomeForm({
                          ...incomeForm,
                          description: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl
                               text-slate-900 placeholder-slate-400
                               focus:outline-none focus:ring-2 focus:ring-emerald-500/20 
                               focus:border-emerald-500 transition-all"
                      placeholder="e.g., Cash payment for lunch"
                      required
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowIncomeModal(false)}
                    disabled={submitting}
                    className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl
                             font-medium text-slate-700 hover:bg-slate-50 
                             transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 px-4 py-2.5 bg-emerald-600 text-white font-medium
                             rounded-xl hover:bg-emerald-700 active:scale-[0.98]
                             disabled:opacity-60 disabled:cursor-not-allowed
                             transition-all flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        Add Income
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}