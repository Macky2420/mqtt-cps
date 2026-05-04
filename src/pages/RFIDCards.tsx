import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Wallet } from "lucide-react";
import {
  getCards,
  saveCard,
  deleteCard,
  topUpCardBalance,
  type RFIDCard,
} from "../utils/storage";

export function RFIDCards() {
  const [cards, setCards] = useState<RFIDCard[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [editingCard, setEditingCard] = useState<RFIDCard | null>(null);
  const [topUpCard, setTopUpCard] = useState<RFIDCard | null>(null);
  const [formData, setFormData] = useState({
    number: "",
    name: "",
    balance: "",
  });
  const [topUpAmount, setTopUpAmount] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCards();
  }, []);

  const loadCards = async () => {
    try {
      setLoading(true);
      const data = await getCards();
      setCards(data);
    } catch (error) {
      console.error("Failed to load RFID cards:", error);
      alert("Failed to load RFID cards. Check Firebase connection.");
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

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this RFID card?")) return;

    try {
      await deleteCard(id);
      await loadCards();
    } catch (error) {
      console.error("Failed to delete RFID card:", error);
      alert("Failed to delete RFID card.");
    }
  };

  const handleTopUp = (card: RFIDCard) => {
    setTopUpCard(card);
    setTopUpAmount("");
    setShowTopUpModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const balance = Number(formData.balance);
    const number = formData.number.trim().toUpperCase();
    const name = formData.name.trim();

    if (!number || !name || isNaN(balance) || balance < 0) {
      alert("Please enter valid card details");
      return;
    }

    const existingCard = cards.find(
      (c) => c.number.toLowerCase() === number.toLowerCase() && c.id !== editingCard?.id
    );

    if (existingCard) {
      alert("A card with this number already exists!");
      return;
    }

    const card: RFIDCard = {
      id: editingCard?.id || number,
      number,
      name,
      balance,
    };

    try {
      await saveCard(card);
      await loadCards();
      setShowModal(false);
      setEditingCard(null);
      setFormData({ number: "", name: "", balance: "" });
    } catch (error) {
      console.error("Failed to save RFID card:", error);
      alert("Failed to save RFID card.");
    }
  };

  const handleTopUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!topUpCard) return;

    const amount = Number(topUpAmount);

    if (isNaN(amount) || amount <= 0) {
      alert("Please enter a valid amount");
      return;
    }

    const newBalance = topUpCard.balance + amount;

    try {
      await topUpCardBalance(topUpCard.id, newBalance);
      await loadCards();
      setShowTopUpModal(false);
      setTopUpCard(null);
      setTopUpAmount("");
    } catch (error) {
      console.error("Failed to top up balance:", error);
      alert("Failed to top up balance.");
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
        <h2 className="font-bold text-gray-900">RFID Card Management</h2>

        <button
          onClick={handleAdd}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-5 h-5" />
          Add RFID Card
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-gray-500">
            Loading RFID cards...
          </div>
        ) : cards.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No RFID cards yet. Click "Add RFID Card" to get started.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">
                    Card Number
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">
                    Balance
                  </th>
                  <th className="px-6 py-3 text-right text-sm font-medium text-gray-700">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-200">
                {cards.map((card) => (
                  <tr key={card.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {card.number}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {card.name}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`font-medium ${
                          card.balance < 50 ? "text-red-600" : "text-green-600"
                        }`}
                      >
                        ₱{card.balance.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <button
                        onClick={() => handleTopUp(card)}
                        className="inline-flex items-center gap-1 px-3 py-1 text-sm text-green-600 hover:bg-green-50 rounded mr-2"
                      >
                        <Wallet className="w-4 h-4" />
                        Top Up
                      </button>

                      <button
                        onClick={() => handleEdit(card)}
                        className="inline-flex items-center gap-1 px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded mr-2"
                      >
                        <Pencil className="w-4 h-4" />
                        Edit
                      </button>

                      <button
                        onClick={() => handleDelete(card.id)}
                        className="inline-flex items-center gap-1 px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="font-bold text-gray-900 mb-4">
              {editingCard ? "Edit RFID Card" : "Add New RFID Card"}
            </h3>

            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm text-gray-700 mb-2">
                  Card Number / UID
                </label>
                <input
                  type="text"
                  value={formData.number}
                  onChange={(e) =>
                    setFormData({ ...formData, number: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="257B78E0"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm text-gray-700 mb-2">
                  Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Student Name"
                  required
                />
              </div>

              <div className="mb-6">
                <label className="block text-sm text-gray-700 mb-2">
                  Initial Balance (₱)
                </label>
                <input
                  type="number"
                  value={formData.balance}
                  onChange={(e) =>
                    setFormData({ ...formData, balance: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                  min="0"
                  step="1"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingCard(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingCard ? "Update" : "Add"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showTopUpModal && topUpCard && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="font-bold text-gray-900 mb-4">Top Up Balance</h3>

            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">
                Card: {topUpCard.number}
              </div>
              <div className="text-sm text-gray-600 mb-1">
                Name: {topUpCard.name}
              </div>
              <div className="font-medium text-gray-900">
                Current Balance: ₱{topUpCard.balance.toLocaleString()}
              </div>
            </div>

            <form onSubmit={handleTopUpSubmit}>
              <div className="mb-6">
                <label className="block text-sm text-gray-700 mb-2">
                  Top Up Amount (₱)
                </label>
                <input
                  type="number"
                  value={topUpAmount}
                  onChange={(e) => setTopUpAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                  min="1"
                  step="1"
                  placeholder="100"
                  autoFocus
                />
              </div>

              {topUpAmount && !isNaN(Number(topUpAmount)) && (
                <div className="mb-4 p-3 bg-green-50 text-green-800 rounded-lg">
                  New Balance: ₱
                  {(topUpCard.balance + Number(topUpAmount)).toLocaleString()}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowTopUpModal(false);
                    setTopUpCard(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Top Up
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}