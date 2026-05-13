import { useEffect, useState, useRef, useCallback } from "react";
import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  ShoppingBag,
  Package,
  CreditCard,
  BarChart3,
  LogOut,
  User,
  Shield,
  Menu,
  X,
  Loader2,
} from "lucide-react";
import mqtt from "mqtt";
import type { MqttClient } from "mqtt";
import { getCurrentUser, logoutUser, type AppUser } from "../utils/storage";
export interface RootOutletContext {
  mqttStatus: string;
  lastRFID: string;
  publishLCD: (message: string) => void;
  setRFIDHandler: (handler: ((uid: string) => void) | null) => void;
  currentUser: AppUser | null;
}

export function Root() {
  const navigate = useNavigate();
  const location = useLocation();

  // ─── Auth State ───
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = getCurrentUser((user) => {
      setCurrentUser(user);
      setAuthLoading(false);
      if (!user && location.pathname !== "/") {
        navigate("/");
      }
    });
    return () => unsubscribe();
  }, [navigate, location]);


  // ─── MQTT Setup ───
  const [mqttStatus, setMqttStatus] = useState("Disconnected");
  const [lastRFID, setLastRFID] = useState("");
  const mqttClient = useRef<MqttClient | null>(null);
  const rfidHandlerRef = useRef<((uid: string) => void) | null>(null);

  const setRFIDHandler = useCallback((handler: ((uid: string) => void) | null) => {
    rfidHandlerRef.current = handler;
  }, []);

  const publishLCD = useCallback((message: string) => {
    if (mqttClient.current?.connected) {
      mqttClient.current.publish("parasa/pos/lcd", message);
    }
  }, []);

  useEffect(() => {
    const client = mqtt.connect("wss://broker.hivemq.com:8884/mqtt");
    mqttClient.current = client;

    client.on("connect", () => {
      setMqttStatus("Connected");
      client.subscribe("parasa/pos/rfid");
      publishLCD("READY | Scan Card");
    });

    client.on("error", () => setMqttStatus("Error"));
    client.on("close", () => setMqttStatus("Disconnected"));

    client.on("message", (_topic, payload) => {
      const uid = payload.toString();
      setLastRFID(uid);
      if (rfidHandlerRef.current) rfidHandlerRef.current(uid);
    });

    return () => {
      client.end();
    };
  }, [publishLCD]);

  // ─── Logout ───
  const handleLogout = async () => {
    try {
      await logoutUser();
      navigate("/");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  // ─── Mobile Menu ───
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // ─── Role-Based Navigation ───
  const isAdmin = currentUser?.role === "admin";

  const navItems = [
    { to: "/pos", label: "POS", icon: ShoppingBag },
    ...(isAdmin
      ? [
          { to: "/products", label: "Products", icon: Package },
          { to: "/cards", label: "RFID Cards", icon: CreditCard },
          { to: "/dashboard", label: "Dashboard", icon: BarChart3 },
        ]
      : []),
  ];

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span className="text-sm font-medium">Loading...</span>
        </div>
      </div>
    );
  }

  if (!currentUser) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ─── Sidebar (Desktop) ─── */}
      <aside className="hidden lg:flex flex-col fixed left-0 top-0 h-full w-64 bg-white border-r border-slate-200 z-30">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-slate-900">CashlessPay</span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? "bg-blue-50 text-blue-700 border border-blue-200"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 px-4 py-3 mb-3">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center ${isAdmin ? "bg-amber-100" : "bg-slate-100"}`}>
              {isAdmin ? <Shield className="w-4 h-4 text-amber-600" /> : <User className="w-4 h-4 text-slate-500" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">{currentUser.fullName}</p>
              <p className="text-xs text-slate-500 capitalize">{currentUser.role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 rounded-xl transition-all"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ─── Mobile Header ─── */}
      <header className="lg:hidden sticky top-0 z-30 bg-white border-b border-slate-200">
        <div className="flex items-center justify-between px-4 h-16">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <ShoppingBag className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold text-slate-900">CashlessPay</span>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <div className="px-2 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded-md">
                ADMIN
              </div>
            )}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="border-t border-slate-100 bg-white px-4 py-3 space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    isActive ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50"
                  }`
                }
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </NavLink>
            ))}
            <div className="border-t border-slate-100 pt-3 mt-3">
              <div className="flex items-center gap-3 px-4 py-2 mb-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isAdmin ? "bg-amber-100" : "bg-slate-100"}`}>
                  {isAdmin ? <Shield className="w-4 h-4 text-amber-600" /> : <User className="w-4 h-4 text-slate-500" />}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{currentUser.fullName}</p>
                  <p className="text-xs text-slate-500 capitalize">{currentUser.role}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 rounded-xl transition-all"
              >
                <LogOut className="w-5 h-5" />
                Sign Out
              </button>
            </div>
          </div>
        )}
      </header>

      {/* ─── Main Content ─── */}
      <main className="lg:ml-64 p-4 sm:p-6 lg:p-8">
        <Outlet context={{ mqttStatus, lastRFID, publishLCD, setRFIDHandler, currentUser } satisfies RootOutletContext} />
      </main>
    </div>
  );
}