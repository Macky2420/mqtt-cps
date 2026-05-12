import { useState, useEffect, useRef, useCallback } from "react";
import { useOutletContext } from "react-router";
import {
  Plus,
  Minus,
  Trash2,
  CreditCard,
  Wifi,
  WifiOff,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Info,
  ShoppingBag,
  QrCode,
  Shield,
  Wallet,
} from "lucide-react";
import { notification } from "antd";
import type { NotificationArgsProps } from "antd";
import type { RootOutletContext } from "../layout/Root";

import {
  getProducts,
  findCardByNumber,
  updateCardBalance,
  addTransaction,
  saveCard,
  getAllCards,
  type Product,
  type Transaction,
  type RFIDCard,
} from "../utils/storage";

import { TopUpModal } from "../components/TopUpModal";

interface CartItem {
  product: Product;
  quantity: number;
}

type NotifyType = "success" | "error" | "info";

const useNotify = () => {
  const [api, contextHolder] = notification.useNotification();

  const notify = useCallback(
    (type: NotifyType, title: string, description?: string) => {
      const config: NotificationArgsProps = {
        title,
        description,
        placement: "topRight",
        duration: type === "error" ? 5 : 3,
      };

      if (type === "success") api.success(config);
      else if (type === "error") api.error(config);
      else api.info(config);
    },
    [api]
  );

  return { notify, contextHolder };
};

export function POS() {
  const { notify, contextHolder } = useNotify();

  const { mqttStatus, lastRFID, publishLCD, setRFIDHandler, currentUser } =
    useOutletContext<RootOutletContext>();

  const isAdmin = currentUser?.role === "admin";

  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showAddCardModal, setShowAddCardModal] = useState(false);

  // ─── Top-Up State ───────────────────────────────────────────
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [selectedTopUpCard, setSelectedTopUpCard] = useState<RFIDCard | null>(null);
  const [loadingCards, setLoadingCards] = useState(false);
  const [myCard, setMyCard] = useState<RFIDCard | null>(null);

  const [paymentStatus, setPaymentStatus] = useState<
    "idle" | "waiting" | "processing" | "success" | "error"
  >("idle");

  const [paymentMessage, setPaymentMessage] = useState("");
  const [loadingProducts, setLoadingProducts] = useState(true);

  const [unknownUID, setUnknownUID] = useState("");
  const [newCardName, setNewCardName] = useState("");
  const [newCardBalance, setNewCardBalance] = useState("");

  const cartRef = useRef<CartItem[]>([]);
  const waitingForRFIDRef = useRef(false);
  const processingRef = useRef(false);

  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

  useEffect(() => {
    let mounted = true;

    const loadProducts = async () => {
      try {
        const data = await getProducts();
        if (mounted) setProducts(data);
      } catch (error) {
        console.error("Failed to load products:", error);
        notify(
          "error",
          "Failed to load products",
          "Check your Firebase connection."
        );
      } finally {
        if (mounted) setLoadingProducts(false);
      }
    };

    loadProducts();

    return () => {
      mounted = false;
    };
  }, [notify]);

  // ─── Load user's own card ───────────────────────────────────
  const loadMyCard = async () => {
    if (!currentUser || isAdmin) return;

    try {
      setLoadingCards(true);
      const cards = await getAllCards();
      // Find card that belongs to current user
      const ownedCard = cards.find((c) => c.userId === currentUser.uid);
      setMyCard(ownedCard || null);
    } catch (error) {
      console.error("Failed to load card:", error);
    } finally {
      setLoadingCards(false);
    }
  };

  useEffect(() => {
    if (currentUser && !isAdmin) {
      loadMyCard();
    }
  }, [currentUser, isAdmin]);

  useEffect(() => {
    setRFIDHandler(async (uid: string) => {
      if (!waitingForRFIDRef.current) {
        setPaymentMessage("RFID detected, but no active payment.");
        notify(
          "info",
          "RFID Detected",
          "No active payment. Click Pay with RFID first."
        );
        return;
      }

      if (processingRef.current) return;

      await processPayment(uid);
    });

    return () => {
      setRFIDHandler(null);
    };
  }, [setRFIDHandler]);

  const addToCart = (product: Product) => {
    if (isAdmin) {
      notify(
        "info",
        "Admin Access",
        "Admins cannot add items to cart. Only normal users can make purchases."
      );
      return;
    }

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
    return cartRef.current.reduce(
      (sum, item) => sum + item.product.price * item.quantity,
      0
    );
  };

  const handlePayment = () => {
    if (isAdmin) {
      notify(
        "error",
        "Admin Restriction",
        "Admins cannot process payments. Only normal users can pay with RFID."
      );
      return;
    }

    if (cartRef.current.length === 0) {
      setPaymentMessage("Cart is empty!");
      setPaymentStatus("error");
      notify("error", "Cart is Empty", "Add products before payment.");
      return;
    }

    if (mqttStatus !== "Connected") {
      notify("error", "MQTT Disconnected", "RFID reader is not connected.");
      return;
    }

    waitingForRFIDRef.current = true;
    processingRef.current = false;

    setShowPaymentModal(true);
    setPaymentStatus("waiting");
    setPaymentMessage("Waiting for RFID tap...");
    publishLCD("READY | Tap RFID");

    notify("info", "Waiting for RFID", "Tap the card on the RFID reader.");
  };

  const processPayment = async (uid: string) => {
    try {
      processingRef.current = true;
      waitingForRFIDRef.current = false;

      setPaymentStatus("processing");
      setPaymentMessage(`Processing card ${uid}...`);

      const card = await findCardByNumber(uid);

      if (!card) {
        publishLCD("UNKNOWN | Add Card");

        setUnknownUID(uid);
        setNewCardName("");
        setNewCardBalance("");

        setShowPaymentModal(false);
        setShowAddCardModal(true);

        setPaymentStatus("error");
        setPaymentMessage("Unknown RFID card. Add this card first.");

        notify("error", "Unknown RFID Card", `UID ${uid} is not registered.`);
        processingRef.current = false;
        return;
      }

      const total = getTotal();

      if (card.balance < total) {
        publishLCD("FAILED | No Balance");

        setPaymentStatus("error");
        setPaymentMessage(
          `Insufficient balance! Available: ₱${card.balance.toLocaleString()}`
        );

        notify(
          "error",
          "Insufficient Balance",
          `Available: ₱${card.balance.toLocaleString()}`
        );

        processingRef.current = false;
        return;
      }

      const newBalance = card.balance - total;
      await updateCardBalance(card.id, newBalance);

      const transaction: Transaction = {
        id: Date.now().toString(),
        timestamp: Date.now(),
        items: cartRef.current.map((item) => ({
          productId: item.product.id,
          productName: item.product.name,
          price: item.product.price,
          quantity: item.quantity,
        })),
        total,
        cardNumber: card.number,
        cardName: card.name,
        type: "purchase",
      };

      await addTransaction(transaction);

      publishLCD(`SUCCESS | Bal:${newBalance}`);

      setPaymentStatus("success");
      setPaymentMessage(
        `Payment successful! Remaining balance: ₱${newBalance.toLocaleString()}`
      );

      notify(
        "success",
        "Payment Successful",
        `${card.name} — Remaining: ₱${newBalance.toLocaleString()}`
      );

      setTimeout(() => {
        setCart([]);
        setShowPaymentModal(false);
        setPaymentStatus("idle");
        setPaymentMessage("");
        processingRef.current = false;
      }, 2000);
    } catch (error) {
      console.error("Payment failed:", error);
      publishLCD("FAILED | Error");

      setPaymentStatus("error");
      setPaymentMessage("Payment failed. Check Firebase or MQTT connection.");
      notify("error", "Payment Failed", "Check Firebase or MQTT connection.");
      processingRef.current = false;
    }
  };

  const handleAddUnknownCard = async (e: React.FormEvent) => {
    e.preventDefault();

    const name = newCardName.trim();
    const balance = Number(newCardBalance);

    if (!unknownUID || !name || isNaN(balance) || balance < 0) {
      notify("error", "Invalid Card Details", "Enter a valid name and balance.");
      return;
    }

    const newCard: RFIDCard = {
      id: unknownUID,
      number: unknownUID,
      name,
      balance,
      userId: currentUser?.uid,
      userEmail: currentUser?.email,
    };

    try {
      await saveCard(newCard);
      publishLCD("CARD ADDED | Ready");

      setShowAddCardModal(false);
      setUnknownUID("");
      setNewCardName("");
      setNewCardBalance("");
      setPaymentStatus("idle");
      setPaymentMessage("RFID card added. Press Pay with RFID again.");

      notify(
        "success",
        "RFID Card Added",
        "Press Pay with RFID again to continue payment."
      );
    } catch (error) {
      console.error("Failed to add RFID card:", error);
      notify("error", "Failed to Add Card", "Check Firebase connection.");
    }
  };

  const cancelPayment = () => {
    waitingForRFIDRef.current = false;
    processingRef.current = false;

    setShowPaymentModal(false);
    setPaymentStatus("idle");
    setPaymentMessage("");

    publishLCD("CANCELLED | Scan Card");
    notify("info", "Payment Cancelled");
  };

  // ─── Top-Up Handlers ────────────────────────────────────────
  const handleOpenTopUp = () => {
    if (isAdmin) {
      notify("error", "Access Denied", "Admins cannot top up. Only card owners can add funds to their own account.");
      return;
    }
    if (!myCard) {
      notify("error", "No Card Found", "You don't have a registered RFID card. Please register first.");
      return;
    }
    setSelectedTopUpCard(myCard);
    setShowTopUpModal(true);
  };

  const handleTopUpComplete = () => {
    loadMyCard(); // Refresh card data
  };

  const cartTotal = cart.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );

  const statusConfig = {
    idle: { icon: null, color: "", label: "" },
    waiting: {
      icon: <Loader2 className="w-8 h-8 animate-spin text-blue-500" />,
      color: "bg-blue-50 border-blue-200 text-blue-800",
      label: "Tap RFID card now...",
    },
    processing: {
      icon: <Loader2 className="w-8 h-8 animate-spin text-amber-500" />,
      color: "bg-amber-50 border-amber-200 text-amber-800",
      label: "Processing payment...",
    },
    success: {
      icon: <CheckCircle2 className="w-8 h-8 text-green-500" />,
      color: "bg-green-50 border-green-200 text-green-800",
      label: "Payment successful!",
    },
    error: {
      icon: <XCircle className="w-8 h-8 text-red-500" />,
      color: "bg-red-50 border-red-200 text-red-800",
      label: "Payment failed",
    },
  };

  return (
    <div className="max-w-7xl mx-auto">
      {contextHolder}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-blue-600" />
            Point of Sale
          </h2>

          <p className="text-sm text-slate-500 mt-0.5">
            {isAdmin
              ? "View products (admin cannot purchase)"
              : "Tap products to add to cart"}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* ─── Top Up Button ──────────────────────────────── */}
          {!isAdmin && (
            <button
              onClick={handleOpenTopUp}
              disabled={!myCard}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition-all active:scale-[0.98] shadow-lg ${
                myCard
                  ? "bg-green-600 hover:bg-green-700 text-white shadow-green-200"
                  : "bg-slate-300 text-slate-500 cursor-not-allowed"
              }`}
            >
              <Wallet className="w-4 h-4" />
              {myCard ? "Top Up Balance" : "No Card Linked"}
            </button>
          )}

          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
              mqttStatus === "Connected"
                ? "bg-green-100 text-green-700"
                : mqttStatus === "Error"
                ? "bg-red-100 text-red-700"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {mqttStatus === "Connected" ? (
              <Wifi className="w-4 h-4" />
            ) : (
              <WifiOff className="w-4 h-4" />
            )}
            MQTT {mqttStatus}
          </div>
        </div>
      </div>

      {lastRFID && (
        <div className="mb-4 flex items-center gap-2 bg-slate-100 border border-slate-200 rounded-xl px-4 py-2.5 text-sm">
          <QrCode className="w-4 h-4 text-slate-500" />
          <span className="text-slate-600">Last RFID:</span>
          <span className="font-mono font-semibold text-slate-900 tracking-wide">
            {lastRFID}
          </span>
        </div>
      )}

      {paymentMessage && !showPaymentModal && !showAddCardModal && (
        <div
          className={`mb-4 rounded-xl px-4 py-3 text-sm flex items-center gap-2 ${
            paymentStatus === "error"
              ? "bg-red-50 border border-red-200 text-red-800"
              : paymentStatus === "success"
              ? "bg-green-50 border border-green-200 text-green-800"
              : "bg-blue-50 border border-blue-200 text-blue-800"
          }`}
        >
          {paymentStatus === "error" && (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          {paymentStatus === "success" && (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          )}
          {paymentStatus === "idle" && <Info className="w-4 h-4 shrink-0" />}
          {paymentMessage}
        </div>
      )}

      {isAdmin && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3">
          <Shield className="w-5 h-5 text-amber-600 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-800">
              Admin Mode — Read Only
            </p>
            <p className="text-xs text-amber-600 mt-0.5">
              As an admin, you can view products but cannot add them to cart, make purchases, or top up balances. Only normal users can buy products and manage their own funds.
            </p>
          </div>
        </div>
      )}

      {/* ─── User's Card Info Banner (non-admin) ────────────── */}
      {!isAdmin && myCard && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-green-900">{myCard.name}</p>
              <p className="text-xs text-green-600 font-mono">{myCard.number}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-green-600">Your Balance</p>
            <p className="text-xl font-bold text-green-800">₱{myCard.balance.toLocaleString()}</p>
          </div>
        </div>
      )}

      {/* ─── No Card Warning (non-admin, no card) ───────────── */}
      {!isAdmin && !myCard && !loadingCards && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-800">No RFID Card Linked</p>
            <p className="text-xs text-red-600 mt-0.5">
              You need to register or bind an RFID card to your account to make purchases and top up.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900">Products</h3>
            <span className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-100 px-3 py-1 rounded-full">
              {products.length} items
            </span>
          </div>

          {loadingProducts ? (
            <div className="flex items-center justify-center py-20 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              Loading products...
            </div>
          ) : products.length === 0 ? (
            <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center">
              <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">No products found</p>
              <p className="text-sm text-slate-400 mt-1">
                Add products in Firebase first
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
              {products.map((product) => (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  disabled={isAdmin}
                  className={`
                    relative group bg-white rounded-2xl border border-slate-200
                    p-4 text-left overflow-hidden min-h-[150px]
                    hover:border-blue-500 hover:shadow-xl hover:shadow-blue-100
                    active:scale-[0.97]
                    transition-all duration-200
                    ${isAdmin ? "opacity-60 cursor-not-allowed hover:border-slate-200 hover:shadow-none active:scale-100" : ""}
                  `}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                  <div className="absolute top-3 right-3 bg-blue-600 text-white p-1.5 rounded-xl opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100 transition-all">
                    <Plus className="w-4 h-4" />
                  </div>

                  {isAdmin && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/50 rounded-2xl z-20">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-white/90 px-2 py-1 rounded-md border border-slate-200">
                        View Only
                      </span>
                    </div>
                  )}

                  <div className="relative z-10 h-full flex flex-col">
                    <div className="mb-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center mb-3">
                        <ShoppingBag className="w-5 h-5 text-blue-600" />
                      </div>

                      <div className="text-sm font-bold text-slate-800 leading-snug line-clamp-2 pr-8 group-hover:text-blue-700 transition-colors">
                        {product.name}
                      </div>
                    </div>

                    <div className="mt-auto">
                      <div className="text-2xl font-extrabold text-blue-600 tracking-tight">
                        ₱{product.price.toLocaleString()}
                      </div>

                      <div className="mt-2 flex items-center justify-between gap-2">
                        {product.category ? (
                          <span className="inline-flex max-w-[120px] truncate text-[10px] font-semibold text-blue-700 bg-blue-100 px-2 py-1 rounded-full">
                            {product.category}
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-2 py-1 rounded-full">
                            No category
                          </span>
                        )}

                        <span className="text-[11px] font-medium text-slate-400 group-hover:text-blue-500 transition-colors">
                          {isAdmin ? "View" : "Tap"}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-1 space-y-4">
          {/* Cart Panel */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm lg:sticky lg:top-6 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-slate-500" />
                Cart
              </h3>

              {!isAdmin && cart.length > 0 && (
                <span className="text-xs font-bold text-white bg-blue-600 px-2 py-0.5 rounded-full">
                  {cart.reduce((sum, i) => sum + i.quantity, 0)}
                </span>
              )}
            </div>

            {isAdmin ? (
              <div className="py-16 text-center px-6">
                <Shield className="w-10 h-10 text-amber-300 mx-auto mb-3" />
                <p className="text-slate-500 text-sm font-medium">
                  Admin Account
                </p>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Admins manage products and cards.
                  <br />
                  Only normal users can make purchases and top up.
                </p>
              </div>
            ) : cart.length === 0 ? (
              <div className="py-16 text-center">
                <ShoppingBag className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                <p className="text-slate-400 text-sm">Your cart is empty</p>
                <p className="text-xs text-slate-300 mt-1">
                  Tap products to add
                </p>
              </div>
            ) : (
              <>
                <div className="p-4 space-y-2 max-h-[50vh] overflow-y-auto">
                  {cart.map((item) => (
                    <div
                      key={item.product.id}
                      className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-slate-900 truncate">
                          {item.product.name}
                        </div>
                        <div className="text-xs text-slate-500">
                          ₱{item.product.price.toLocaleString()} each
                        </div>
                      </div>

                      <div className="flex items-center gap-1 bg-white rounded-lg border border-slate-200 p-0.5">
                        <button
                          onClick={() => updateQuantity(item.product.id, -1)}
                          className="p-1.5 hover:bg-slate-100 rounded-md transition-colors"
                        >
                          <Minus className="w-3.5 h-3.5 text-slate-600" />
                        </button>

                        <span className="w-7 text-center text-sm font-semibold text-slate-900">
                          {item.quantity}
                        </span>

                        <button
                          onClick={() => updateQuantity(item.product.id, 1)}
                          className="p-1.5 hover:bg-slate-100 rounded-md transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5 text-slate-600" />
                        </button>
                      </div>

                      <button
                        onClick={() => removeFromCart(item.product.id)}
                        className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="border-t border-slate-100 p-5 bg-slate-50/50">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm text-slate-600">Subtotal</span>
                    <span className="text-sm text-slate-900">
                      ₱{cartTotal.toLocaleString()}
                    </span>
                  </div>

                  <div className="flex justify-between items-center mb-4">
                    <span className="text-base font-bold text-slate-900">
                      Total
                    </span>
                    <span className="text-xl font-bold text-slate-900">
                      ₱{cartTotal.toLocaleString()}
                    </span>
                  </div>

                  <button
                    onClick={handlePayment}
                    disabled={mqttStatus !== "Connected"}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 
                    disabled:cursor-not-allowed text-white font-semibold py-3.5 
                    rounded-xl transition-all active:scale-[0.98] flex items-center 
                    justify-center gap-2 shadow-lg shadow-blue-200"
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

      {/* ─── TopUpModal Component ─────────────────────────────── */}
      <TopUpModal
        isOpen={showTopUpModal}
        onClose={() => {
          setShowTopUpModal(false);
          setSelectedTopUpCard(null);
        }}
        card={selectedTopUpCard}
        currentUser={currentUser}
        publishLCD={publishLCD}
        onTopUpComplete={handleTopUpComplete}
      />

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
            <div className="mb-6">
              <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                {statusConfig[paymentStatus].icon}
              </div>

              <h3 className="text-xl font-bold text-slate-900 mb-1">
                RFID Payment
              </h3>

              <p className="text-sm text-slate-500">
                {statusConfig[paymentStatus].label}
              </p>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 mb-6">
              <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">
                Total Amount
              </div>

              <div className="text-3xl font-bold text-slate-900">
                ₱{cartTotal.toLocaleString()}
              </div>
            </div>

            {paymentMessage && paymentStatus !== "waiting" && (
              <div
                className={`mb-6 p-4 rounded-xl text-sm ${
                  statusConfig[paymentStatus].color
                }`}
              >
                {paymentMessage}
              </div>
            )}

            <button
              onClick={cancelPayment}
              disabled={
                paymentStatus === "processing" || paymentStatus === "success"
              }
              className="w-full px-4 py-3 border border-slate-200 rounded-xl font-medium
              text-slate-700 hover:bg-slate-50 disabled:opacity-50 
              disabled:cursor-not-allowed transition-colors"
            >
              Cancel Payment
            </button>
          </div>
        </div>
      )}

      {/* Add Card Modal */}
      {showAddCardModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="mb-6">
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center mb-3">
                <AlertCircle className="w-6 h-6 text-amber-600" />
              </div>

              <h3 className="text-xl font-bold text-slate-900">
                Add Unknown RFID Card
              </h3>

              <p className="text-sm text-slate-500 mt-1">
                This card is not registered in the system
              </p>
            </div>

            <div className="mb-5 p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <div className="text-xs text-amber-700 font-medium uppercase tracking-wider mb-1">
                Detected UID
              </div>

              <div className="font-mono font-bold text-amber-900 text-lg tracking-widest">
                {unknownUID}
              </div>
            </div>

            <form onSubmit={handleAddUnknownCard} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Card Holder Name
                </label>

                <input
                  type="text"
                  value={newCardName}
                  onChange={(e) => setNewCardName(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl
                  focus:outline-none focus:ring-2 focus:ring-blue-500/20 
                  focus:border-blue-500 transition-all"
                  placeholder="e.g. Juan Dela Cruz"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Initial Balance (₱)
                </label>

                <input
                  type="number"
                  value={newCardBalance}
                  onChange={(e) => setNewCardBalance(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl
                  focus:outline-none focus:ring-2 focus:ring-blue-500/20 
                  focus:border-blue-500 transition-all"
                  placeholder="100"
                  min="0"
                  step="1"
                  required
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddCardModal(false);
                    setUnknownUID("");
                    setNewCardName("");
                    setNewCardBalance("");
                    setPaymentStatus("idle");
                    setPaymentMessage("");
                    publishLCD("CANCELLED | Scan Card");
                    notify("info", "Add Card Cancelled");
                  }}
                  className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl
                  font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white font-medium
                  rounded-xl hover:bg-blue-700 active:scale-[0.98] transition-all"
                >
                  Add Card
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}