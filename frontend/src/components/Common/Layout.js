import { useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, Home, LayoutGrid, LogOut, Plus } from "lucide-react";
import { useAuth } from "../../context/AuthContext.js";
import { PageProvider, useCurrentPage } from "../../hooks/usePage.js";
import { useGoBack } from "../../hooks/useTrail.js";
import { A } from "../../lib/access.js";
import { BackLink } from "../../ui/index.js";
import ItemSearch from "../ItemSearch.js";

const barButton = (active) =>
  `shrink-0 inline-flex items-center gap-1.5 h-11 px-3 md:px-3.5 rounded-lg font-semibold ${
    active ? "bg-white text-steel-800" : "border border-steel-500 text-white hover:bg-steel-700"
  }`;

/**
 * One slim dark bar on every screen: shop name, find an item, Home, New Bill and More — so Home is always
 * one press away. Everything that isn't needed every hour lives on the More page, not in a menu.
 */
function TopBar() {
  const { user, logout, can, isOwner } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [accountOpen, setAccountOpen] = useState(false);
  const onBilling = pathname === "/billing";

  return (
    <header className="print:hidden sticky top-0 z-40 bg-steel-800 text-white">
      <div className="max-w-[1200px] mx-auto px-4 md:px-6 py-2.5 flex items-center gap-2 sm:gap-3">
        {/* On a phone the Home button takes the name's place. */}
        <Link to="/dashboard" className="hidden sm:block mr-auto lg:mr-2 shrink-0 leading-tight text-white">
          <span className="block text-xl font-bold">Hindustan Electric</span>
          <span className="hidden md:block text-sm text-steel-200">Muzaffarpur</span>
        </Link>

        {/* On the bill screen the big scan box is the search, so don't show two. */}
        {onBilling ? (
          <div className="flex-1 hidden lg:block" />
        ) : (
          <div className="flex-1 min-w-0 hidden lg:block">
            <ItemSearch
              compact
              tone="dark"
              autoFocus={false}
              label="Find an item"
              placeholder="Find an item — name or barcode"
              onSelect={(item) => navigate(`/items/${item.id}`)}
              cameraKeepsOpen={false}
            />
          </div>
        )}

        <NavLink to="/dashboard" className={({ isActive }) => `mr-auto sm:mr-0 ${barButton(isActive)}`}>
          <Home size={20} /> Home
        </NavLink>
        {can(A.BILLING) && (
          <NavLink
            to="/billing"
            className={({ isActive }) =>
              `shrink-0 inline-flex items-center gap-1.5 h-11 px-3 sm:px-4 rounded-lg font-bold ${
                isActive ? "bg-white text-green-800" : "bg-green-700 hover:bg-green-600 text-white"
              }`
            }
          >
            <Plus size={20} strokeWidth={2.5} /> New Bill
          </NavLink>
        )}
        <NavLink to="/more" aria-label="More — all options" className={({ isActive }) => barButton(isActive)}>
          <LayoutGrid size={19} /> <span className="hidden sm:inline">More</span>
        </NavLink>

        <div className="relative hidden md:block shrink-0">
          <button
            type="button"
            aria-expanded={accountOpen}
            onClick={() => setAccountOpen(!accountOpen)}
            onBlur={() => setTimeout(() => setAccountOpen(false), 150)}
            className="inline-flex items-center gap-1 h-11 px-2.5 rounded-lg text-steel-100 hover:bg-steel-700 font-semibold"
          >
            {user?.name || (isOwner ? "Owner" : "Staff")} <ChevronDown size={18} />
          </button>
          {accountOpen && (
            <div className="absolute right-0 mt-1 w-48 bg-white border border-line rounded-lg shadow-lg p-1">
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={logout}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-md text-red-700 font-semibold hover:bg-red-50"
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

/**
 * "Home › Old Bills" — always just two steps, so it never sends anyone the long way round — and, when you
 * came from somewhere other than Home, "Back to …" on the right (it goes where you came from).
 */
function TrailBar() {
  const page = useCurrentPage();
  const back = page?.back;
  const go = useGoBack(back?.[0] ?? "/dashboard", back?.[1] ?? "Home");
  const onHome = !page || page.title === "Home";
  return (
    <nav aria-label="You are here" className="print:hidden bg-steel-100 border-b border-steel-200">
      <div className="max-w-[1200px] mx-auto px-4 md:px-6 min-h-[40px] py-1 flex flex-wrap items-center justify-between gap-x-4 text-[15px] text-gray-700">
        <p>
          {onHome ? (
            "Home"
          ) : (
            <>
              <Link to="/dashboard" className="text-blue-800 font-semibold hover:underline">
                Home
              </Link>
              <span aria-hidden="true"> › </span>
              {page.title}
            </>
          )}
        </p>
        {back && go.label !== "Home" && <BackLink to={back[0]}>{back[1]}</BackLink>}
      </div>
    </nav>
  );
}

export default function Layout() {
  return (
    <PageProvider>
      <div className="min-h-screen">
        <TopBar />
        <TrailBar />
        <main className="max-w-[1200px] mx-auto px-4 md:px-6 py-5 md:py-6 print:p-0 print:max-w-none">
          <Outlet />
        </main>
      </div>
    </PageProvider>
  );
}
