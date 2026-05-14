// pages/TopUpSuccess.tsx or components/TopUpSuccess.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getDatabase, ref, get, set, update } from "firebase/database";
import { Loader2, CheckCircle, XCircle, ArrowLeft } from "lucide-react";

interface PendingTopUp {
  sourceId: string;
  cardId: string;
  amount: number;
  method: string;
  timestamp: number;
  previousBalance: number;
}

export function TopUpSuccess() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [message, setMessage] = useState("Verifying your payment...");
  const [pendingData, setPendingData] = useState<PendingTopUp | null>(null);

  useEffect(() => {
    const verifyAndUpdate = async () => {
      try {
        // 1. Get pending top-up from localStorage
        const pendingRaw = localStorage.getItem("pendingTopUp");
        
        if (!pendingRaw) {
          setStatus("error");
          setMessage("No pending top-up found. Invalid return URL.");
          return;
        }

        const pending: PendingTopUp = JSON.parse(pendingRaw);
        setPendingData(pending);

        // Check if expired (10 minutes)
        if (Date.now() - pending.timestamp > 10 * 60 * 1000) {
          localStorage.removeItem("pendingTopUp");
          setStatus("error");
          setMessage("This top-up session has expired.");
          return;
        }

        // 2. Update Firebase Realtime Database
        const db = getDatabase();
        
        // Get current balance
        const balanceRef = ref(db, `cards/${pending.cardId}/balance`);
        const snapshot = await get(balanceRef);
        const currentBalance = snapshot.val() || 0;
        const newBalance = currentBalance + pending.amount;

        // Update balance atomically
        await update(ref(db, `cards/${pending.cardId}`), {
          balance: newBalance,
          lastTopUp: Date.now(),
          lastTopUpAmount: pending.amount,
        });

        // Record transaction
        const txRef = ref(db, `transactions/${Date.now()}_${pending.cardId}`);
        await set(txRef, {
          cardId: pending.cardId,
          amount: pending.amount,
          method: pending.method,
          type: "topup",
          status: "completed",
          previousBalance: currentBalance,
          newBalance: newBalance,
          timestamp: Date.now(),
          processedAt: new Date().toISOString(),
        });

        // 3. Clear pending top-up
        localStorage.removeItem("pendingTopUp");

        setStatus("success");
        setMessage(`Successfully added ₱${pending.amount.toLocaleString()} to your card!`);

        // Optional: Auto-redirect after 3 seconds
        setTimeout(() => navigate("/pos"), 3000);

      } catch (error: any) {
        console.error("Top-up verification failed:", error);
        setStatus("error");
        setMessage(error.message || "Failed to process top-up. Please contact support.");
      }
    };

    verifyAndUpdate();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 text-center">
        {status === "verifying" && (
          <>
            <Loader2 className="w-16 h-16 animate-spin text-blue-600 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-900 mb-2">Processing Payment</h2>
            <p className="text-slate-500">{message}</p>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-green-800 mb-2">Top-Up Successful!</h2>
            <p className="text-slate-600 mb-2">{message}</p>
            {pendingData && (
              <div className="bg-green-50 rounded-lg p-4 mt-4 text-left">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-500">Amount</span>
                  <span className="font-bold text-green-700">₱{pendingData.amount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-500">Method</span>
                  <span className="font-bold text-slate-700 uppercase">{pendingData.method}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Previous Balance</span>
                  <span className="font-bold text-slate-700">₱{pendingData.previousBalance.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm mt-1 pt-1 border-t border-green-200">
                  <span className="text-slate-500">New Balance</span>
                  <span className="font-bold text-green-700">₱{(pendingData.previousBalance + pendingData.amount).toLocaleString()}</span>
                </div>
              </div>
            )}
            <p className="text-xs text-slate-400 mt-4">Redirecting to dashboard...</p>
          </>
        )}

        {status === "error" && (
          <>
            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-red-800 mb-2">Top-Up Failed</h2>
            <p className="text-red-600 mb-6">{message}</p>
            <button
              onClick={() => navigate("/pos")}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </button>
          </>
        )}
      </div>
    </div>
  );
}