import { NavLink } from "react-router-dom";
import {
  Building2,
  ClipboardCheck,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  LayoutDashboard,
  LogOut,
  Package,
  Receipt,
  SlidersHorizontal,
  Truck,
  UserPlus,
  Users,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext.js";
import { BACK_OFFICE_URL } from "../../api.js";

const MAIN = [
  ["/dashboard", "Home", LayoutDashboard],
  ["/billing", "Billing", Receipt],
  ["/bills", "Bills", FileText],
  ["/customers", "Customers & khata", Users],
  ["/items", "Items", Package],
  ["/purchases", "Purchases", Truck],
  ["/counts", "Stock counts", ClipboardCheck],
  ["/suppliers", "Suppliers", Building2],
];

const OWNER = [
  ["/adjustments", "Adjustments", SlidersHorizontal],
  ["/import", "Import from Excel", FileSpreadsheet],
  ["/create-user", "Add user", UserPlus],
];

const linkClass = ({ isActive }) =>
  `flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-colors ${
    isActive ? "bg-blue-100 text-blue-900 font-bold" : "text-gray-700 hover:bg-gray-100"
  }`;

export default function Sidebar({ onNavigate }) {
  const { user, logout } = useAuth();
  const isOwner = user?.role === "owner";

  return (
    <div className="h-full bg-white border-r border-gray-200 p-4 flex flex-col w-64 overflow-y-auto">
      <div className="mb-6 text-center border-b border-gray-100 pb-4">
        <h1 className="text-3xl font-bold tracking-wide text-blue-900" style={{ fontFamily: "Reospec" }}>
          Hindustan Electric
        </h1>
        <p className="text-xs text-gray-500 mt-1 uppercase tracking-wider font-semibold">Shop system</p>
      </div>

      <nav className="flex flex-col gap-1 flex-grow" onClick={onNavigate}>
        {MAIN.map(([to, label, Icon]) => (
          <NavLink key={to} to={to} className={linkClass}>
            <Icon size={20} />
            {label}
          </NavLink>
        ))}

        {isOwner && (
          <>
            <p className="px-3 pt-5 pb-1 text-xs font-bold text-gray-400 uppercase tracking-wider">Owner</p>
            {OWNER.map(([to, label, Icon]) => (
              <NavLink key={to} to={to} className={linkClass}>
                <Icon size={20} />
                {label}
              </NavLink>
            ))}
            <a href={BACK_OFFICE_URL} target="_blank" rel="noreferrer" className={linkClass({ isActive: false })}>
              <ExternalLink size={20} />
              Back office
            </a>
          </>
        )}
      </nav>

      <div className="mt-6 border-t border-gray-100 pt-4">
        <p className="text-sm text-gray-500 mb-2 px-1">Signed in as {isOwner ? "owner" : "staff"}</p>
        <button
          type="button"
          onClick={logout}
          className="w-full bg-red-50 hover:bg-red-100 text-red-700 font-bold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 border border-red-200"
        >
          <LogOut size={18} />
          Log out
        </button>
      </div>
    </div>
  );
}
