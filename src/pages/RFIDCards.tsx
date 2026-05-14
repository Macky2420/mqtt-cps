import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  CreditCard,
  Loader2,
  Search,
  X,
  AlertTriangle,
  PhilippinePeso,
  User,
  Hash,
} from "lucide-react";
import { Modal, notification } from "antd";
import { getDatabase, ref, onValue } from "firebase/database";
import {
  getCards,
  saveCard,
  deleteCard,
  type RFIDCard,
} from "../utils/storage";

const useNotify = () => {
  const [api, contextHolder] = notification.useNotification();

  const notify = useCallback(
    (
      type: "success" | "error" | "info" | "warning",
      title: string,
      description?: string
    ) => {
      const config = {
        title,
        description,
        placement: "topRight" as const,
      };

      if (type === "success") api.success(config);
      else if (type === "error") api.error(config);
      else if (type === "warning") api.warning(config);
      else api.info(config);
    },
    [api]
  );

  return { notify, contextHolder };
};

export function RFIDCards() {
  const { notify, contextHolder } = useNotify();

  const [cards, setCards] = useState<RFIDCard[]>([]);
  const [filteredCards, setFilteredCards] = useState<RFIDCard[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingCard, setEditingCard] = useState<RFIDCard | null>(null);

  const [formData, setFormData] = useState({
    number: "",
    name: "",
    balance: "",
  });

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // ─── Live balances from Firebase ────────────────────────────
  const [liveBalances, setLiveBalances] = useState<Record<string, number>>({});

  useEffect(() => {
    loadCards();
  }, []);

  useEffect(() => {
    const q = searchQuery.toLowerCase().trim();

    setFilteredCards(
      cards.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.number.toLowerCase().includes(q)
      )
    );
  }, [searchQuery, cards]);

  // ─── Subscribe to live balances for all cards ───────────────
  useEffect(() => {
    if (cards.length === 0) return;

    const db = getDatabase();
    const unsubscribes: (() => void)[] = [];

    cards.forEach((card) => {
      const balanceRef = ref(db, `cards/${card.id}/balance`);
      const unsubscribe = onValue(balanceRef, (snapshot) => {
        const value = snapshot.val();
        setLiveBalances((prev) => ({
          ...prev,
          [card.id]: value ?? card.balance ?? 0,
        }));
      });
      unsubscribes.push(unsubscribe);
    });

    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [cards]);

  const getCardBalance = (card: RFIDCard) => {
    return liveBalances[card.id] ?? card.balance ?? 0;
  };

  const loadCards = async () => {
    try {
      setLoading(true);
      const data = await getCards();
      setCards(data);
      setFilteredCards(data);
    } catch (error) {
      console.error("Failed to load RFID cards:", error);
      notify(
        "error",
        "Failed to load RFID cards",
        "Check your Firebase connection."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingCard(null);
    setFormData({ number: "", name: "", balance: "" });
    setShowModal(true);
  };

  const handleEdit = (card: RFIDCard) => {
    setEditingCard(card);
    setFormData({
      number: card.number,
      name: card.name,
      balance: card.balance.toString(),
    });
    setShowModal(true);
  };

  const handleDelete = (id: string, name: string) => {
    Modal.confirm({
      title: (
        <div className="flex items-center gap-2 text-red-600">
          <AlertTriangle className="w-5 h-5" />
          Delete RFID Card
        </div>
      ),
      content: (
        <p className="text-slate-600">
          Are you sure you want to delete the card for{" "}
          <span className="font-semibold text-slate-900">"{name}"</span>? This
          action cannot be undone.
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
          await deleteCard(id);
          await loadCards();
          notify("success", "RFID card deleted", `"${name}" has been removed.`);
        } catch (error) {
          console.error("Failed to delete RFID card:", error);
          notify("error", "Failed to delete RFID card");
        }
      },
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    const balance = Number(formData.balance);
    const number = formData.number.trim().toUpperCase();
    const name = formData.name.trim();

    if (!number || !name || isNaN(balance) || balance < 0) {
      notify(
        "warning",
        "Invalid card details",
        "Please enter a valid card number, name, and balance."
      );
      return;
    }

    const existingCard = cards.find(
      (c) =>
        c.number.toLowerCase() === number.toLowerCase() &&
        c.id !== editingCard?.id
    );

    if (existingCard) {
      notify(
        "warning",
        "Duplicate card number",
        "A card with this number already exists."
      );
      return;
    }

    const card: RFIDCard = {
      id: editingCard?.id || number,
      number,
      name,
      balance,
    };

    try {
      setSubmitting(true);
      await saveCard(card);
      await loadCards();

      setShowModal(false);
      setEditingCard(null);
      setFormData({ number: "", name: "", balance: "" });

      notify(
        "success",
        editingCard ? "Card updated" : "Card added",
        editingCard
          ? `"${name}" has been updated successfully.`
          : `"${name}" has been added successfully.`
      );
    } catch (error) {
      console.error("Failed to save RFID card:", error);
      notify("error", "Failed to save RFID card");
    } finally {
      setSubmitting(false);
    }
  };

  const closeModal = () => {
    if (submitting) return;
    setShowModal(false);
    setEditingCard(null);
    setFormData({ number: "", name: "", balance: "" });
  };

  const getBalanceColor = (balance: number) => {
    if (balance < 50) return "text-red-600 bg-red-50 border-red-200";
    if (balance < 150) return "text-amber-600 bg-amber-50 border-amber-200";
    return "text-green-600 bg-green-50 border-green-200";
  };

  return (
    <div className="max-w-5xl mx-auto">
      {contextHolder}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-blue-600" />
            RFID Cards
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage student cards — balance updates from customer top-ups
          </p>
        </div>

        <button
          onClick={handleAdd}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 
          text-white font-medium rounded-xl hover:bg-blue-700 
          active:scale-[0.98] transition-all shadow-lg shadow-blue-200"
        >
          <Plus className="w-5 h-5" />
          Add Card
        </button>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />

        <input
          type="text"
          placeholder="Search by name or card number..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-11 pr-10 py-3 bg-white border border-slate-200 rounded-xl
          text-slate-900 placeholder-slate-400
          focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500
          transition-all"
        />

        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 
            text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            Loading RFID cards...
          </div>
        ) : filteredCards.length === 0 ? (
          <div className="text-center py-16 px-4">
            <CreditCard className="w-12 h-12 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">
              {searchQuery ? "No cards match your search" : "No RFID cards yet"}
            </p>
            <p className="text-sm text-slate-400 mt-1">
              {searchQuery
                ? "Try a different search term"
                : 'Click "Add Card" to register a new card'}
            </p>
          </div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Card Details
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Balance from Card
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredCards.map((card) => {
                    const balance = getCardBalance(card);
                    return (
                      <tr
                        key={card.id}
                        className="hover:bg-slate-50/80 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
                              <CreditCard className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                              <div className="font-semibold text-slate-900">
                                {card.name}
                              </div>
                              <div className="text-xs font-mono text-slate-500 mt-0.5">
                                {card.number}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold border ${getBalanceColor(
                              balance
                            )}`}
                          >
                            <PhilippinePeso className="w-3.5 h-3.5" />
                            {balance.toLocaleString()}
                          </span>
                        </td>

                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleEdit(card)}
                              className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 
                              rounded-lg transition-colors"
                              title="Edit"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDelete(card.id, card.name)}
                              className="p-2 text-red-600 bg-red-50 hover:bg-red-100 
                              rounded-lg transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="md:hidden divide-y divide-slate-100">
              {filteredCards.map((card) => {
                const balance = getCardBalance(card);
                return (
                  <div
                    key={card.id}
                    className="p-4 hover:bg-slate-50/80 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
                          <CreditCard className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-slate-900 truncate">
                            {card.name}
                          </h3>
                          <div className="text-xs font-mono text-slate-500 mt-0.5">
                            {card.number}
                          </div>
                          <div className="mt-2">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold border ${getBalanceColor(
                                balance
                              )}`}
                            >
                              <PhilippinePeso className="w-3 h-3" />
                              {balance.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => handleEdit(card)}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 
                        text-sm font-medium text-blue-700 bg-blue-50 
                        hover:bg-blue-100 rounded-xl transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(card.id, card.name)}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 
                        text-sm font-medium text-red-700 bg-red-50 
                        hover:bg-red-100 rounded-xl transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {!loading && cards.length > 0 && (
        <p className="text-xs text-slate-400 mt-4 text-center">
          Showing {filteredCards.length} of {cards.length} card
          {cards.length !== 1 ? "s" : ""}
        </p>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
            onClick={closeModal}
          />

          <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
            <div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md pointer-events-auto
              animate-in fade-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    {editingCard ? "Edit RFID Card" : "Add New RFID Card"}
                  </h3>
                  <p className="text-sm text-slate-500 mt-0.5">
                    {editingCard
                      ? "Update the card details below"
                      : "Register a new student RFID card"}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeModal}
                  disabled={submitting}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 
                  rounded-lg transition-colors disabled:opacity-50"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Card Number / UID
                  </label>
                  <div className="relative">
                    <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={formData.number}
                      onChange={(e) =>
                        setFormData({ ...formData, number: e.target.value })
                      }
                      className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl
                      text-slate-900 placeholder-slate-400 uppercase
                      focus:outline-none focus:ring-2 focus:ring-blue-500/20 
                      focus:border-blue-500 transition-all"
                      placeholder="257B78E0"
                      required
                      autoFocus
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Student Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl
                      text-slate-900 placeholder-slate-400
                      focus:outline-none focus:ring-2 focus:ring-blue-500/20 
                      focus:border-blue-500 transition-all"
                      placeholder="Juan Dela Cruz"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Initial Balance (₱)
                  </label>
                  <div className="relative">
                    <PhilippinePeso className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="number"
                      value={formData.balance}
                      onChange={(e) =>
                        setFormData({ ...formData, balance: e.target.value })
                      }
                      className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl
                      text-slate-900 placeholder-slate-400
                      focus:outline-none focus:ring-2 focus:ring-blue-500/20 
                      focus:border-blue-500 transition-all"
                      placeholder="100"
                      min="0"
                      step="1"
                      required
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeModal}
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
                    className="flex-1 px-4 py-2.5 bg-blue-600 text-white font-medium
                    rounded-xl hover:bg-blue-700 active:scale-[0.98]
                    disabled:opacity-60 disabled:cursor-not-allowed
                    transition-all flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>{editingCard ? "Update" : "Add"} Card</>
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