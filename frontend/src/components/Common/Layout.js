
// import React, { useEffect, useState, useCallback } from "react";
// import { Outlet } from "react-router-dom";
// import api from "../../api.js";
// import Sidebar from "./Sidebar.js";
// import SidePanel from "./Sidepanel.js";
// import { useAuth } from "../../context/AuthContext.js";

// function Layout({ children }) { // Receive children instead of Outlet
//   const { user, logout } = useAuth();
//   const [showSidePanel, setShowSidePanel] = useState(false);
//   const [activeSideTab, setActiveSideTab] = useState("quick");
//   const [logs, setLogs] = useState([]);
//   const [loading, setLoading] = useState(false);
//   const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

//   const fetchData = useCallback(async () => {
//     if (!user) return;
//     try {
//       setLoading(true);
//       const logsRes = await api.get("/logs/");
//       setLogs(Array.isArray(logsRes.data.data) ? logsRes.data.data : []);
//     } catch (error) {
//       console.error("Error fetching logs:", error);
//       if (error.response?.status === 401) {
//         logout();
//       }
//     } finally {
//       setLoading(false);
//     }
//   }, [user, logout]);

//   useEffect(() => {
//     fetchData();
//   }, [fetchData]);

//   return (
//     <div className="flex min-h-screen bg-gray-100">
//       <Sidebar
//         user={user}
//         handleLogout={logout}
//         sidebarCollapsed={sidebarCollapsed}
//         setSidebarCollapsed={setSidebarCollapsed}
//       />
//       <main
//         className="flex-grow p-6 transition-all duration-300"
//         style={{ marginLeft: sidebarCollapsed ? "4rem" : "16rem" }}
//       >
//         {children} {/* Render children */}
//       </main>
//       <SidePanel
//         user={user}
//         setShowSidePanel={setShowSidePanel}
//         setActiveSideTab={setActiveSideTab}
//         showSidePanel={showSidePanel}
//         activeSideTab={activeSideTab}
//         logs={logs}
//       />
//     </div>
//   );
// }

// export default Layout;

import React, { useEffect, useState, useCallback } from "react";
import { Outlet, useNavigate } from "react-router-dom"; // Import Outlet
import api from "../../api.js";
import Sidebar from "./Sidebar.js";
import SidePanel from "./Sidepanel.js";
import { useAuth } from "../../context/AuthContext.js";

function Layout() {
  const { user, logout } = useAuth();
  const [showSidePanel, setShowSidePanel] = useState(false);
  const [activeSideTab, setActiveSideTab] = useState("quick");
  const [logs, setLogs] = useState([]);
  const navigate = useNavigate();

  const fetchData = useCallback(async () => {
    if (!user) return;
    try {
      const logsRes = await api.get("/logs/");
      setLogs(Array.isArray(logsRes.data.data) ? logsRes.data.data : []);
    } catch (error) {
      console.error("Error fetching logs:", error);
      if (error.response?.status === 401) {
        logout();
        navigate("/login");
      }
    }
  }, [user, logout, navigate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar />
      <main
        className="flex-grow p-6 transition-all duration-300"
        style={{ marginLeft: "16rem" }}
      >
        {/* Child routes will be rendered here */}
        <Outlet />
      </main>
      <SidePanel
        user={user}
        setShowSidePanel={setShowSidePanel}
        setActiveSideTab={setActiveSideTab}
        showSidePanel={showSidePanel}
        activeSideTab={activeSideTab}
        logs={logs}
      />
    </div>
  );
}

export default Layout;