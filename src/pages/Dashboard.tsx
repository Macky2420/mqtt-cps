import { useState, useEffect } from "react";
import {
  DollarSign,
  ShoppingBag,
  CreditCard,
  TrendingUp,
  Plus,
  Trash2,
} from "lucide-react";
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

export function Dashboard() {
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
      setManualIncomes(manuals.slice().sort((a, b) => b.timestamp - a.timestamp));
      setTotalIncome(income);

      setStats({
        totalTransactions: txns.length,
        totalProducts: products.length,
        totalCards: cards.length,
      });
    } catch (error) {
      console.error("Failed to load dashboard:", error);
      alert("Failed to load dashboard data. Check Firebase connection.");
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

    const amount = Number(incomeForm.amount);

    if (isNaN(amount) || amount <= 0) {
      alert("Please enter a valid amount");
      return;
    }

    if (!incomeForm.description.trim()) {
      alert("Please enter a description");
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
      await addManualIncome(newIncome);
      await loadData();
      setShowIncomeModal(false);
    } catch (error) {
      console.error("Failed to add income:", error);
      alert("Failed to add income.");
    }
  };

  const handleDeleteIncome = async (id: string) => {
    if (!confirm("Are you sure you want to delete this income entry?")) return;

    try {
      await deleteManualIncome(id);
      await loadData();
    } catch (error) {
      console.error("Failed to delete income:", error);
      alert("Failed to delete income.");
    }
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

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6">
      <h2 className="font-bold text-gray-900 mb-6">Dashboard</h2>

      {loading ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          Loading dashboard...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Total Income</span>
                <DollarSign className="w-5 h-5 text-green-600" />
              </div>
              <div className="font-bold text-gray-900">
                ₱{totalIncome.toLocaleString()}
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Transactions</span>
                <TrendingUp className="w-5 h-5 text-blue-600" />
              </div>
              <div className="font-bold text-gray-900">
                {stats.totalTransactions}
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Products</span>
                <ShoppingBag className="w-5 h-5 text-purple-600" />
              </div>
              <div className="font-bold text-gray-900">
                {stats.totalProducts}
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">RFID Cards</span>
                <CreditCard className="w-5 h-5 text-orange-600" />
              </div>
              <div className="font-bold text-gray-900">{stats.totalCards}</div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow mb-6">
            <div className="px-6 py-4 border-b border-gray-200 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
              <h3 className="font-medium text-gray-900">Manual Income</h3>

              <button
                onClick={handleAddIncome}
                className="flex items-center justify-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
              >
                <Plus className="w-4 h-4" />
                Add Income
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px]">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">
                      Description
                    </th>
                    <th className="px-6 py-3 text-right text-sm font-medium text-gray-700">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-right text-sm font-medium text-gray-700">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-200">
                  {manualIncomes.map((income) => (
                    <tr key={income.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {formatDate(income.timestamp)}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span
                          className={`inline-block px-2 py-1 rounded text-xs ${
                            income.type === "cash"
                              ? "bg-green-100 text-green-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {income.type === "cash" ? "Cash" : "Other"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {income.description}
                      </td>
                      <td className="px-6 py-4 text-sm text-right font-medium text-green-600">
                        ₱{income.amount.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleDeleteIncome(income.id)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-sm text-red-600 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {manualIncomes.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  No manual income entries yet.
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="font-medium text-gray-900">RFID Transactions</h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px]">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">
                      Card
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">
                      Items
                    </th>
                    <th className="px-6 py-3 text-right text-sm font-medium text-gray-700">
                      Total
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-200">
                  {transactions.map((transaction) => (
                    <tr key={transaction.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {formatDate(transaction.timestamp)}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="text-gray-900">
                          {transaction.cardName}
                        </div>
                        <div className="text-gray-500 text-xs">
                          {transaction.cardNumber}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        <div className="space-y-1">
                          {transaction.items.map((item, idx) => (
                            <div key={idx}>
                              {item.quantity}x {item.productName}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-right font-medium text-gray-900">
                        ₱{transaction.total.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {transactions.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  No transactions yet. Start making sales from the Order page.
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {showIncomeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="font-bold text-gray-900 mb-4">
              Add Manual Income
            </h3>

            <form onSubmit={handleSubmitIncome}>
              <div className="mb-4">
                <label className="block text-sm text-gray-700 mb-2">
                  Amount (₱)
                </label>
                <input
                  type="number"
                  value={incomeForm.amount}
                  onChange={(e) =>
                    setIncomeForm({ ...incomeForm, amount: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  required
                  min="1"
                  step="1"
                  placeholder="100"
                  autoFocus
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm text-gray-700 mb-2">
                  Type
                </label>
                <select
                  value={incomeForm.type}
                  onChange={(e) =>
                    setIncomeForm({
                      ...incomeForm,
                      type: e.target.value as "cash" | "other",
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="cash">Cash</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="mb-6">
                <label className="block text-sm text-gray-700 mb-2">
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  required
                  placeholder="e.g., Cash payment for lunch"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowIncomeModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Add Income
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}