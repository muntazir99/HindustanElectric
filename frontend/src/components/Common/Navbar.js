// src/components/Common/Navbar.js
import React from "react";
import { NavLink } from "react-router-dom";

function Navbar({ user, handleLogout }) {
  // Function to apply active class styles
  const linkClass = ({ isActive }) =>
    isActive ? "text-yellow-500" : "text-gray-800";

  return (
    <nav className="relative py-4 px-6 w-full max-w-7xl mx-auto mb-8 bg-white border border-gray-300 rounded-md shadow-sm">
      {/* Brand in top-left */}
      <div className="absolute top-0 left-0 px-6 py-4">
        <h1
          className="text-2xl font-bold"
          style={{ fontFamily: "Reospec", color: "#333" }}
        >
          Hindustan Electric
        </h1>
      </div>

      {/* Center: Navigation Links */}
      <div className="flex justify-center space-x-6 mt-4">
        <NavLink to="/dashboard" className={linkClass}>
          Home
        </NavLink>
        {user?.role === "admin" && (
          <NavLink to="/create-user" className={linkClass}>
            Create User
          </NavLink>
        )}
        <NavLink to="/inventory" className={linkClass}>
          Inventory
        </NavLink>
        <NavLink to="/logs" className={linkClass}>
          Logs
        </NavLink>
        <NavLink to="/calendar" className={linkClass}>
          Calendar
        </NavLink>
        <NavLink to="/invoices" className={linkClass}>
          invoices
        </NavLink>
        
      </div>

      {/* Logout Button in top-right */}
      <div className="absolute top-0 right-0 px-6 py-4">
        <button
          onClick={handleLogout}
          className="bg-red-500 text-white px-4 py-2 rounded-md transition-colors hover:bg-red-700"
        >
          Logout
        </button>
      </div>
    </nav>
  );
}

export default Navbar;


// // src/components/Common/Navbar.js
// import React from "react";
// import { NavLink } from "react-router-dom";

// function Navbar({ user, handleLogout }) {
//   // Function to apply active class styles
//   const linkClass = ({ isActive }) =>
//     isActive ? "text-yellow-500" : "text-gray-800";

//   return (
//     <nav
//       className="relative py-4 px-6 w-full max-w-7xl mx-auto mb-8"
//       style={{
//         background: "#e0e0e0",
//         borderRadius: "16px",
//         boxShadow: "8px 8px 16px #bebebe, -8px -8px 16px #ffffff",
//       }}
//     >
//       {/* Brand in top-left */}
//       <div className="absolute top-0 left-0 px-6 py-4">
//         <h1
//           className="text-2xl font-bold"
//           style={{ fontFamily: "Reospec", color: "#333" }}
//         >
//           Hindustan Electric
//         </h1>
//       </div>

//       {/* Center: Navigation Links */}
//       <div className="flex justify-center space-x-6 mt-4">
//         <NavLink to="/dashboard" className={linkClass}>
//           Home
//         </NavLink>
//         {user?.role === "admin" && (
//           <NavLink to="/create-user" className={linkClass}>
//             Create User
//           </NavLink>
//         )}
//         <NavLink to="/inventory" className={linkClass}>
//           Inventory
//         </NavLink>
//         <NavLink to="/logs" className={linkClass}>
//           Logs
//         </NavLink>
//         <NavLink to="/calendar" className={linkClass}>
//           Calendar
//         </NavLink>
//       </div>

//       {/* Logout Button in top-right */}
//       <div className="absolute top-0 right-0 px-6 py-4">
//         <button
//           onClick={handleLogout}
//           className="bg-red-500 text-white px-4 py-2 rounded-lg transition-all hover:bg-red-700"
//           style={{
//             boxShadow: "4px 4px 8px #bebebe, -4px -4px 8px #ffffff",
//           }}
//         >
//           Logout
//         </button>
//       </div>
//     </nav>
//   );
// }

// export default Navbar;
