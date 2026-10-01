import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Menu } from "lucide-react";
import Sidebar from "./Sidebar.js";

export default function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Desktop: fixed sidebar */}
      <aside className="hidden md:block print:hidden fixed inset-y-0 left-0 z-40">
        <Sidebar />
      </aside>

      {/* Phone: top bar with a slide-in menu */}
      <header className="md:hidden print:hidden sticky top-0 z-40 bg-white border-b flex items-center gap-3 px-4 py-3">
        <button type="button" onClick={() => setMenuOpen(true)} aria-label="Open menu">
          <Menu size={24} />
        </button>
        <span className="font-bold text-blue-900">Hindustan Electric</span>
      </header>
      {menuOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/40" onClick={() => setMenuOpen(false)}>
          <aside className="h-full w-64" onClick={(event) => event.stopPropagation()}>
            <Sidebar onNavigate={() => setMenuOpen(false)} />
          </aside>
        </div>
      )}

      <main className="md:ml-64 print:ml-0 print:p-0 p-4 md:p-8 max-w-[1400px]">
        <Outlet />
      </main>
    </div>
  );
}
