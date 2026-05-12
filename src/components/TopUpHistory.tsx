import { useState, useEffect } from "react";
import {
  CreditCard,
  Smartphone,
  QrCode,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowUpRight,
  Loader2,
  Receipt,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { getCardTopUpHistory, type TopUpTransaction, type RFIDCard } from "../utils/storage";

interface TopUpHistoryProps {
  card: RFIDCard;
}

const METHOD_CONFIG = {
  paypal: {
    label: "PayPal",
    icon: <CreditCard className="w-4 h-4" />,
    color: "text-blue-700",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
  },
  maya: {
    label: "Maya",
    icon: <Smartphone className="w-4 h-4" />,
    color: "text-green-700",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
  },
  gcash: {
    label: "GCash",
    icon: <QrCode className="w-4 h-4" />,
    color: "text-cyan-700",
    bgColor: "bg-cyan-50",
    borderColor: "border-cyan-200",
  },
};

export function TopUpHistory({ card }: TopUpHistoryProps) {
  const [history, setHistory] = useState<TopUpTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadHistory();
  }, [card.id]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getCardTopUpHistory(card.id);
      setHistory(data);
    } catch (err) {
      console.error("Failed to load top-up history:", err);
      setError("Failed to load transaction history.");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
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

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
        <div className="flex items-center justify-center text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Loading history...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="text-center">
          <Receipt className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-red-600 font-medium">{error}</p>
          <button
            onClick={loadHistory}
            className="mt-3 text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
        <div className="text-center">
          <Receipt className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-sm text-slate-500 font-medium">No top-up history</p>
          <p className="text-xs text-slate-400 mt-1">
            Top-up transactions will appear here
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2">
          <Receipt className="w-4 h-4 text-slate-500" />
          Top-Up History
        </h3>
        <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
          {history.length} transactions
        </span>
      </div>

      <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
        {history.map((tx) => {
          const config = METHOD_CONFIG[tx.method];
          const isExpanded = expandedId === tx.id;

          return (
            <div
              key={tx.id}
              className="p-4 hover:bg-slate-50/50 transition-colors cursor-pointer"
              onClick={() => setExpandedId(isExpanded ? null : tx.id)}
            >
              <div className="flex items-center gap-3">
                {/* Method Icon */}
                <div className={`w-10 h-10 rounded-xl ${config.bgColor} flex items-center justify-center shrink-0`}>
                  <span className={config.color}>{config.icon}</span>
                </div>

                {/* Main Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900">
                        +₱{tx.amount.toLocaleString()}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${config.bgColor} ${config.color} border ${config.borderColor}`}>
                        {config.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {tx.status === "success" ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      ) : tx.status === "failed" ? (
                        <XCircle className="w-4 h-4 text-red-500" />
                      ) : (
                        <Clock className="w-4 h-4 text-amber-500" />
                      )}
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-xs text-slate-500">
                      {formatRelativeTime(tx.timestamp)}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      {tx.referenceCode}
                    </span>
                  </div>
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-400">Previous Balance</span>
                      <div className="font-medium text-slate-700">₱{tx.previousBalance.toLocaleString()}</div>
                    </div>
                    <div>
                      <span className="text-slate-400">New Balance</span>
                      <div className="font-medium text-slate-700">₱{tx.newBalance.toLocaleString()}</div>
                    </div>
                    <div>
                      <span className="text-slate-400">Processed By</span>
                      <div className="font-medium text-slate-700">{tx.userEmail}</div>
                    </div>
                    <div>
                      <span className="text-slate-400">Full Date</span>
                      <div className="font-medium text-slate-700">{formatDate(tx.timestamp)}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-slate-400">
                    <ArrowUpRight className="w-3 h-3" />
                    Transaction ID: {tx.id}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}