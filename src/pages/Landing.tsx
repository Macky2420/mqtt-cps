import React, { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  CreditCard,
  ShoppingCart,
  BarChart3,
  Wifi,
  Lock,
  User,
  Hash,
  PhilippinePeso,
  Eye,
  EyeOff,
  Loader2,
  X,
  LogIn,
  UserPlus,
  Fingerprint,
  Keyboard,
  Zap,
  Mail,
  Radio,
} from "lucide-react";
import { notification } from "antd";
import mqtt from "mqtt";
import type { MqttClient } from "mqtt";
import {
  registerUser,
  loginUser,
  getCurrentUser,
  findCardByNumber,
  type AppUser,
} from "../utils/storage";

const useNotify = () => {
  const [api, contextHolder] = notification.useNotification();
  const notify = useCallback(
    (type: "success" | "error" | "info" | "warning", title: string, description?: string) => {
      const config = { title, description, placement: "topRight" as const };
      if (type === "success") api.success(config);
      else if (type === "error") api.error(config);
      else if (type === "warning") api.warning(config);
      else api.info(config);
    },
    [api]
  );
  return { notify, contextHolder };
};

export function Landing() {
  const navigate = useNavigate();
  const { notify, contextHolder } = useNotify();

  // ─── Check if already logged in ───
  useEffect(() => {
    const unsubscribe = getCurrentUser((user) => {
      if (user) {
        navigate("/pos");
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  // ─── Login form ───
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);

  // ─── Register form ───
  const [registerForm, setRegisterForm] = useState({
    fullName: "",
    email: "",
    password: "",
    rfidNumber: "",
    initialBalance: "",
  });
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [rfidInputMode, setRfidInputMode] = useState<"tap" | "manual">("tap");
  const [listeningForRFID, setListeningForRFID] = useState(false);

  // ─── MQTT for real RFID ───
  const mqttClientRef = useRef<MqttClient | null>(null);
  const rfidTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup MQTT on unmount
  useEffect(() => {
    return () => {
      if (mqttClientRef.current) {
        mqttClientRef.current.end();
        mqttClientRef.current = null;
      }
      if (rfidTimeoutRef.current) {
        clearTimeout(rfidTimeoutRef.current);
      }
    };
  }, []);

  // ─── Start listening for real RFID from ESP32 ───
  const startRealRFIDListening = () => {
    setListeningForRFID(true);
    notify("info", "RFID Reader Active", "Tap your card on the ESP32 reader now...");

    const client = mqtt.connect("wss://broker.hivemq.com:8884/mqtt");
    mqttClientRef.current = client;

    client.on("connect", () => {
      client.subscribe("parasa/pos/rfid");
    });

    client.on("message", (_topic: string, payload: Buffer) => {
      const uid = payload.toString().trim().toUpperCase();

      // Stop listening
      setListeningForRFID(false);
      if (mqttClientRef.current) {
        mqttClientRef.current.end();
        mqttClientRef.current = null;
      }
      if (rfidTimeoutRef.current) {
        clearTimeout(rfidTimeoutRef.current);
        rfidTimeoutRef.current = null;
      }

      // Fill the form
      setRegisterForm((prev) => ({ ...prev, rfidNumber: uid }));
      notify("success", "RFID Card Detected!", `UID: ${uid}`);
    });

    client.on("error", (err) => {
      console.error("MQTT error:", err);
      notify("error", "RFID Reader Error", "Could not connect to reader.");
      stopRFIDListening();
    });

    // Timeout after 30 seconds
    rfidTimeoutRef.current = setTimeout(() => {
      if (mqttClientRef.current) {
        mqttClientRef.current.end();
        mqttClientRef.current = null;
      }
      setListeningForRFID(false);
      notify("warning", "RFID Timeout", "No card detected. Please try again.");
    }, 30000);
  };

  // ─── Stop listening ───
  const stopRFIDListening = () => {
    if (mqttClientRef.current) {
      mqttClientRef.current.end();
      mqttClientRef.current = null;
    }
    if (rfidTimeoutRef.current) {
      clearTimeout(rfidTimeoutRef.current);
      rfidTimeoutRef.current = null;
    }
    setListeningForRFID(false);
  };

  // ─── Handle Login ───
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loggingIn) return;

    const { email, password } = loginForm;
    if (!email.trim() || !password.trim()) {
      notify("warning", "Missing fields", "Please enter both email and password.");
      return;
    }

    setLoggingIn(true);
    try {
      const user = await loginUser(email, password);
      notify("success", `Welcome back, ${user.fullName}!`, `Role: ${user.role}`);
      setShowLoginModal(false);
      navigate("/pos");
    } catch (error: any) {
      console.error("Login error:", error);
      notify("error", "Login failed", error.message || "Invalid credentials.");
    } finally {
      setLoggingIn(false);
    }
  };

  // ─── Handle Register ───
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (registering) return;

    const { fullName, email, password, rfidNumber, initialBalance } = registerForm;

    if (!fullName.trim() || !email.trim() || !password.trim()) {
      notify("warning", "Missing fields", "Please fill in all required fields.");
      return;
    }

    if (!rfidNumber.trim()) {
      notify("warning", "RFID required", "Please tap or enter your RFID card number.");
      return;
    }

    const balance = Number(initialBalance);
    if (isNaN(balance) || balance < 0) {
      notify("warning", "Invalid balance", "Please enter a valid initial balance.");
      return;
    }

    // Check if RFID already exists
    const existingCard = await findCardByNumber(rfidNumber.trim().toUpperCase());
    if (existingCard) {
      notify("error", "RFID already registered", "This card is already in the system.");
      return;
    }

    setRegistering(true);
    try {
      await registerUser(email, password, fullName, rfidNumber.trim(), balance);
      notify("success", "Registration successful!", `Welcome, ${fullName}! Your card is ready.`);
      setShowRegisterModal(false);
      setRegisterForm({ fullName: "", email: "", password: "", rfidNumber: "", initialBalance: "" });
      navigate("/pos");
    } catch (error: any) {
      console.error("Registration error:", error);
      notify("error", "Registration failed", error.message || "Could not create account.");
    } finally {
      setRegistering(false);
    }
  };

  // ─── Close modals ───
  const closeLoginModal = () => {
    if (loggingIn) return;
    setShowLoginModal(false);
    setLoginForm({ email: "", password: "" });
  };

  const closeRegisterModal = () => {
    if (registering) return;
    setShowRegisterModal(false);
    stopRFIDListening();
    setRegisterForm({ fullName: "", email: "", password: "", rfidNumber: "", initialBalance: "" });
  };

  // ─── Features for landing page ───
  const features = [
    { icon: CreditCard, title: "RFID Payments", description: "Quick and secure contactless payments using RFID cards.", color: "text-blue-600", bg: "bg-blue-50" },
    { icon: ShoppingCart, title: "Easy Ordering", description: "Browse products and add them to your cart seamlessly.", color: "text-emerald-600", bg: "bg-emerald-50" },
    { icon: BarChart3, title: "Real-time Dashboard", description: "Track sales, income, and transactions in real-time.", color: "text-violet-600", bg: "bg-violet-50" },
    { icon: Wifi, title: "IoT Connected", description: "Connected to RFID readers via MQTT for instant response.", color: "text-amber-600", bg: "bg-amber-50" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {contextHolder}

      {/* ═══════════════════════════════════════════
          NAVBAR
         ═══════════════════════════════════════════ */}
      <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-slate-900">CashlessPay</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowLoginModal(true)}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all"
              >
                Sign In
              </button>
              <button
                onClick={() => setShowRegisterModal(true)}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-lg shadow-blue-200"
              >
                Get Started
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* ═══════════════════════════════════════════
          HERO SECTION
         ═══════════════════════════════════════════ */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-24">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-full text-sm font-medium text-blue-700 mb-6">
            <Wifi className="w-4 h-4" />
            RFID-Powered Canteen System
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight mb-6">
            Smart Cashless<span className="text-blue-600"> Payments</span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-600 mb-10 leading-relaxed">
            A modern, contactless payment solution for your school canteen.
            Tap your RFID card and go — no cash, no hassle.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => setShowRegisterModal(true)}
              className="w-full sm:w-auto px-8 py-4 bg-blue-600 text-white font-semibold rounded-2xl hover:bg-blue-700 active:scale-[0.98] transition-all shadow-xl shadow-blue-200 flex items-center justify-center gap-2"
            >
              <UserPlus className="w-5 h-5" />
              Create Account
            </button>
            <button
              onClick={() => setShowLoginModal(true)}
              className="w-full sm:w-auto px-8 py-4 bg-white text-slate-700 font-semibold rounded-2xl border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <LogIn className="w-5 h-5" />
              Sign In
            </button>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          FEATURES GRID
         ═══════════════════════════════════════════ */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((f) => (
            <div
              key={f.title}
              className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group"
            >
              <div
                className={`w-12 h-12 ${f.bg} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}
              >
                <f.icon className={`w-6 h-6 ${f.color}`} />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">{f.title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          FOOTER
         ═══════════════════════════════════════════ */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-sm text-slate-500">
            CashlessPay — RFID Canteen Payment System
          </div>
        </div>
      </footer>

      {/* ═══════════════════════════════════════════════════
          LOGIN MODAL
         ═══════════════════════════════════════════════════ */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
            onClick={closeLoginModal}
          />
          <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
            <div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md pointer-events-auto animate-in fade-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Lock className="w-5 h-5 text-blue-600" />
                    Sign In
                  </h3>
                  <p className="text-sm text-slate-500 mt-0.5">
                    Welcome back! Enter your credentials.
                  </p>
                </div>
                <button
                  onClick={closeLoginModal}
                  disabled={loggingIn}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleLogin} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="email"
                      value={loginForm.email}
                      onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      placeholder="user@example.com"
                      required
                      autoFocus
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type={showLoginPassword ? "text" : "password"}
                      value={loginForm.password}
                      onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                      className="w-full pl-10 pr-11 py-2.5 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      placeholder="Enter password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-md transition-colors"
                    >
                      {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeLoginModal}
                    disabled={loggingIn}
                    className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loggingIn}
                    className="flex-1 px-4 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                  >
                    {loggingIn ? (
                      <><Loader2 className="w-4 h-4 animate-spin" />Signing in...</>
                    ) : (
                      <><LogIn className="w-4 h-4" />Sign In</>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════
          REGISTER MODAL
         ═══════════════════════════════════════════════════ */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
            onClick={closeRegisterModal}
          />
          <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
            <div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg pointer-events-auto animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <UserPlus className="w-5 h-5 text-emerald-600" />
                    Create Account
                  </h3>
                  <p className="text-sm text-slate-500 mt-0.5">
                    Register your RFID card and start paying cashless.
                  </p>
                </div>
                <button
                  onClick={closeRegisterModal}
                  disabled={registering}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleRegister} className="p-6 space-y-4">
                {/* Full Name */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={registerForm.fullName}
                      onChange={(e) => setRegisterForm({ ...registerForm, fullName: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                      placeholder="Juan Dela Cruz"
                      required
                      autoFocus
                    />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="email"
                      value={registerForm.email}
                      onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                      placeholder="juan@example.com"
                      required
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type={showRegisterPassword ? "text" : "password"}
                      value={registerForm.password}
                      onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                      className="w-full pl-10 pr-11 py-2.5 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                      placeholder="Min 6 characters"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-md transition-colors"
                    >
                      {showRegisterPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* ═══ RFID CARD SECTION ═══ */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    RFID Card
                  </label>

                  {/* Toggle: Tap vs Manual */}
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <button
                      type="button"
                      onClick={() => {
                        setRfidInputMode("tap");
                        stopRFIDListening();
                      }}
                      className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 font-medium text-sm transition-all ${
                        rfidInputMode === "tap"
                          ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      <Fingerprint className="w-4 h-4" />
                      Tap Card
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRfidInputMode("manual");
                        stopRFIDListening();
                        setRegisterForm((prev) => ({ ...prev, rfidNumber: "" }));
                      }}
                      className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 font-medium text-sm transition-all ${
                        rfidInputMode === "manual"
                          ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      <Keyboard className="w-4 h-4" />
                      Manual Input
                    </button>
                  </div>

                  {/* REAL RFID TAP or MANUAL INPUT */}
                  {rfidInputMode === "tap" ? (
                    <button
                      type="button"
                      onClick={listeningForRFID ? stopRFIDListening : startRealRFIDListening}
                      disabled={registering}
                      className={`w-full py-3 rounded-xl border-2 border-dashed font-medium text-sm transition-all flex items-center justify-center gap-2 ${
                        registerForm.rfidNumber
                          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                          : listeningForRFID
                          ? "animate-pulse border-emerald-400 text-emerald-600 bg-emerald-50"
                          : "border-slate-300 text-slate-500 hover:border-emerald-400 hover:text-emerald-600"
                      }`}
                    >
                      {listeningForRFID ? (
                        <>
                          <Radio className="w-4 h-4 animate-pulse" />
                          Listening... Tap card or click to cancel
                        </>
                      ) : registerForm.rfidNumber ? (
                        <>
                          <Fingerprint className="w-4 h-4" />
                          <span className="font-mono tracking-wider">{registerForm.rfidNumber}</span>
                        </>
                      ) : (
                        <>
                          <Fingerprint className="w-4 h-4" />
                          Tap your card on the ESP32 reader
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="relative">
                      <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        value={registerForm.rfidNumber}
                        onChange={(e) =>
                          setRegisterForm({ ...registerForm, rfidNumber: e.target.value.toUpperCase() })
                        }
                        className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 font-mono uppercase focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                        placeholder="Enter RFID number (e.g. 257B78E0)"
                        required
                      />
                    </div>
                  )}

                  {/* Status indicator when listening */}
                  {listeningForRFID && (
                    <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1.5">
                      <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                      ESP32 reader connected via MQTT — waiting for card tap...
                    </p>
                  )}
                </div>

                {/* Initial Balance */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Initial Balance (₱)
                  </label>
                  <div className="relative">
                    <PhilippinePeso className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="number"
                      value={registerForm.initialBalance}
                      onChange={(e) => setRegisterForm({ ...registerForm, initialBalance: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                      placeholder="100"
                      min="0"
                      step="1"
                      required
                    />
                  </div>
                </div>

                {/* Buttons */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeRegisterModal}
                    disabled={registering}
                    className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={registering}
                    className="flex-1 px-4 py-2.5 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                  >
                    {registering ? (
                      <><Loader2 className="w-4 h-4 animate-spin" />Creating account...</>
                    ) : (
                      <><UserPlus className="w-4 h-4" />Create Account</>
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