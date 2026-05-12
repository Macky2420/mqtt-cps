import { useState, useCallback } from "react";
import {
  X,
  Loader2,
  CheckCircle2,
  XCircle,
  Wallet,
  CreditCard,
  Smartphone,
  QrCode,
  Shield,
  AlertCircle,
  ArrowLeft,
  RefreshCw,
  Lock,
  User,
} from "lucide-react";
import { notification } from "antd";
import type { NotificationArgsProps } from "antd";

import {
  updateCardBalance,
  addTopUpTransaction,
  type RFIDCard,
  type TopUpTransaction,
} from "../utils/storage";

type PaymentMethod = "paypal" | "maya" | "gcash";

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

interface TopUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  card: RFIDCard | null;
  currentUser: { uid: string; email: string; role: string } | null;
  publishLCD?: (message: string) => void;
  onTopUpComplete?: () => void;
}

const PAYMENT_METHODS: {
  id: PaymentMethod;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
  hoverColor: string;
  processingSteps: string[];
  delay: number;
}[] = [
  {
    id: "paypal",
    label: "PayPal",
    description: "Pay with PayPal account or card",
    icon: <CreditCard className="w-6 h-6" />,
    color: "text-blue-700",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    hoverColor: "hover:border-blue-400 hover:bg-blue-50",
    processingSteps: [
      "Connecting to PayPal servers...",
      "Authenticating merchant account...",
      "Verifying payment details...",
      "Processing transaction...",
    ],
    delay: 2800,
  },
  {
    id: "maya",
    label: "Maya",
    description: "Pay with Maya wallet",
    icon: <Smartphone className="w-6 h-6" />,
    color: "text-green-700",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
    hoverColor: "hover:border-green-400 hover:bg-green-50",
    processingSteps: [
      "Connecting to Maya API...",
      "Validating wallet balance...",
      "Processing Maya payment...",
      "Confirming transaction...",
    ],
    delay: 2200,
  },
  {
    id: "gcash",
    label: "GCash",
    description: "Pay with GCash wallet",
    icon: <QrCode className="w-6 h-6" />,
    color: "text-cyan-700",
    bgColor: "bg-cyan-50",
    borderColor: "border-cyan-200",
    hoverColor: "hover:border-cyan-400 hover:bg-cyan-50",
    processingSteps: [
      "Connecting to GCash gateway...",
      "Verifying GCash account...",
      "Processing GCash payment...",
      "Transaction approved...",
    ],
    delay: 1800,
  },
];

const PRESET_AMOUNTS = [50, 100, 200, 500, 1000];

export function TopUpModal({
  isOpen,
  onClose,
  card,
  currentUser,
  publishLCD,
  onTopUpComplete,
}: TopUpModalProps) {
  const { notify, contextHolder } = useNotify();

  const [step, setStep] = useState<"method" | "amount" | "confirm" | "processing" | "result" | "unauthorized">("method");
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [amount, setAmount] = useState<number>(100);
  const [customAmount, setCustomAmount] = useState<string>("");
  const [isCustom, setIsCustom] = useState(false);
  const [processingStep, setProcessingStep] = useState(0);
  const [resultStatus, setResultStatus] = useState<"success" | "error" | null>(null);
  const [resultMessage, setResultMessage] = useState("");
  const [referenceCode, setReferenceCode] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const methodConfig = PAYMENT_METHODS.find((m) => m.id === selectedMethod);

  // ─── OWNER VERIFICATION ──────────────────────────────────────
  // Check if current user is the owner of this card
  const isOwner = card?.userId === currentUser?.uid;

  const generateReferenceCode = (method: PaymentMethod) => {
    const prefix = method.toUpperCase();
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
  };

  const resetState = () => {
    setStep("method");
    setSelectedMethod(null);
    setAmount(100);
    setCustomAmount("");
    setIsCustom(false);
    setProcessingStep(0);
    setResultStatus(null);
    setResultMessage("");
    setReferenceCode("");
    setIsProcessing(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleSelectMethod = (method: PaymentMethod) => {
    setSelectedMethod(method);
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
    const num = parseInt(value);
    if (!isNaN(num) && num > 0) {
      setAmount(num);
    }
  };

  const handleConfirm = () => {
    if (amount < 10) {
      notify("error", "Invalid Amount", "Minimum top-up amount is ₱10");
      return;
    }
    setStep("confirm");
  };

  const simulatePaymentSteps = async (method: PaymentMethod) => {
    const config = PAYMENT_METHODS.find((m) => m.id === method)!;
    const stepDelay = config.delay / config.processingSteps.length;

    for (let i = 0; i < config.processingSteps.length; i++) {
      setProcessingStep(i);
      await new Promise((resolve) => setTimeout(resolve, stepDelay));
    }
  };

  const handleProcessPayment = async () => {
    // ─── SECURITY CHECK: Only owner can top up ──────────────────
    if (!isOwner) {
      setStep("unauthorized");
      setResultStatus("error");
      setResultMessage("Access denied. Only the card owner can top up this account.");
      notify(
        "error",
        "Access Denied",
        `You are not the owner of this card. Only ${card?.name} can top up this account.`
      );
      if (publishLCD) publishLCD("ACCESS DENIED");
      return;
    }

    if (!card || !selectedMethod) {
      notify("error", "Error", "Missing card or payment method");
      return;
    }

    setIsProcessing(true);
    setStep("processing");

    const refCode = generateReferenceCode(selectedMethod);
    setReferenceCode(refCode);

    // Simulate processing steps
    await simulatePaymentSteps(selectedMethod);

    // 12% chance of random failure for realism
    if (Math.random() < 0.12) {
      setResultStatus("error");
      setResultMessage(
        `Payment declined by ${methodConfig?.label}. Insufficient funds or network error.`
      );
      notify(
        "error",
        `${methodConfig?.label} Payment Failed`,
        "Transaction was declined. Please try again."
      );
      if (publishLCD) publishLCD("TOPUP FAIL | Try Again");
      setIsProcessing(false);
      return;
    }

    try {
      // Calculate new balance
      const previousBalance = card.balance;
      const newBalance = previousBalance + amount;

      // Update card balance in Firebase
      await updateCardBalance(card.id, newBalance);

      // Save top-up transaction
      const topUpTx: TopUpTransaction = {
        id: Date.now().toString(),
        timestamp: Date.now(),
        cardId: card.id,
        cardNumber: card.number,
        cardName: card.name,
        userId: currentUser!.uid,        // Owner's UID
        userEmail: currentUser!.email,   // Owner's email
        amount,
        method: selectedMethod,
        status: "success",
        referenceCode: refCode,
        previousBalance,
        newBalance,
      };

      await addTopUpTransaction(topUpTx);

      // Success state
      setResultStatus("success");
      setResultMessage(
        `Successfully added ₱${amount.toLocaleString()} to your account.`
      );
      notify(
        "success",
        "Top-Up Complete",
        `₱${amount.toLocaleString()} added via ${methodConfig?.label}. New balance: ₱${newBalance.toLocaleString()}`
      );

      if (publishLCD) {
        publishLCD(`TOPUP OK | Bal:${newBalance}`);
      }

      // Callback to refresh parent
      if (onTopUpComplete) {
        onTopUpComplete();
      }

    } catch (error) {
      console.error("Top-up failed:", error);
      setResultStatus("error");
      setResultMessage("Failed to update balance. Please check your Firebase connection.");
      notify("error", "Top-Up Failed", "Database update error.");
      if (publishLCD) publishLCD("TOPUP ERR | DB Error");
    }

    setIsProcessing(false);
  };

  const handleRetry = () => {
    setStep("confirm");
    setResultStatus(null);
    setResultMessage("");
  };

  const handleNewTopUp = () => {
    resetState();
    setStep("method");
  };

  if (!isOpen || !card) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      {contextHolder}
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <Wallet className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">Top Up Balance</h3>
              <p className="text-xs text-slate-500">
                {step === "method" && "Select payment method"}
                {step === "amount" && "Choose top-up amount"}
                {step === "confirm" && "Review and confirm"}
                {step === "processing" && "Processing payment..."}
                {step === "result" && resultStatus === "success" ? "Payment successful" : "Payment failed"}
                {step === "unauthorized" && "Access denied"}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Account Info Banner */}
        <div className="px-6 py-3 bg-blue-50 border-b border-blue-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">
                {card.name}
              </span>
            </div>
            <div className="text-right">
              <div className="text-xs text-blue-600">Current Balance</div>
              <div className="text-sm font-bold text-blue-900">
                ₱{card.balance.toLocaleString()}
              </div>
            </div>
          </div>
          <div className="mt-1 text-xs text-blue-600 font-mono">
            {card.number}
          </div>
          {/* Show ownership status */}
          <div className={`mt-2 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
            isOwner 
              ? "bg-green-100 text-green-700" 
              : "bg-red-100 text-red-700"
          }`}>
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

        {/* Content */}
        <div className="p-6">
          {/* ─── UNAUTHORIZED STATE ─────────────────────────────── */}
          {step === "unauthorized" && (
            <div className="py-8 text-center space-y-4">
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                <Lock className="w-10 h-10 text-red-600" />
              </div>
              <div>
                <h4 className="text-xl font-bold text-red-800">Access Denied</h4>
                <p className="text-sm text-red-600 mt-1">
                  Only the card owner can top up this account.
                </p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 max-w-xs mx-auto text-left">
                <div className="text-xs text-red-700 space-y-1">
                  <div><strong>Card Owner:</strong> {card.name}</div>
                  <div><strong>Your Account:</strong> {currentUser?.email || "Unknown"}</div>
                  <div className="pt-2 border-t border-red-200 mt-2">
                    You must be logged in as <strong>{card.name}</strong> to top up this card.
                  </div>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="w-full px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl transition-colors"
              >
                Close
              </button>
            </div>
          )}

          {/* STEP 1: Select Payment Method */}
          {step === "method" && (
            <div className="space-y-3">
              {!isOwner && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
                  <Lock className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700">
                    <strong>Read Only.</strong> You are viewing {card.name}'s card. 
                    Only the owner can top up this account.
                  </p>
                </div>
              )}

              <p className="text-sm font-medium text-slate-700 mb-3">
                {isOwner ? "Select a payment gateway:" : "Payment methods (disabled)"}
              </p>
              {PAYMENT_METHODS.map((method) => (
                <button
                  key={method.id}
                  onClick={() => isOwner && handleSelectMethod(method.id)}
                  disabled={!isOwner}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left
                    ${method.borderColor} ${isOwner ? method.hoverColor : ""} 
                    ${!isOwner ? "opacity-50 cursor-not-allowed" : "active:scale-[0.98] hover:shadow-md"}
                  `}
                >
                  <div className={`w-12 h-12 rounded-xl ${method.bgColor} flex items-center justify-center shrink-0`}>
                    <span className={method.color}>{method.icon}</span>
                  </div>
                  <div className="flex-1">
                    <div className={`font-bold ${method.color}`}>{method.label}</div>
                    <div className="text-sm text-slate-500">{method.description}</div>
                  </div>
                  {!isOwner && <Lock className="w-4 h-4 text-red-400" />}
                  {isOwner && <ArrowLeft className="w-5 h-5 text-slate-300 rotate-180" />}
                </button>
              ))}
            </div>
          )}

          {/* STEP 2: Select Amount */}
          {step === "amount" && selectedMethod && isOwner && (
            <div className="space-y-4">
              <button
                onClick={() => setStep("method")}
                className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors mb-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to methods
              </button>

              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                <div className={`w-10 h-10 rounded-lg ${methodConfig?.bgColor} flex items-center justify-center`}>
                  <span className={methodConfig?.color}>{methodConfig?.icon}</span>
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900">{methodConfig?.label}</div>
                  <div className="text-xs text-slate-500">Selected payment method</div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Select Amount
                </label>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {PRESET_AMOUNTS.map((amt) => (
                    <button
                      key={amt}
                      onClick={() => handleSelectAmount(amt)}
                      className={`py-3 rounded-xl text-sm font-bold border-2 transition-all
                        ${!isCustom && amount === amt
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-slate-200 text-slate-600 hover:border-slate-300"
                        }`}
                    >
                      ₱{amt}
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₱</span>
                  <input
                    type="number"
                    placeholder="Custom amount"
                    value={customAmount}
                    onChange={(e) => handleCustomAmountChange(e.target.value)}
                    className={`w-full pl-8 pr-4 py-3 border-2 rounded-xl font-semibold transition-all
                      ${isCustom ? "border-blue-500 bg-blue-50" : "border-slate-200"}
                      focus:outline-none focus:border-blue-500`}
                    min="10"
                    step="10"
                  />
                </div>
              </div>

              <button
                onClick={handleConfirm}
                disabled={amount < 10}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold py-3.5 rounded-xl transition-all active:scale-[0.98] shadow-lg shadow-blue-200"
              >
                Continue — ₱{amount.toLocaleString()}
              </button>
            </div>
          )}

          {/* STEP 3: Confirm */}
          {step === "confirm" && selectedMethod && isOwner && (
            <div className="space-y-4">
              <button
                onClick={() => setStep("amount")}
                className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to amount
              </button>

              <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500">Payment Method</span>
                  <span className={`text-sm font-bold ${methodConfig?.color} flex items-center gap-1`}>
                    {methodConfig?.icon}
                    {methodConfig?.label}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500">Account Holder</span>
                  <span className="text-sm font-semibold text-slate-900">{card.name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500">Card UID</span>
                  <span className="text-sm font-mono text-slate-700">{card.number}</span>
                </div>
                <div className="border-t border-slate-200 pt-3 flex justify-between items-center">
                  <span className="text-sm font-medium text-slate-700">Amount to Add</span>
                  <span className="text-xl font-extrabold text-blue-600">₱{amount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center pt-1">
                  <span className="text-sm text-slate-500">New Balance Will Be</span>
                  <span className="text-sm font-bold text-slate-900">
                    ₱{(card.balance + amount).toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">
                  This is a simulation. No real money will be charged. The balance will be updated in Firebase.
                </p>
              </div>

              <button
                onClick={handleProcessPayment}
                disabled={isProcessing}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition-all active:scale-[0.98] shadow-lg shadow-blue-200 flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Shield className="w-5 h-5" />
                    Confirm & Pay ₱{amount.toLocaleString()}
                  </>
                )}
              </button>
            </div>
          )}

          {/* STEP 4: Processing */}
          {step === "processing" && selectedMethod && (
            <div className="py-8 text-center space-y-6">
              <div className="relative">
                <div className={`w-20 h-20 rounded-full ${methodConfig?.bgColor} flex items-center justify-center mx-auto`}>
                  <Loader2 className={`w-10 h-10 animate-spin ${methodConfig?.color}`} />
                </div>
                <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-md">
                  {methodConfig?.icon}
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-slate-900">Processing {methodConfig?.label} Payment</h4>
                <p className="text-sm text-slate-500">
                  {methodConfig?.processingSteps[processingStep] || "Finalizing..."}
                </p>
              </div>

              <div className="space-y-2 max-w-xs mx-auto">
                {methodConfig?.processingSteps.map((stepText, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center gap-2 text-sm transition-all ${
                      idx < processingStep
                        ? "text-green-600"
                        : idx === processingStep
                        ? "text-blue-600 font-medium"
                        : "text-slate-300"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                        idx < processingStep
                          ? "bg-green-100"
                          : idx === processingStep
                          ? "bg-blue-100"
                          : "bg-slate-100"
                      }`}
                    >
                      {idx < processingStep ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : (
                        <span className="text-xs">{idx + 1}</span>
                      )}
                    </div>
                    {stepText}
                  </div>
                ))}
              </div>

              <div className="text-xs text-slate-400 font-mono">
                Ref: {referenceCode}
              </div>
            </div>
          )}

          {/* STEP 5: Result */}
          {step === "result" && (
            <div className="py-6 text-center space-y-4">
              {resultStatus === "success" ? (
                <>
                  <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-10 h-10 text-green-600" />
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-green-800">Payment Successful!</h4>
                    <p className="text-sm text-green-600 mt-1">{resultMessage}</p>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4 max-w-xs mx-auto">
                    <div className="text-xs text-green-700 uppercase tracking-wider font-semibold mb-1">
                      Reference Code
                    </div>
                    <div className="font-mono font-bold text-green-900 text-sm">
                      {referenceCode}
                    </div>
                    <div className="mt-3 pt-3 border-t border-green-200 flex justify-between">
                      <span className="text-xs text-green-700">Amount Added</span>
                      <span className="text-sm font-bold text-green-900">₱{amount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-xs text-green-700">New Balance</span>
                      <span className="text-sm font-bold text-green-900">₱{(card.balance + amount).toLocaleString()}</span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                    <XCircle className="w-10 h-10 text-red-600" />
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-red-800">Payment Failed</h4>
                    <p className="text-sm text-red-600 mt-1">{resultMessage}</p>
                  </div>
                </>
              )}

              <div className="flex gap-3 pt-2">
                {resultStatus === "error" && (
                  <button
                    onClick={handleRetry}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-slate-200 rounded-xl font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Try Again
                  </button>
                )}
                <button
                  onClick={resultStatus === "success" ? handleNewTopUp : handleClose}
                  className={`flex-1 px-4 py-2.5 font-medium rounded-xl transition-colors ${
                    resultStatus === "success"
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {resultStatus === "success" ? "New Top-Up" : "Close"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}