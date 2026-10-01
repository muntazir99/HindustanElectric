// src/components/Dashboard/CalendarDashboard.js
import React, { useState, useEffect } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import api from "../../api.js";

function CalendarDashboard() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [inventory, setInventory] = useState([]);
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        setError("");
        // Fetch all data and filter client-side to avoid backend dependency on specific date endpoint
        const formattedDate = selectedDate.toISOString().split("T")[0];
        console.log("Fetching all data to filter for:", formattedDate);

        const [inventoryRes, logsRes] = await Promise.all([
          api.get("/inventory/"),
          api.get("/logs/")
        ]);

        const allInventory = inventoryRes.data.data || [];
        const allLogs = logsRes.data.data || [];

        // Filter Inventory by date_of_addition
        const filteredInventory = allInventory.filter(item => {
          if (!item.date_of_addition) return false;
          // Handle various date formats if necessary, but assuming ISO or YYYY-MM-DD
          return item.date_of_addition.startsWith(formattedDate) ||
            new Date(item.date_of_addition).toISOString().split("T")[0] === formattedDate;
        });

        // Filter Logs by timestamp
        const filteredLogs = allLogs.filter(log => {
          if (!log.timestamp) return false;
          return new Date(log.timestamp).toISOString().split("T")[0] === formattedDate;
        });

        setInventory(filteredInventory);
        setLogs(filteredLogs);
      } catch (err) {
        console.error("Error fetching data:", err);
        setError("Failed to fetch data. Please try again.");
      }
    };

    fetchData();
  }, [selectedDate]);

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">
        Calendar Dashboard
      </h2>
      <div className="flex justify-center mb-6">
        <Calendar
          onChange={setSelectedDate}
          value={selectedDate}
          className="shadow-sm rounded-md border border-gray-300"
        />
      </div>
      <div className="max-w-4xl mx-auto bg-white border border-gray-300 rounded-md p-6 shadow-sm">
        <h3 className="text-xl font-bold mb-4 text-gray-800">
          Data for {selectedDate.toDateString()}
        </h3>
        {error && <p className="text-red-500 mb-4">{error}</p>}
        <div className="mb-6">
          <h4 className="text-lg font-semibold text-gray-700 mb-2">
            Inventory Added:
          </h4>
          {inventory.length > 0 ? (
            <ul className="list-disc ml-6 text-gray-700 text-sm space-y-1">
              {inventory.map((item, index) => (
                <li key={index}>
                  <span className="font-medium">{item.name}</span> from{" "}
                  <span className="italic">{item.company}</span> - Qty: {item.quantity} - Value: ₹
                  {(item.quantity * item.unit_price).toFixed(2)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-600 text-sm">No inventory added on this date.</p>
          )}
        </div>
        <div>
          <h4 className="text-lg font-semibold text-gray-700 mb-2">
            Transactions (In/Out):
          </h4>
          {logs.length > 0 ? (
            <ul className="list-disc ml-6 text-gray-700 text-sm space-y-1">
              {logs.map((log, index) => (
                <li key={index}>
                  <span className="font-medium">{log.item_name}</span> ({log.company}) - Action:{" "}
                  {log.action} - Qty: {log.quantity} - Buyer:{" "}
                  {log.buyer ? log.buyer : (log.company ? log.company : "N/A")}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-600 text-sm">No transactions on this date.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default CalendarDashboard;


// // src/components/Dashboard/CalendarDashboard.js
// import React, { useState, useEffect } from "react";
// import Calendar from "react-calendar";
// import "react-calendar/dist/Calendar.css";
// import api from "../../api.js";

// function CalendarDashboard() {
//   const [selectedDate, setSelectedDate] = useState(new Date());
//   const [inventory, setInventory] = useState([]);
//   const [logs, setLogs] = useState([]);
//   const [error, setError] = useState("");

//   useEffect(() => {
//     const fetchData = async () => {
//       try {
//         setError("");
//         // Format date as YYYY-MM-DD
//         const formattedDate = selectedDate.toISOString().split("T")[0];
//         const response = await api.get(`/inventory/by-date?date=${formattedDate}`);
//         // Expect response.data.data to include { inventory: [...], logs: [...] }
//         const { inventory, logs } = response.data.data;
//         setInventory(inventory || []);
//         setLogs(logs || []);
//       } catch (err) {
//         console.error("Error fetching data for selected date:", err);
//         setError("Failed to fetch data for the selected date.");
//       }
//     };

//     fetchData();
//   }, [selectedDate]);

//   return (
//     <div className="p-6">
//       <h2 className="text-2xl font-bold mb-6 text-center">Calendar Dashboard</h2>
//       <div className="flex justify-center mb-6">
//         <Calendar
//           onChange={setSelectedDate}
//           value={selectedDate}
//           className="shadow-2xl rounded-xl"
//         />
//       </div>
//       <div className="bg-white/10 backdrop-blur-lg shadow-2xl rounded-2xl p-6">
//         <h3 className="text-xl font-bold mb-4">Data for {selectedDate.toDateString()}</h3>
//         {error && <p className="text-red-500 mb-4">{error}</p>}
//         <div className="mb-6">
//           <h4 className="text-lg font-semibold mb-2">Inventory Added:</h4>
//           {inventory.length > 0 ? (
//             <ul className="list-disc ml-6">
//               {inventory.map((item, index) => (
//                 <li key={index} className="mb-1">
//                   <span className="font-semibold">{item.name}</span> from{" "}
//                   <span className="italic">{item.company}</span> - Qty: {item.quantity} - Value: ₹
//                   {(item.quantity * item.unit_price).toFixed(2)}
//                 </li>
//               ))}
//             </ul>
//           ) : (
//             <p>No inventory added on this date.</p>
//           )}
//         </div>
//         <div>
//           <h4 className="text-lg font-semibold mb-2">Transactions (In/Out):</h4>
//           {logs.length > 0 ? (
//             <ul className="list-disc ml-6">
//               {logs.map((log, index) => (
//                 <li key={index} className="mb-1">
//                   <span className="font-semibold">{log.item_name}</span> ({log.company}) - Action: {log.action} - Qty: {log.quantity} - Buyer:{" "}
//                   {log.buyer ? log.buyer : (log.company ? log.company : "N/A")}
//                 </li>
//               ))}
//             </ul>
//           ) : (
//             <p>No transactions on this date.</p>
//           )}
//         </div>
//       </div>
//     </div>
//   );
// }

// export default CalendarDashboard;
