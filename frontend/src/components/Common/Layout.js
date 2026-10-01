import { useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, Home, LayoutGrid, LogOut, Plus } from "lucide-react";
import { useAuth } from "../../context/AuthContext.js";
import ItemSearch from "../ItemSearch.js";

/**
 * One short bar on every screen: shop name, find an item, Home, New Bill, and More — so Home is always
 * one press away. Everything that isn't needed every hour lives on the More page, not in a menu.
 */
function TopBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [accountOpen, setAccountOpen] = useState(false);
  const onBilling = pathname === "/billing";

  return (
    <header className="print:hidden sticky top-0 z-40 bg-white border-b border-gray-200">
      <div className="max-w-[1200px] mx-auto px-4 md:px-6 py-3 flex items-center gap-2 sm:gap-3 md:gap-4">
        {/* On a phone the Home button takes the name's place. */}
        <Link to="/dashboard" className="hidden sm:block mr-auto lg:mr-2 shrink-0 leading-tight">
          <span className="block text-xl md:text-2xl font-bold text-gray-900">Hindustan Electric</span>
          <span className="hidden md:block text-sm text-gray-500">Muzaffarpur</span>
        </Link>

        {/* On the bill screen the big scan box is the search, so don't show two. */}
        {onBilling ? (
          <div className="flex-1 hidden lg:block" />
        ) : (
          <div className="flex-1 min-w-0 hidden lg:block">
            <ItemSearch
              compact
              autoFocus={false}
              label="Find an item"
              placeholder="Find an item — type its name or scan the barcode"
              onSelect={(item) => navigate(`/items/${item.id}`)}
            />
          </div>
        )}

        <NavLink
          to="/dashboard"
          className={({ isActive }) =>
            `mr-auto sm:mr-0 shrink-0 inline-flex items-center gap-2 h-12 px-3 md:px-4 rounded-xl border-2 border-blue-800 text-blue-800 font-bold ${
              isActive ? "bg-blue-50" : "bg-white hover:bg-blue-50"
            }`
          }
        >
          <Home size={22} /> Home
        </NavLink>
        <NavLink
          to="/billing"
          className="shrink-0 inline-flex items-center gap-1.5 h-12 px-3 sm:px-4 md:px-5 rounded-xl bg-green-700 hover:bg-green-800 text-white sm:text-lg font-semibold"
        >
          <Plus size={20} strokeWidth={2.5} /> New Bill
        </NavLink>
        <NavLink
          to="/more"
          aria-label="More — all options"
          className={({ isActive }) =>
            `shrink-0 inline-flex items-center gap-2 h-12 px-3 md:px-4 rounded-xl border font-semibold ${
              isActive ? "border-blue-800 bg-blue-50 text-blue-800 border-2" : "border-gray-300 bg-white text-gray-900 hover:bg-gray-50"
            }`
          }
        >
          <LayoutGrid size={20} /> <span className="hidden sm:inline">More</span>
        </NavLink>

        <div className="relative hidden md:block shrink-0">
          <button
            type="button"
            aria-expanded={accountOpen}
            onClick={() => setAccountOpen(!accountOpen)}
            onBlur={() => setTimeout(() => setAccountOpen(false), 150)}
            className="inline-flex items-center gap-1 h-12 px-3 rounded-xl text-gray-700 hover:bg-gray-100 font-semibold"
          >
            {user?.role === "owner" ? "Owner" : "Staff"} <ChevronDown size={18} />
          </button>
          {accountOpen && (
            <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-xl shadow-lg p-1">
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={logout}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-red-700 font-semibold hover:bg-red-50"
              >
                <LogOut size={18} /> Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default function Layout() {
  return (
    <div className="min-h-screen">
      <TopBar />
      <main className="max-w-[1200px] mx-auto px-4 md:px-6 py-6 md:py-8 print:p-0 print:max-w-none">
        <Outlet />
      </main>
    </div>
  );
}
