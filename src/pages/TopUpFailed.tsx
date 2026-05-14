// pages/TopUpFailed.tsx
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { XCircle, ArrowLeft, RefreshCw } from "lucide-react";

export function TopUpFailed() {
  const navigate = useNavigate();

  useEffect(() => {
    // Clear pending top-up on failure
    localStorage.removeItem("pendingTopUp");
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 text-center">
        <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-red-800 mb-2">Payment Cancelled</h2>
        <p className="text-slate-500 mb-6">
          Your payment was cancelled or failed. No charges were made.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => navigate("/pos")}
            className="inline-flex items-center gap-2 px-4 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-xl transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <button
            onClick={() => navigate("/pos?topup=true")}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
        </div>
      </div>
    </div>
  );
}