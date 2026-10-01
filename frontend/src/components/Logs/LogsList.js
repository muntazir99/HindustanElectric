// src/components/Logs/LogsByFilter.js
import React, { useState, useEffect } from "react";
import axios from "../../api.js";

function LogsByFilter() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  // Main tab: "all", "buyer", "company"
  const [activeMainTab, setActiveMainTab] = useState("all");
  // For buyer or company filtering within the respective tab
  const [activeFilter, setActiveFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await axios.get("/logs/");
        setLogs(res.data.data || []);
      } catch (err) {
        console.error("Failed to fetch logs.");
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, []);

  // For Buyer tab: only logs with a valid buyer field.
  const buyerNames = Array.from(
    new Set(
      logs
        .filter((log) => log.buyer && log.buyer.trim() !== "")
        .map((log) => log.buyer.trim().toLowerCase())
    )
  );
  // For Company tab: only logs where buyer is empty but company is available.
  const companyNames = Array.from(
    new Set(
      logs
        .filter(
          (log) =>
            (!log.buyer || log.buyer.trim() === "") &&
            log.company &&
            log.company.trim() !== ""
        )
        .map((log) => log.company.trim().toLowerCase())
    )
  );

  // Filter names by search term.
  const filteredBuyerNames = buyerNames.filter((name) =>
    name.includes(searchTerm.toLowerCase())
  );
  const filteredCompanyNames = companyNames.filter((name) =>
    name.includes(searchTerm.toLowerCase())
  );

  // Determine displayed logs based on the active main tab and filter.
  let displayedLogs = [];
  if (activeMainTab === "all") {
    displayedLogs = logs;
  } else if (activeMainTab === "buyer") {
    if (activeFilter === "all") {
      displayedLogs = logs.filter(
        (log) => log.buyer && log.buyer.trim() !== ""
      );
    } else {
      displayedLogs = logs.filter(
        (log) =>
          log.buyer &&
          log.buyer.trim().toLowerCase() === activeFilter
      );
    }
  } else if (activeMainTab === "company") {
    if (activeFilter === "all") {
      displayedLogs = logs.filter(
        (log) =>
          (!log.buyer || log.buyer.trim() === "") &&
          log.company &&
          log.company.trim() !== ""
      );
    } else {
      displayedLogs = logs.filter(
        (log) =>
          (!log.buyer || log.buyer.trim() === "") &&
          log.company &&
          log.company.trim().toLowerCase() === activeFilter
      );
    }
  }

  const formatDate = (val) => {
    if (!val) return "N/A";
    return new Date(val).toLocaleString();
  };

  if (loading) {
    return (
      <div className="p-4">
        <p className="text-xl">Loading logs...</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <h1 className="text-2xl font-bold mb-6 text-center text-gray-800">
        Transaction Logs
      </h1>

      {/* Main Tabs */}
      <div className="mb-4 flex justify-center space-x-4">
        {["all", "buyer", "company"].map((tab) => (
          <button
            key={tab}
            onClick={() => {
              setActiveMainTab(tab);
              setActiveFilter("all");
              setSearchTerm("");
            }}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              activeMainTab === tab ? "bg-blue-500 text-white" : "bg-gray-200 text-gray-800 hover:bg-gray-300"
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Dropdown Filter for Buyer or Company */}
      {(activeMainTab === "buyer" || activeMainTab === "company") && (
        <div className="mb-4">
          <input
            type="text"
            placeholder={`Search ${activeMainTab}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 mb-2"
          />
          <select
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">All {activeMainTab}</option>
            {activeMainTab === "buyer"
              ? filteredBuyerNames.map((name, idx) => (
                  <option key={idx} value={name}>
                    {name.charAt(0).toUpperCase() + name.slice(1)}
                  </option>
                ))
              : filteredCompanyNames.map((name, idx) => (
                  <option key={idx} value={name}>
                    {name.charAt(0).toUpperCase() + name.slice(1)}
                  </option>
                ))}
          </select>
        </div>
      )}

      {/* Logs Table */}
      <div className="overflow-x-auto bg-white border border-gray-300 rounded-lg shadow-sm">
        <table className="w-full table-auto">
          <thead>
            <tr className="bg-gray-200">
              <th className="px-4 py-2 text-sm text-center">Date</th>
              <th className="px-4 py-2 text-sm text-center">Item</th>
              <th className="px-4 py-2 text-sm text-center">Action</th>
              <th className="px-4 py-2 text-sm text-center">Quantity</th>
              <th className="px-4 py-2 text-sm text-center">
                {activeMainTab === "company" ? "Company" : "Buyer"}
              </th>
            </tr>
          </thead>
          <tbody>
            {displayedLogs
              .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
              .map((log, index) => {
                const quantityValue =
                  log.quantity_added || log.quantity_sold || log.quantity || "N/A";
                let displayName = "";
                if (activeMainTab === "buyer") {
                  displayName =
                    log.buyer && log.buyer.trim() !== ""
                      ? log.buyer
                      : "N/A";
                } else if (activeMainTab === "company") {
                  displayName =
                    log.company && log.company.trim() !== ""
                      ? log.company
                      : "N/A";
                } else {
                  displayName =
                    log.buyer && log.buyer.trim() !== ""
                      ? log.buyer
                      : log.company && log.company.trim() !== ""
                      ? log.company
                      : "N/A";
                }
                const dateValue = log.timestamp
                  ? new Date(log.timestamp).toLocaleString()
                  : log.date_alloted
                  ? new Date(log.date_alloted).toLocaleString()
                  : log.date_returned
                  ? new Date(log.date_returned).toLocaleString()
                  : "N/A";

                return (
                  <tr key={index} className="border-b">
                    <td className="px-4 py-2 text-xs text-center">{dateValue}</td>
                    <td className="px-4 py-2 text-xs text-center">{log.item_name}</td>
                    <td className="px-4 py-2 text-xs text-center">{log.action}</td>
                    <td className="px-4 py-2 text-xs text-center">{quantityValue}</td>
                    <td className="px-4 py-2 text-xs text-center">{displayName}</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default LogsByFilter;


// // src/components/Logs/LogsByFilter.js
// import React, { useState, useEffect } from "react";
// import axios from "../../api.js";

// function LogsByFilter() {
//   const [logs, setLogs] = useState([]);
//   const [loading, setLoading] = useState(true);
//   // Main tab: "all", "buyer", "company"
//   const [activeMainTab, setActiveMainTab] = useState("all");
//   // For buyer or company filtering within the respective tab
//   const [activeFilter, setActiveFilter] = useState("all");
//   const [searchTerm, setSearchTerm] = useState("");

//   useEffect(() => {
//     const fetchLogs = async () => {
//       try {
//         const res = await axios.get("/logs/");
//         setLogs(res.data.data || []);
//       } catch (err) {
//         console.error("Failed to fetch logs.");
//       } finally {
//         setLoading(false);
//       }
//     };
//     fetchLogs();
//   }, []);

//   // For Buyer tab: only logs with a valid buyer field.
//   const buyerNames = Array.from(
//     new Set(
//       logs
//         .filter((log) => log.buyer && log.buyer.trim() !== "")
//         .map((log) => log.buyer.trim().toLowerCase())
//     )
//   );
//   // For Company tab: only logs where buyer is empty but company is available.
//   const companyNames = Array.from(
//     new Set(
//       logs
//         .filter(
//           (log) =>
//             (!log.buyer || log.buyer.trim() === "") &&
//             log.company &&
//             log.company.trim() !== ""
//         )
//         .map((log) => log.company.trim().toLowerCase())
//     )
//   );

//   // Filter names by search term.
//   const filteredBuyerNames = buyerNames.filter((name) =>
//     name.includes(searchTerm.toLowerCase())
//   );
//   const filteredCompanyNames = companyNames.filter((name) =>
//     name.includes(searchTerm.toLowerCase())
//   );

//   // Determine displayed logs based on the active main tab and filter.
//   let displayedLogs = [];
//   if (activeMainTab === "all") {
//     displayedLogs = logs;
//   } else if (activeMainTab === "buyer") {
//     if (activeFilter === "all") {
//       displayedLogs = logs.filter(
//         (log) => log.buyer && log.buyer.trim() !== ""
//       );
//     } else {
//       displayedLogs = logs.filter(
//         (log) =>
//           log.buyer &&
//           log.buyer.trim().toLowerCase() === activeFilter
//       );
//     }
//   } else if (activeMainTab === "company") {
//     if (activeFilter === "all") {
//       displayedLogs = logs.filter(
//         (log) =>
//           (!log.buyer || log.buyer.trim() === "") &&
//           log.company &&
//           log.company.trim() !== ""
//       );
//     } else {
//       displayedLogs = logs.filter(
//         (log) =>
//           (!log.buyer || log.buyer.trim() === "") &&
//           log.company &&
//           log.company.trim().toLowerCase() === activeFilter
//       );
//     }
//   }

//   const formatDate = (val) => {
//     if (!val) return "N/A";
//     return new Date(val).toLocaleString();
//   };

//   if (loading) {
//     return (
//       <div className="p-4">
//         <p className="text-xl">Loading logs...</p>
//       </div>
//     );
//   }

//   return (
//     <div className="p-6" style={{ background: "#e0e0e0", minHeight: "100vh" }}>
//       <h1 className="text-2xl font-bold mb-6 text-center">Transaction Logs</h1>

//       {/* Main Tabs */}
//       <div className="mb-4 flex justify-center space-x-4">
//         {["all", "buyer", "company"].map((tab) => (
//           <button
//             key={tab}
//             onClick={() => {
//               setActiveMainTab(tab);
//               setActiveFilter("all");
//               setSearchTerm("");
//             }}
//             className={`px-4 py-2 rounded-md font-medium transition-all ${activeMainTab === tab ? "bg-blue-500 text-white" : "bg-gray-200 text-gray-800"
//               }`}
//             style={{
//               boxShadow: "8px 8px 16px #bebebe, -8px -8px 16px #ffffff",
//             }}
//           >
//             {tab.charAt(0).toUpperCase() + tab.slice(1)}
//           </button>
//         ))}
//       </div>

//       {/* Dropdown Filter for Buyer or Company */}
//       {(activeMainTab === "buyer" || activeMainTab === "company") && (
//         <div className="mb-4">
//           <input
//             type="text"
//             placeholder={`Search ${activeMainTab}...`}
//             value={searchTerm}
//             onChange={(e) => setSearchTerm(e.target.value)}
//             className="w-full p-2 border rounded mb-2"
//             style={{
//               background: "#e0e0e0",
//               boxShadow: "inset 4px 4px 8px #bebebe, inset -4px -4px 8px #ffffff",
//             }}
//           />
//           <select
//             value={activeFilter}
//             onChange={(e) => setActiveFilter(e.target.value)}
//             className="w-full p-2 border rounded"
//             style={{
//               background: "#e0e0e0",
//               boxShadow: "8px 8px 16px #bebebe, -8px -8px 16px #ffffff",
//               appearance: "none",
//               paddingRight: "2.5rem",
//             }}
//           >
//             <option value="all">All {activeMainTab}</option>
//             {activeMainTab === "buyer"
//               ? filteredBuyerNames.map((name, idx) => (
//                 <option key={idx} value={name}>
//                   {name.charAt(0).toUpperCase() + name.slice(1)}
//                 </option>
//               ))
//               : filteredCompanyNames.map((name, idx) => (
//                 <option key={idx} value={name}>
//                   {name.charAt(0).toUpperCase() + name.slice(1)}
//                 </option>
//               ))}
//           </select>
//         </div>
//       )}

//       {/* Logs Table */}
//       <div
//         className="overflow-x-auto"
//         style={{
//           background: "#e0e0e0",
//           borderRadius: "12px",
//           boxShadow: "inset 4px 4px 8px #bebebe, inset -4px -4px 8px #ffffff",
//         }}
//       >
//         <table className="w-full table-auto">
//           <thead>
//             <tr className="bg-gray-300">
//               <th className="px-4 py-2 text-sm text-center">Date</th>
//               <th className="px-4 py-2 text-sm text-center">Item</th>
//               <th className="px-4 py-2 text-sm text-center">Action</th>
//               <th className="px-4 py-2 text-sm text-center">Quantity</th>
//               <th className="px-4 py-2 text-sm text-center">
//                 {activeMainTab === "company" ? "Company" : "Buyer"}
//               </th>
//             </tr>
//           </thead>
//           <tbody>
//             {displayedLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).map((log, index) => {
//               const quantityValue =
//                 log.quantity_added || log.quantity_sold || log.quantity || "N/A";
//               let displayName = "";
//               if (activeMainTab === "buyer") {
//                 displayName =
//                   log.buyer && log.buyer.trim() !== ""
//                     ? log.buyer
//                     : "N/A";
//               } else if (activeMainTab === "company") {
//                 displayName =
//                   log.company && log.company.trim() !== ""
//                     ? log.company
//                     : "N/A";
//               } else {
//                 displayName =
//                   log.buyer && log.buyer.trim() !== ""
//                     ? log.buyer
//                     : log.company && log.company.trim() !== ""
//                       ? log.company
//                       : "N/A";
//               }
//               const dateValue = log.timestamp
//                 ? new Date(log.timestamp).toLocaleString()
//                 : log.date_alloted
//                   ? new Date(log.date_alloted).toLocaleString()
//                   : log.date_returned
//                     ? new Date(log.date_returned).toLocaleString()
//                     : "N/A";

//               return (
//                 <tr key={index} className="border-b">
//                   <td className="px-4 py-2 text-xs text-center">{dateValue}</td>
//                   <td className="px-4 py-2 text-xs text-center">{log.item_name}</td>
//                   <td className="px-4 py-2 text-xs text-center">{log.action}</td>
//                   <td className="px-4 py-2 text-xs text-center">{quantityValue}</td>
//                   <td className="px-4 py-2 text-xs text-center">{displayName}</td>
//                 </tr>
//               );
//             })}
//           </tbody>
//         </table>
//       </div>
//     </div>
//   );
// }

// export default LogsByFilter;
