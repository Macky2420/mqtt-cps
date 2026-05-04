import { Outlet, NavLink } from "react-router";
import { ShoppingCart, Package, CreditCard, BarChart3, Menu, X } from "lucide-react";
import { useState } from "react";

export function Root() {
  const [open, setOpen] = useState(false);

  const linkClass = (isActive: boolean) =>
    `flex items-center gap-2 px-4 py-3 border-b transition-colors ${
      isActive
        ? "text-blue-600 font-semibold"
        : "text-gray-600 hover:text-gray-900"
    }`;

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      
      {/* HEADER */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <h1 className="font-bold text-gray-900">Canteen POS</h1>

          {/* 🔥 Hamburger Button (mobile only) */}
          <button
            className="sm:hidden"
            onClick={() => setOpen(!open)}
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </header>

      {/* DESKTOP NAV */}
      <nav className="hidden sm:block bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 flex gap-4">
          <NavLink to="/" end className={({ isActive }) => linkClass(isActive)}>
            <ShoppingCart /> Order
          </NavLink>
          <NavLink to="/products" className={({ isActive }) => linkClass(isActive)}>
            <Package /> Products
          </NavLink>
          <NavLink to="/cards" className={({ isActive }) => linkClass(isActive)}>
            <CreditCard /> Cards
          </NavLink>
          <NavLink to="/dashboard" className={({ isActive }) => linkClass(isActive)}>
            <BarChart3 /> Dashboard
          </NavLink>
        </div>
      </nav>

      {/* 🔥 MOBILE NAV (dropdown) */}
      {open && (
        <nav className="sm:hidden bg-white border-b">
          <NavLink onClick={() => setOpen(false)} to="/" end className={({ isActive }) => linkClass(isActive)}>
            <ShoppingCart /> Order
          </NavLink>
          <NavLink onClick={() => setOpen(false)} to="/products" className={({ isActive }) => linkClass(isActive)}>
            <Package /> Products
          </NavLink>
          <NavLink onClick={() => setOpen(false)} to="/cards" className={({ isActive }) => linkClass(isActive)}>
            <CreditCard /> Cards
          </NavLink>
          <NavLink onClick={() => setOpen(false)} to="/dashboard" className={({ isActive }) => linkClass(isActive)}>
            <BarChart3 /> Dashboard
          </NavLink>
        </nav>
      )}

      {/* CONTENT */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}