import React from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.js"; // Import the useAuth hook

// Import your custom icons
import dashboardIcon from "../assets/dashboard.png";
import createUserIcon from "../assets/createUser.png";
import inventoryIcon from "../assets/inventory.png";
import logsIcon from "../assets/logs.png";
import calendarIcon from "../assets/calendar.png";
import invoicesIcon from "../assets/invoices.png";
import logoutIcon from "../assets/logoutIcon.png";
import SuppliersIcon from "../assets/suppliers.png"; // Import the suppliers icon
import newPOIcon from "../assets/newPO.png"; // Import the new purchase order icon
import customersIcon from "../assets/customers.png";
import reportsIcon from "../assets/reports.png"
import paymentIcon from "../assets/payment.png";

// The component no longer needs user and handleLogout as props
function Sidebar() {
  const { user, logout } = useAuth(); // Get user and logout directly from the context

  // Active link style: High contrast background + text
  const linkClass = ({ isActive }) =>
    isActive
      ? "flex items-center gap-3 bg-blue-100 text-blue-800 px-4 py-3 rounded-lg font-bold shadow-sm"
      : "flex items-center gap-3 text-gray-700 px-4 py-3 rounded-lg hover:bg-gray-100 font-medium transition-colors";

  return (
    <div className="fixed top-0 left-0 h-screen bg-white border-r border-gray-300 p-4 flex flex-col w-64 shadow-xl z-50 overflow-y-auto">
      <div className="mb-6 text-center border-b border-gray-100 pb-4">
        <h1 className="text-3xl font-bold tracking-wide text-blue-900" style={{ fontFamily: "Reospec" }}>
          Hindustan Electric
        </h1>
        <p className="text-xs text-gray-500 mt-1 uppercase tracking-wider font-semibold">Inventory System</p>
      </div>

      <nav className="flex flex-col space-y-2 flex-grow">
        <p className="px-4 text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Main</p>
        <NavLink to="/dashboard" className={linkClass}>
          <img src={dashboardIcon} alt="" className="w-6 h-6" />
          <span className="text-lg">Home</span>
        </NavLink>

        <NavLink to="/logs/allot" className={linkClass}>
          <img src={logsIcon} alt="" className="w-6 h-6" />
          <span className="text-lg">Sell Item</span>
        </NavLink>

        <NavLink to="/inventory" className={linkClass}>
          <img src={inventoryIcon} alt="" className="w-6 h-6" />
          <span className="text-lg">Inventory</span>
        </NavLink>

        <NavLink to="/logs" className={linkClass}>
          <img src={logsIcon} alt="" className="w-6 h-6" />
          <span className="text-lg">All Logs</span>
        </NavLink>

        <NavLink to="/calendar" className={linkClass}>
          <img src={calendarIcon} alt="" className="w-6 h-6" />
          <span className="text-lg">Calendar</span>
        </NavLink>

        <NavLink to="/invoices" className={linkClass}>
          <img src={invoicesIcon} alt="" className="w-6 h-6" />
          <span className="text-lg">Invoices</span>
        </NavLink>

        {/* Admin Section */}
        {user?.role === "admin" && (
          <>
            <div className="pt-4 pb-1">
              <p className="px-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Admin Controls</p>
            </div>

            <NavLink to="/purchase-orders" className={linkClass}>
              <img src={newPOIcon} alt="" className="w-6 h-6" />
              <span className="text-lg">Purchase Orders</span>
            </NavLink>

            <NavLink to="/suppliers" className={linkClass}>
              <img src={SuppliersIcon} alt="" className="w-6 h-6" />
              <span className="text-lg">Suppliers</span>
            </NavLink>

            <NavLink to="/customers" className={linkClass}>
              <img src={customersIcon} alt="" className="w-6 h-6" />
              <span className="text-lg">Customers</span>
            </NavLink>

            <NavLink to="/reports/aging" className={linkClass}>
              <img src={reportsIcon} alt="" className="w-6 h-6" />
              <span className="text-lg">Aging Report</span>
            </NavLink>

            <NavLink to="/payments/new" className={linkClass}>
              <img src={paymentIcon} alt="" className="w-6 h-6" />
              <span className="text-lg">Record Payment</span>
            </NavLink>

            <NavLink to="/create-user" className={linkClass}>
              <img src={createUserIcon} alt="" className="w-6 h-6" />
              <span className="text-lg">Create User</span>
            </NavLink>
          </>
        )}
      </nav>

      <div className="mt-6 border-t border-gray-100 pt-4">
        <button
          onClick={logout}
          className="w-full bg-red-50 hover:bg-red-100 text-red-600 font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors border border-red-200"
        >
          <img src={logoutIcon} alt="" className="w-5 h-5" />
          Logout
        </button>
      </div>
    </div>
  );
}

export default Sidebar;
// // src/components/Common/Sidebar.js
// import React from "react";
// import { NavLink } from "react-router-dom";
// // Import your custom icons; adjust the paths as needed.
// import dashboardIcon from "../assets/dashboard.png";
// import createUserIcon from "../assets/createUser.png";
// import inventoryIcon from "../assets/inventory.png";
// import logsIcon from "../assets/logs.png";
// import calendarIcon from "../assets/calendar.png";
// import invoicesIcon from "../assets/invoices.png";
// import logoutIcon from "../assets/logoutIcon.png";

// function Sidebar({ user, handleLogout, sidebarCollapsed, setSidebarCollapsed }) {
//   // Function to apply active class styles for nav links.
//   const linkClass = ({ isActive }) =>
//     isActive ? "flex items-center gap-2 text-yellow-500" : "flex items-center gap-2 text-gray-800";

//   return (
//     <div
//       className={`fixed top-0 left-0 h-screen bg-white border-r border-gray-300 p-4 transition-all duration-300 flex flex-col ${
//         sidebarCollapsed ? "w-16" : "w-64"
//       }`}
//     >
//       {/* Brand Header: Shown only when expanded */}
//       {!sidebarCollapsed && (
//         <div className="mb-8 text-center">
//           <h1 className="text-2xl font-bold tracking-wide uppercase" style={{ fontFamily: "Reospec", color: "#333" }}>
//             Hindustan Electric
//           </h1>
//         </div>
//       )}

//       {/* Toggle Button */}
//       <div className="flex justify-end mb-4">
//         <button
//           onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
//           className="p-2 focus:outline-none"
//         >
//           {sidebarCollapsed ? "→" : "←"}
//         </button>
//       </div>

//       {/* Navigation Links */}
//       <nav className="flex flex-col space-y-4 flex-grow">
//         <NavLink to="/dashboard" className={linkClass}>
//           <img src={dashboardIcon} alt="Dashboard" className="w-6 h-6" />
//           {!sidebarCollapsed && <span>Home</span>}
//         </NavLink>
//         {user?.role === "admin" && (
//           <NavLink to="/create-user" className={linkClass}>
//             <img src={createUserIcon} alt="Create User" className="w-6 h-6" />
//             {!sidebarCollapsed && <span>Create User</span>}
//           </NavLink>
//         )}
//         <NavLink to="/inventory" className={linkClass}>
//           <img src={inventoryIcon} alt="Inventory" className="w-6 h-6" />
//           {!sidebarCollapsed && <span>Inventory</span>}
//         </NavLink>
//         <NavLink to="/logs" className={linkClass}>
//           <img src={logsIcon} alt="Logs" className="w-6 h-6" />
//           {!sidebarCollapsed && <span>Logs</span>}
//         </NavLink>
//         <NavLink to="/calendar" className={linkClass}>
//           <img src={calendarIcon} alt="Calendar" className="w-6 h-6" />
//           {!sidebarCollapsed && <span>Calendar</span>}
//         </NavLink>
//         <NavLink to="/invoices" className={linkClass}>
//           <img src={invoicesIcon} alt="Invoices" className="w-6 h-6" />
//           {!sidebarCollapsed && <span>Invoices</span>}
//         </NavLink>
//       </nav>

//       {/* Logout Button at Bottom */}
//       <div className="mt-auto">
//         {sidebarCollapsed ? (
//           <button
//             onClick={handleLogout}
//             className="p-2 focus:outline-none"
//           >
//             <img src={logoutIcon} alt="Logout" className="w-12 h-6" />
//           </button>
//         ) : (
//           <button
//             onClick={handleLogout}
//             className="w-full bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-md focus:outline-none"
//           >
//             Logout
//           </button>
//         )}
//       </div>
//     </div>
//   );
// }

// export default Sidebar;
