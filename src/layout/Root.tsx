import { Outlet, NavLink } from "react-router";
import {
  ShoppingCart,
  Package,
  CreditCard,
  BarChart3,
  Menu,
  X,
  Store,
} from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import mqtt from "mqtt";

const NAV_ITEMS = [
  { to: "/", icon: ShoppingCart, label: "Order", end: true },
  { to: "/products", icon: Package, label: "Products", end: false },
  { to: "/cards", icon: CreditCard, label: "Cards", end: false },
  { to: "/dashboard", icon: BarChart3, label: "Dashboard", end: false },
];

const MQTT_BROKER_URL = "wss://broker.hivemq.com:8884/mqtt";

const TOPIC_RFID = "parasa/pos/rfid";
const TOPIC_LCD = "parasa/pos/lcd";

export type MqttStatus = "Connected" | "Disconnected" | "Error";

export type RootOutletContext = {
  mqttStatus: MqttStatus;
  lastRFID: string;
  publishLCD: (message: string) => void;
  setRFIDHandler: (handler: ((uid: string) => void) | null) => void;
};

export function Root() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const [mqttStatus, setMqttStatus] = useState<MqttStatus>("Disconnected");
  const [lastRFID, setLastRFID] = useState("");

  const mqttClientRef = useRef<mqtt.MqttClient | null>(null);
  const rfidHandlerRef = useRef<((uid: string) => void) | null>(null);

  const lastUIDRef = useRef("");
  const lastScanTimeRef = useRef(0);

  const setRFIDHandler = useCallback(
    (handler: ((uid: string) => void) | null) => {
      rfidHandlerRef.current = handler;
    },
    []
  );

  const publishLCD = useCallback((message: string) => {
    if (mqttClientRef.current?.connected) {
      mqttClientRef.current.publish(TOPIC_LCD, message);
    }
  }, []);

  useEffect(() => {
    const client = mqtt.connect(MQTT_BROKER_URL, {
      clientId: "react-pos-root-" + Math.random().toString(16).slice(2),
      clean: true,
      reconnectPeriod: 2000,
      connectTimeout: 10000,
    });

    mqttClientRef.current = client;

    client.on("connect", () => {
      setMqttStatus("Connected");

      client.subscribe(TOPIC_RFID, (error) => {
        if (error) {
          console.error("MQTT subscribe error:", error);
          setMqttStatus("Error");
          return;
        }

        console.log("Subscribed to:", TOPIC_RFID);
      });

      console.log("MQTT connected from Root");
    });

    client.on("reconnect", () => {
      setMqttStatus("Disconnected");
      console.log("MQTT reconnecting...");
    });

    client.on("message", (_topic, message) => {
      const uid = message.toString().trim().toUpperCase();
      const now = Date.now();

      if (!/^[A-F0-9]{8,}$/.test(uid)) {
        console.warn("Invalid RFID UID:", uid);
        return;
      }

      if (uid === lastUIDRef.current && now - lastScanTimeRef.current < 2000) {
        console.log("Duplicate RFID ignored:", uid);
        return;
      }

      lastUIDRef.current = uid;
      lastScanTimeRef.current = now;

      setLastRFID(uid);
      console.log("RFID received:", uid);

      if (rfidHandlerRef.current) {
        rfidHandlerRef.current(uid);
      }
    });

    client.on("error", (error) => {
      console.error("MQTT error:", error);
      setMqttStatus("Error");
    });

    client.on("close", () => {
      setMqttStatus("Disconnected");
    });

    return () => {
      client.end(true);
      mqttClientRef.current = null;
    };
  }, []);

  useEffect(() => {
    const handleResize = () => window.innerWidth >= 640 && setOpen(false);
    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 4);
    window.addEventListener("scroll", handleScroll);

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      <header
        className={`
          sticky top-0 z-50 bg-white transition-shadow duration-200
          ${scrolled ? "shadow-md" : "shadow-sm"}
        `}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex justify-between items-center h-14 sm:h-16">
            <div className="flex items-center gap-2.5">
              <div className="bg-blue-600 text-white p-1.5 rounded-lg">
                <Store size={20} strokeWidth={2.5} />
              </div>

              <h1 className="font-bold text-lg sm:text-xl text-slate-900 tracking-tight">
                Cashless PS
              </h1>
            </div>

            <nav className="hidden sm:flex items-center gap-1">
              {NAV_ITEMS.map(({ to, icon: Icon, label, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) => `
                    flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                    transition-all duration-200
                    ${
                      isActive
                        ? "bg-blue-50 text-blue-700"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }
                  `}
                >
                  <Icon size={18} />
                  <span>{label}</span>
                </NavLink>
              ))}
            </nav>

            <button
              onClick={() => setOpen(!open)}
              className="sm:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 
              active:bg-slate-200 transition-colors"
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
            >
              {open ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </header>

      <div
        className={`
          sm:hidden fixed inset-x-0 top-14 z-40 bg-white shadow-lg
          transition-all duration-300 ease-in-out overflow-hidden
          ${open ? "max-h-96 opacity-100" : "max-h-0 opacity-0"}
        `}
      >
        <nav className="px-4 py-2 space-y-1 border-b border-slate-100">
          {NAV_ITEMS.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setOpen(false)}
              className={({ isActive }) => `
                flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium
                transition-colors duration-200
                ${
                  isActive
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-600 hover:bg-slate-50"
                }
              `}
            >
              <Icon size={20} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      {open && (
        <div
          className="sm:hidden fixed inset-0 z-30 bg-black/20 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <Outlet
            context={{
              mqttStatus,
              lastRFID,
              publishLCD,
              setRFIDHandler,
            }}
          />
        </div>
      </main>
    </div>
  );
}