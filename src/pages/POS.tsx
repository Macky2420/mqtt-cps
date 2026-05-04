import { useState, useEffect } from "react";
import { Plus, Minus, Trash2, CreditCard } from "lucide-react";
import {
  getProducts,
  findCardByNumber,
  updateCardBalance,
  addTransaction,
  type Product,
  type Transaction,
} from "../utils/storage";

interface CartItem {
  product: Product;
  quantity: number;
}

export function POS() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [rfidInput, setRfidInput] = useState("");
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<
    "idle" | "processing" | "success" | "error"
  >("idle");
  const [paymentMessage, setPaymentMessage] = useState("");
  const [loadingProducts, setLoadingProducts] = useState(true);

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const data = await getProducts();
        setProducts(data);
      } catch (error) {
        console.error("Failed to load products:", error);
      } finally {
        setLoadingProducts(false);
      }
    };

    loadProducts();
  }, []);

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);

      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.product.id === productId
            ? { ...item, quantity: item.quantity + delta }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const getTotal = () => {
    return cart.reduce(
      (sum, item) => sum + item.product.price * item.quantity,
      0
    );
  };

  const handlePayment = () => {
    if (cart.length === 0) {
      setPaymentMessage("Cart is empty!");
      setPaymentStatus("error");
      return;
    }

    setShowPaymentModal(true);
    setPaymentStatus("idle");
    setPaymentMessage("");
    setRfidInput("");
  };

  const processPayment = async () => {
    if (!rfidInput.trim()) {
      setPaymentMessage("Please enter RFID card number");
      setPaymentStatus("error");
      return;
    }

    try {
      setPaymentStatus("processing");
      setPaymentMessage("Processing...");

      const card = await findCardByNumber(rfidInput.trim());

      if (!card) {
        setPaymentStatus("error");
        setPaymentMessage("RFID card not found!");
        return;
      }

      const total = getTotal();

      if (card.balance < total) {
        setPaymentStatus("error");
        setPaymentMessage(
          `Insufficient balance! Available: ₱${card.balance.toLocaleString()}`
        );
        return;
      }

      const newBalance = card.balance - total;

      await updateCardBalance(card.id, newBalance);

      const transaction: Transaction = {
        id: Date.now().toString(),
        timestamp: Date.now(),
        items: cart.map((item) => ({
          productId: item.product.id,
          productName: item.product.name,
          price: item.product.price,
          quantity: item.quantity,
        })),
        total,
        cardNumber: card.number,
        cardName: card.name,
      };

      await addTransaction(transaction);

      setPaymentStatus("success");
      setPaymentMessage(
        `Payment successful! Remaining balance: ₱${newBalance.toLocaleString()}`
      );

      setTimeout(() => {
        setCart([]);
        setShowPaymentModal(false);
        setPaymentStatus("idle");
        setRfidInput("");
      }, 2000);
    } catch (error) {
      console.error("Payment failed:", error);
      setPaymentStatus("error");
      setPaymentMessage("Payment failed. Check Firebase connection.");
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <h2 className="font-bold text-gray-900 mb-4">Products</h2>

          {loadingProducts ? (
            <p className="text-gray-500">Loading products...</p>
          ) : products.length === 0 ? (
            <div className="bg-white border border-dashed border-gray-300 rounded-lg p-6 text-center text-gray-500">
              No products found. Add products in Firebase first.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {products.map((product) => (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  className="bg-white p-4 rounded-lg shadow hover:shadow-md transition-shadow border border-gray-200 text-left"
                >
                  <div className="font-medium text-gray-900 mb-1">
                    {product.name}
                  </div>
                  <div className="text-sm text-gray-600">
                    ₱{product.price.toLocaleString()}
                  </div>
                  {product.category && (
                    <div className="text-xs text-gray-500 mt-1">
                      {product.category}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-1">
          <div className="bg-white p-4 sm:p-6 rounded-lg shadow lg:sticky lg:top-6">
            <h2 className="font-bold text-gray-900 mb-4">Cart</h2>

            {cart.length === 0 ? (
              <p className="text-gray-500 text-center py-8">Cart is empty</p>
            ) : (
              <>
                <div className="space-y-3 mb-4">
                  {cart.map((item) => (
                    <div
                      key={item.product.id}
                      className="flex items-center gap-2 p-2 bg-gray-50 rounded"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-gray-900 truncate">
                          {item.product.name}
                        </div>
                        <div className="text-xs text-gray-600">
                          ₱{item.product.price.toLocaleString()}
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => updateQuantity(item.product.id, -1)}
                          className="p-1 hover:bg-gray-200 rounded"
                        >
                          <Minus className="w-4 h-4" />
                        </button>

                        <span className="w-8 text-center text-sm">
                          {item.quantity}
                        </span>

                        <button
                          onClick={() => updateQuantity(item.product.id, 1)}
                          className="p-1 hover:bg-gray-200 rounded"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>

                      <button
                        onClick={() => removeFromCart(item.product.id)}
                        className="p-1 hover:bg-red-100 text-red-600 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="border-t pt-4">
                  <div className="flex justify-between items-center mb-4">
                    <span className="font-bold text-gray-900">Total</span>
                    <span className="font-bold text-gray-900">
                      ₱{getTotal().toLocaleString()}
                    </span>
                  </div>

                  <button
                    onClick={handlePayment}
                    className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <CreditCard className="w-5 h-5" />
                    Pay with RFID
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="font-bold text-gray-900 mb-4">RFID Payment</h3>

            <div className="mb-4">
              <div className="text-sm text-gray-600 mb-2">Total Amount:</div>
              <div className="font-bold text-gray-900">
                ₱{getTotal().toLocaleString()}
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm text-gray-700 mb-2">
                Tap or Enter RFID Card Number:
              </label>
              <input
                type="text"
                value={rfidInput}
                onChange={(e) => setRfidInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && processPayment()}
                placeholder="257B78E0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={
                  paymentStatus === "processing" || paymentStatus === "success"
                }
                autoFocus
              />
            </div>

            {paymentMessage && (
              <div
                className={`mb-4 p-3 rounded-lg ${
                  paymentStatus === "success"
                    ? "bg-green-50 text-green-800"
                    : paymentStatus === "error"
                    ? "bg-red-50 text-red-800"
                    : "bg-blue-50 text-blue-800"
                }`}
              >
                {paymentMessage}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowPaymentModal(false);
                  setPaymentStatus("idle");
                  setRfidInput("");
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                disabled={
                  paymentStatus === "processing" || paymentStatus === "success"
                }
              >
                Cancel
              </button>

              <button
                onClick={processPayment}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                disabled={
                  paymentStatus === "processing" || paymentStatus === "success"
                }
              >
                {paymentStatus === "processing" ? "Processing..." : "Pay"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}