// components/TopUpModal.tsx

import { useState, useCallback, useEffect, useRef } from "react";
import {
  X,
  Loader2,
  XCircle,
  Wallet,
  Smartphone,
  QrCode,
  Shield,
  AlertCircle,
  ArrowLeft,
  Lock,
  User,
  ExternalLink,
} from "lucide-react";

import { notification } from "antd";
import type { NotificationArgsProps } from "antd";

import { getDatabase, ref, onValue } from "firebase/database";
import { type RFIDCard } from "../utils/storage";

type PaymentMethod = "maya" | "gcash";

type NotifyType = "success" | "error" | "info";

const useNotify = () => {
  const [api, contextHolder] = notification.useNotification();

  const notify = useCallback(
    (type: NotifyType, title: string, description?: string) => {
      const config: NotificationArgsProps = {
        message: title,
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

interface TopUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  card: RFIDCard | null;
  currentUser: {
    uid: string;
    email: string;
    role: string;
  } | null;
  publishLCD?: (message: string) => void;
  onTopUpComplete?: () => void;
}

const PAYMENT_METHODS = [
  {
    id: "gcash" as const,
    label: "GCash",
    description: "Pay with GCash wallet",
    icon: <QrCode className="w-6 h-6" />,
    color: "text-cyan-700",
    bgColor: "bg-cyan-50",
    borderColor: "border-cyan-200",
    hoverColor: "hover:border-cyan-400 hover:bg-cyan-50",
  },
  {
    id: "maya" as const,
    label: "Maya",
    description: "Pay with Maya wallet",
    icon: <Smartphone className="w-6 h-6" />,
    color: "text-green-700",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
    hoverColor: "hover:border-green-400 hover:bg-green-50",
  },
];

const PRESET_AMOUNTS = [50, 100, 200, 500, 1000];
const MIN_AMOUNT = 10;

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export function TopUpModal({
  isOpen,
  onClose,
  card,
  currentUser,
  publishLCD,
  onTopUpComplete,
}: TopUpModalProps) {
  const { notify, contextHolder } = useNotify();

  const [step, setStep] = useState<
    "method" | "amount" | "confirm" | "processing" | "error"
  >("method");

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [amount, setAmount] = useState<number>(100);
  const [customAmount, setCustomAmount] = useState<string>("");
  const [isCustom, setIsCustom] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // ─── LIVE BALANCE FROM FIREBASE ─────────────────────────────
  const [liveBalance, setLiveBalance] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);

  const selectedMethodRef = useRef<PaymentMethod | null>(null);

  const setSelectedMethodSafe = (method: PaymentMethod | null) => {
    selectedMethodRef.current = method;
    setSelectedMethod(method);
  };

  const methodConfig = PAYMENT_METHODS.find(
    (m) => m.id === (selectedMethod ?? selectedMethodRef.current)
  );

  const isOwner = card?.userId === currentUser?.uid;

  // ─── FETCH LIVE BALANCE WHEN MODAL OPENS ────────────────────
  useEffect(() => {
    if (!isOpen || !card?.id) {
      setLiveBalance(null);
      return;
    }

    setBalanceLoading(true);
    const db = getDatabase();
    const balanceRef = ref(db, `cards/${card.id}/balance`);

    const unsubscribe = onValue(balanceRef, (snapshot) => {
      const value = snapshot.val();
      setLiveBalance(value ?? card.balance ?? 0);
      setBalanceLoading(false);
    });

    return () => unsubscribe();
  }, [isOpen, card?.id, card?.balance]);

  const displayBalance = liveBalance ?? card?.balance ?? 0;

  const resetState = () => {
    setStep("method");
    setSelectedMethodSafe(null);
    setAmount(100);
    setCustomAmount("");
    setIsCustom(false);
    setIsProcessing(false);
    setErrorMessage("");
  };

  useEffect(() => {
    return () => {
      const pending = localStorage.getItem("pendingTopUp");
      if (pending) {
        try {
          const { timestamp } = JSON.parse(pending);
          if (Date.now() - timestamp > 10 * 60 * 1000) {
            localStorage.removeItem("pendingTopUp");
          }
        } catch {
          localStorage.removeItem("pendingTopUp");
        }
      }
    };
  }, []);

  const handleClose = () => {
    resetState();
    onTopUpComplete?.();
    onClose();
  };

  const handleSelectMethod = (method: PaymentMethod) => {
    setSelectedMethodSafe(method);
    setStep("amount");
  };

  const handleSelectAmount = (amt: number) => {
    setAmount(amt);
    setIsCustom(false);
    setCustomAmount("");
  };

  const handleCustomAmountChange = (value: string) => {
    setCustomAmount(value);
    setIsCustom(true);
    const num = Math.floor(Number(value));
    if (!isNaN(num) && num > 0) {
      setAmount(num);
    }
  };

  const handleConfirm = () => {
    if (amount < MIN_AMOUNT) {
      notify("error", "Invalid Amount", `Minimum top-up amount is ₱${MIN_AMOUNT}`);
      return;
    }
    setStep("confirm");
  };

  const handleProcessPayment = async () => {
    if (!isOwner) {
      notify("error", "Access Denied", "Only the card owner can top up.");
      if (publishLCD) publishLCD("ACCESS DENIED");
      return;
    }

    if (!card || !selectedMethod) {
      notify("error", "Error", "Missing card or payment method");
      return;
    }

    if (amount < MIN_AMOUNT) {
      notify("error", "Invalid Amount", `Minimum top-up amount is ₱${MIN_AMOUNT}`);
      return;
    }

    setIsProcessing(true);
    setStep("processing");

    try {
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/paymongo-checkout`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            amount: amount * 100,
            method: selectedMethod,
            cardId: card.id,
            userId: currentUser?.uid,
            userEmail: currentUser?.email,
            cardName: card.name,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }

      if (data.error) {
        throw new Error(data.error);
      }

      localStorage.setItem(
        "pendingTopUp",
        JSON.stringify({
          sourceId: data.sourceId,
          cardId: card.id,
          amount: amount,
          method: selectedMethod,
          timestamp: Date.now(),
          previousBalance: displayBalance, // ← Use live balance
          userId: currentUser?.uid,
        })
      );

      window.location.href = data.checkoutUrl;
    } catch (error: any) {
      console.error("Payment initiation failed:", error);
      setStep("error");
      setErrorMessage(error.message || "Failed to initiate payment. Please try again.");
      setIsProcessing(false);
      notify("error", "Payment Failed", error.message);
      if (publishLCD) publishLCD("TOPUP FAIL | Try Again");
    }
  };

  const handleRetry = () => {
    setStep("confirm");
    setErrorMessage("");
  };

  if (!isOpen || !card) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      {contextHolder}

      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* HEADER */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <Wallet className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">Top Up Balance</h3>
              <p className="text-xs text-slate-500">
                {step === "method" && "Select payment method"}
                {step === "amount" && "Choose amount"}
                {step === "confirm" && "Review and confirm"}
                {step === "processing" && "Connecting to PayMongo..."}
                {step === "error" && "Payment failed"}
              </p>
            </div>
          </div>
          <button onClick={handleClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* ACCOUNT INFO WITH LIVE BALANCE */}
        <div className="px-6 py-3 bg-blue-50 border-b border-blue-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">{card.name}</span>
            </div>
            <div className="text-right">
              <div className="text-xs text-blue-600">Current Balance</div>
              <div className="text-sm font-bold text-blue-900 flex items-center justify-end gap-2">
                {balanceLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  `₱${displayBalance.toLocaleString()}`
                )}
              </div>
            </div>
          </div>

          <div className="mt-1 text-xs text-blue-600 font-mono">{card.number}</div>

          <div
            className={`mt-2 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
              isOwner
                ? "bg-green-100 text-green-700"
                : "bg-red-100 text-red-700"
            }`}
          >
            {isOwner ? (
              <>
                <User className="w-3 h-3" />
                You are the owner
              </>
            ) : (
              <>
                <Lock className="w-3 h-3" />
                Not your card
              </>
            )}
          </div>
        </div>

        {/* CONTENT */}
        <div className="p-6">
          {/* STEP 1: METHOD */}
          {step === "method" && (
            <div className="space-y-3">
              {PAYMENT_METHODS.map((method) => (
                <button
                  key={method.id}
                  onClick={() => handleSelectMethod(method.id)}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left
                    ${method.borderColor} ${method.hoverColor}`}
                >
                  <div className={`w-12 h-12 rounded-xl ${method.bgColor} flex items-center justify-center`}>
                    <span className={method.color}>{method.icon}</span>
                  </div>
                  <div className="flex-1">
                    <div className={`font-bold ${method.color}`}>{method.label}</div>
                    <div className="text-sm text-slate-500">{method.description}</div>
                  </div>
                  <ExternalLink className="w-5 h-5 text-slate-300" />
                </button>
              ))}
            </div>
          )}

          {/* STEP 2: AMOUNT */}
          {step === "amount" && (
            <div className="space-y-4">
              <button
                onClick={() => setStep("method")}
                className="flex items-center gap-2 text-sm text-slate-500"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>

              <div className="grid grid-cols-3 gap-2">
                {PRESET_AMOUNTS.map((amt) => (
                  <button
                    key={amt}
                    onClick={() => handleSelectAmount(amt)}
                    className={`py-3 rounded-xl text-sm font-bold border-2
                      ${
                        !isCustom && amount === amt
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-slate-200 text-slate-600"
                      }
                    `}
                  >
                    ₱{amt}
                  </button>
                ))}
              </div>

              <input
                type="number"
                value={customAmount}
                onChange={(e) => handleCustomAmountChange(e.target.value)}
                placeholder="Custom amount"
                className="w-full px-4 py-3 border-2 rounded-xl"
              />

              <button
                onClick={handleConfirm}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl"
              >
                Continue — ₱{amount.toLocaleString()}
              </button>
            </div>
          )}

          {/* STEP 3: CONFIRM */}
          {step === "confirm" && (
            <div className="space-y-4">
              <button
                onClick={() => setStep("amount")}
                className="flex items-center gap-2 text-sm text-slate-500"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>

              <div className="bg-slate-50 rounded-xl p-4">
                <div className="flex justify-between mb-2">
                  <span>Method</span>
                  <span className="font-bold">{methodConfig?.label}</span>
                </div>
                <div className="flex justify-between">
                  <span>Amount</span>
                  <span className="font-bold text-blue-600">₱{amount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between mt-2 pt-2 border-t border-slate-200">
                  <span className="text-slate-500">Current Balance</span>
                  <span className="font-bold text-slate-700">₱{displayBalance.toLocaleString()}</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-slate-500">After Top-Up</span>
                  <span className="font-bold text-green-600">₱{(displayBalance + amount).toLocaleString()}</span>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">
                  You will be redirected to {methodConfig?.label}.
                </p>
              </div>

              <button
                onClick={handleProcessPayment}
                disabled={isProcessing}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Shield className="w-5 h-5" />
                    Pay ₱{amount.toLocaleString()}
                  </>
                )}
              </button>
            </div>
          )}

          {/* PROCESSING */}
          {step === "processing" && (
            <div className="py-8 text-center space-y-4">
              <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto" />
              <h4 className="font-bold text-slate-900">
                Redirecting to {methodConfig?.label}...
              </h4>
            </div>
          )}

          {/* ERROR */}
          {step === "error" && (
            <div className="py-6 text-center space-y-4">
              <XCircle className="w-16 h-16 text-red-500 mx-auto" />
              <h4 className="text-xl font-bold text-red-800">Payment Failed</h4>
              <p className="text-sm text-red-600">{errorMessage}</p>
              <div className="flex gap-3">
                <button onClick={handleRetry} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl">
                  Try Again
                </button>
                <button onClick={handleClose} className="flex-1 px-4 py-2.5 bg-slate-100 rounded-xl">
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}