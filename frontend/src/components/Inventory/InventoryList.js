import React, { useEffect, useState } from "react";
import api from "../../api.js";

import ForecastModal from "./ForecastModal.js"; // Import Forecast Modal

function InventoryList() {
  const [inventory, setInventory] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedCategories, setExpandedCategories] = useState({});
  const [editingItem, setEditingItem] = useState(null);
  const [editForm, setEditForm] = useState({});

  // AI Forecast State
  const [forecastItem, setForecastItem] = useState(null);

  const fetchInventory = async () => {
    try {
      const res = await api.get("/inventory/?limit=1000");
      // Filter out any potential null/undefined items from the API response
      const validInventory = (res.data.data || []).filter(item => item);
      setInventory(validInventory);
    } catch (err) {
      console.error("Failed to fetch inventory.", err);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const filteredInventory = searchTerm
    ? inventory.filter((item) =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
    : inventory;

  const groupedInventory = filteredInventory.reduce((groups, item) => {
    const category = item.category || "Uncategorized";
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(item);
    return groups;
  }, {});

  const sortedCategories = Object.keys(groupedInventory).sort();

  const toggleCategory = (category) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setEditForm({
      name: item.name || "",
      company: item.company || "",
      quantity: item.quantity || "",
      unit_price: item.unit_price || "",
      category: item.category || "",
      barcode: item.barcode || "",
      hsn_code: item.hsn_code || "",
    });
  };

  const handleForecast = (item) => {
    setForecastItem(item);
  };

  const handleEditChange = (field, value) => {
    setEditForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        id: editingItem._id,
        ...editForm,
      };

      await api.put("/inventory/update", payload);

      // --- FIX ---
      // Always re-fetch the full inventory list after a successful update.
      fetchInventory();

      setEditingItem(null); // Close the modal
    } catch (err) {
      console.error("Error updating item:", err);
    }
  };

  const handleEditCancel = () => {
    setEditingItem(null);
  };

  const placeholderImage = "https://via.placeholder.com/150?text=No+Image";

  return (
    <div className="p-6 min-h-screen bg-gray-100">
      <h1 className="text-2xl font-bold mb-6 text-center">Inventory List</h1>
      <div className="mb-6 max-w-md mx-auto">
        <input
          type="text"
          placeholder="Search items..."
          value={searchTerm}
          onChange={handleSearchChange}
          className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
      <div className="max-w-6xl mx-auto space-y-6">
        {sortedCategories.map((category) => {
          const items = groupedInventory[category];
          const isExpanded = expandedCategories[category];
          return (
            <div
              key={category}
              className="bg-white border border-gray-300 rounded-md shadow-sm"
            >
              <div
                className="flex justify-between items-center px-4 py-3 cursor-pointer bg-gray-50"
                onClick={() => toggleCategory(category)}
              >
                <div className="flex items-center space-x-2">
                  <h2 className="text-lg font-semibold text-gray-800">
                    {category}
                  </h2>
                  <span className="text-sm text-gray-600">
                    ({items.length} {items.length === 1 ? "item" : "items"})
                  </span>
                </div>
                <button className="text-gray-600 focus:outline-none">
                  {isExpanded ? "▲" : "▼"}
                </button>
              </div>
              {isExpanded && (
                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {items.map((item) => (
                    <div
                      key={item._id}
                      className="relative bg-white border border-gray-300 rounded-md shadow-sm p-4 flex flex-col"
                    >
                      <div className="absolute top-2 right-2 flex space-x-1">
                        <button
                          onClick={() => handleForecast(item)}
                          title="AI Demand Forecast"
                          className="bg-purple-500 hover:bg-purple-600 text-white px-2 py-1 rounded text-xs"
                        >
                          🔮
                        </button>
                        <button
                          onClick={() => handleEdit(item)}
                          className="bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded text-xs"
                        >
                          Edit
                        </button>
                      </div>

                      <h3 className="text-base font-semibold text-gray-800 text-center mb-2 mt-4">
                        {item.name}
                      </h3>
                      <div className="flex justify-center mb-4">
                        <img
                          src={item.image || placeholderImage}
                          alt={item.name}
                          className="object-cover w-40 h-40 rounded-md"
                        />
                      </div>
                      <div className="text-sm text-gray-700 space-y-1">
                        <p><span className="font-medium">Company:</span> {item.company || "N/A"}</p>
                        <p><span className="font-medium">Quantity:</span> {item.quantity}</p>
                        <p><span className="font-medium">Unit Price (₹):</span> {Number(item.unit_price).toFixed(2)}</p>
                        <p><span className="font-medium">Category:</span> {item.category || "N/A"}</p>
                        {(item.historical_max_price || item.historical_min_price) && (
                          <div className="pt-2 mt-2 border-t border-gray-100 flex justify-between text-xs text-gray-500">
                            <span>Max: <span className="text-red-600 font-bold">{item.historical_max_price ? `₹${item.historical_max_price}` : '-'}</span></span>
                            <span>Min: <span className="text-green-600 font-bold">{item.historical_min_price ? `₹${item.historical_min_price}` : '-'}</span></span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {editingItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg">
            <h2 className="text-xl font-bold mb-4">Edit Item</h2>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-gray-700 mb-1">Item Name</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => handleEditChange("name", e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-gray-700 mb-1">Company</label>
                <input
                  type="text"
                  value={editForm.company}
                  onChange={(e) => handleEditChange("company", e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-700 mb-1">Quantity</label>
                  <input
                    type="number"
                    value={editForm.quantity}
                    onChange={(e) => handleEditChange("quantity", e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 mb-1">Unit Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editForm.unit_price}
                    onChange={(e) => handleEditChange("unit_price", e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md"
                  />
                </div>
              </div>
              <div>
                <label className="block text-gray-700 mb-1">Category</label>
                <input
                  type="text"
                  value={editForm.category}
                  onChange={(e) => handleEditChange("category", e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md"
                />
              </div>
              <div className="flex justify-end space-x-4 mt-4">
                <button
                  type="button"
                  onClick={handleEditCancel}
                  className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Forecast Modal */}
      {forecastItem && (
        <ForecastModal
          item={forecastItem}
          onClose={() => setForecastItem(null)}
        />
      )}
    </div>
  );
}

export default InventoryList;
// import React, { useEffect, useState } from "react";
// import api from "../../api.js";

// function InventoryList() {
//   const [inventory, setInventory] = useState([]);
//   const [searchTerm, setSearchTerm] = useState("");
//   const [expandedCategories, setExpandedCategories] = useState({});
//   const [editingItem, setEditingItem] = useState(null);
//   const [editForm, setEditForm] = useState({});

//   const fetchInventory = async () => {
//     try {
//       const res = await api.get("/inventory/");
//       // Filter out any null or undefined items from the API response
//       const validInventory = (res.data.data || []).filter(item => item);
//       setInventory(validInventory);
//     } catch (err) {
//       console.error("Failed to fetch inventory.", err);
//     }
//   };

//   useEffect(() => {
//     fetchInventory();
//   }, []);

//   const handleSearchChange = (e) => {
//     setSearchTerm(e.target.value);
//   };

//   const filteredInventory = searchTerm
//     ? inventory.filter((item) =>
//         item.name.toLowerCase().includes(searchTerm.toLowerCase())
//       )
//     : inventory;

//   const groupedInventory = filteredInventory.reduce((groups, item) => {
//     const category = item.category || "Uncategorized";
//     if (!groups[category]) {
//       groups[category] = [];
//     }
//     groups[category].push(item);
//     return groups;
//   }, {});

//   const sortedCategories = Object.keys(groupedInventory).sort();

//   const toggleCategory = (category) => {
//     setExpandedCategories((prev) => ({
//       ...prev,
//       [category]: !prev[category],
//     }));
//   };

//   const handleEdit = (item) => {
//     setEditingItem(item);
//     setEditForm({
//       name: item.name || "",
//       company: item.company || "",
//       quantity: item.quantity || "",
//       unit_price: item.unit_price || "",
//       category: item.category || "",
//       barcode: item.barcode || "",
//       hsn_code: item.hsn_code || "",
//     });
//   };

//   const handleEditChange = (field, value) => {
//     setEditForm((prev) => ({ ...prev, [field]: value }));
//   };

//   const handleEditSubmit = async (e) => {
//     e.preventDefault();
//     try {
//       const payload = {
//         id: editingItem._id,
//         ...editForm,
//       };

//       const res = await api.put("/inventory/update", payload);

//       // --- START OF FIX ---
//       // Check if the backend returned the updated item data.
//       if (res.data && res.data.data) {
//         // If yes, update the state optimistically (this is faster).
//         setInventory((prev) =>
//           prev.map((item) =>
//             item._id === editingItem._id ? res.data.data : item
//           )
//         );
//       } else {
//         // If no data is returned, re-fetch the entire list to ensure UI is up-to-date.
//         fetchInventory();
//       }
//       // --- END OF FIX ---

//       setEditingItem(null);
//     } catch (err) {
//       console.error("Error updating item:", err);
//       // Optionally, set an error state here to show in the UI
//     }
//   };

//   const handleEditCancel = () => {
//     setEditingItem(null);
//   };

//   const placeholderImage = "https://via.placeholder.com/150?text=No+Image";

//   return (
//     <div className="p-6 min-h-screen bg-gray-100">
//       <h1 className="text-2xl font-bold mb-6 text-center">Inventory List</h1>
//       <div className="mb-6 max-w-md mx-auto">
//         <input
//           type="text"
//           placeholder="Search items..."
//           value={searchTerm}
//           onChange={handleSearchChange}
//           className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
//         />
//       </div>
//       <div className="max-w-6xl mx-auto space-y-6">
//         {sortedCategories.map((category) => {
//           const items = groupedInventory[category];
//           const isExpanded = expandedCategories[category];
//           return (
//             <div
//               key={category}
//               className="bg-white border border-gray-300 rounded-md shadow-sm"
//             >
//               <div
//                 className="flex justify-between items-center px-4 py-3 cursor-pointer bg-gray-50"
//                 onClick={() => toggleCategory(category)}
//               >
//                 <div className="flex items-center space-x-2">
//                   <h2 className="text-lg font-semibold text-gray-800">
//                     {category}
//                   </h2>
//                   <span className="text-sm text-gray-600">
//                     ({items.length} {items.length === 1 ? "item" : "items"})
//                   </span>
//                 </div>
//                 <button className="text-gray-600 focus:outline-none">
//                   {isExpanded ? "▲" : "▼"}
//                 </button>
//               </div>
//               {isExpanded && (
//                 <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
//                   {items.map((item, index) => (
//                     <div
//                       key={item._id || index}
//                       className="relative bg-white border border-gray-300 rounded-md shadow-sm p-4 flex flex-col"
//                     >
//                       <button
//                         onClick={() => handleEdit(item)}
//                         className="absolute top-2 right-2 bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded text-xs"
//                       >
//                         Edit
//                       </button>
//                       <h3 className="text-base font-semibold text-gray-800 text-center mb-2">
//                         {item.name}
//                       </h3>
//                       <div className="flex justify-center mb-4">
//                         <img
//                           src={item.image || placeholderImage}
//                           alt={item.name}
//                           className="object-cover w-40 h-40 rounded-md"
//                         />
//                       </div>
//                       <div className="text-sm text-gray-700 space-y-1">
//                         <p>
//                           <span className="font-medium">Company:</span>{" "}
//                           {item.company || "N/A"}
//                         </p>
//                         <p>
//                           <span className="font-medium">Quantity:</span>{" "}
//                           {item.quantity}
//                         </p>
//                         <p>
//                           <span className="font-medium">Unit Price (₹):</span>{" "}
//                           {Number(item.unit_price).toFixed(2)}
//                         </p>
//                         <p>
//                           <span className="font-medium">Category:</span>{" "}
//                           {item.category || "N/A"}
//                         </p>
//                         <p>
//                           <span className="font-medium">Barcode:</span>{" "}
//                           {item.barcode || "N/A"}
//                         </p>
//                         <p>
//                           <span className="font-medium">HSN Code:</span>{" "}
//                           {item.hsn_code || "N/A"}
//                         </p>
//                       </div>
//                     </div>
//                   ))}
//                 </div>
//               )}
//             </div>
//           );
//         })}
//       </div>

//       {editingItem && (
//         <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
//           <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg">
//             <h2 className="text-xl font-bold mb-4">Edit Item</h2>
//             <form onSubmit={handleEditSubmit} className="space-y-4">
//                <div>
//                 <label className="block text-gray-700 mb-1">Item Name</label>
//                 <input
//                   type="text"
//                   value={editForm.name}
//                   onChange={(e) => handleEditChange("name", e.target.value)}
//                   className="w-full p-2 border border-gray-300 rounded-md"
//                 />
//               </div>
//               <div>
//                 <label className="block text-gray-700 mb-1">Company</label>
//                 <input
//                   type="text"
//                   value={editForm.company}
//                   onChange={(e) => handleEditChange("company", e.target.value)}
//                   className="w-full p-2 border border-gray-300 rounded-md"
//                 />
//               </div>
//               <div className="grid grid-cols-2 gap-4">
//                 <div>
//                   <label className="block text-gray-700 mb-1">Quantity</label>
//                   <input
//                     type="number"
//                     value={editForm.quantity}
//                     onChange={(e) => handleEditChange("quantity", e.target.value)}
//                     className="w-full p-2 border border-gray-300 rounded-md"
//                   />
//                 </div>
//                 <div>
//                   <label className="block text-gray-700 mb-1">Unit Price (₹)</label>
//                   <input
//                     type="number"
//                     step="0.01"
//                     value={editForm.unit_price}
//                     onChange={(e) => handleEditChange("unit_price", e.target.value)}
//                     className="w-full p-2 border border-gray-300 rounded-md"
//                   />
//                 </div>
//               </div>
//               <div>
//                 <label className="block text-gray-700 mb-1">Category</label>
//                 <input
//                   type="text"
//                   value={editForm.category}
//                   onChange={(e) => handleEditChange("category", e.target.value)}
//                   className="w-full p-2 border border-gray-300 rounded-md"
//                 />
//               </div>
//               <div>
//                 <label className="block text-gray-700 mb-1">Barcode</label>
//                 <input
//                   type="text"
//                   value={editForm.barcode}
//                   onChange={(e) => handleEditChange("barcode", e.target.value)}
//                   className="w-full p-2 border border-gray-300 rounded-md"
//                 />
//               </div>
//               <div>
//                 <label className="block text-gray-700 mb-1">HSN Code</label>
//                 <input
//                   type="text"
//                   value={editForm.hsn_code}
//                   onChange={(e) => handleEditChange("hsn_code", e.target.value)}
//                   className="w-full p-2 border border-gray-300 rounded-md"
//                 />
//               </div>
//               <div className="flex justify-end space-x-4 mt-4">
//                 <button
//                   type="button"
//                   onClick={handleEditCancel}
//                   className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md"
//                 >
//                   Cancel
//                 </button>
//                 <button
//                   type="submit"
//                   className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md"
//                 >
//                   Save Changes
//                 </button>
//               </div>
//             </form>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }

// export default InventoryList;
// // src/components/Inventory/InventoryList.js
// import React, { useEffect, useState } from "react";
// import axios from "../../api.js";

// function InventoryList() {
//   const [inventory, setInventory] = useState([]);
//   const [searchTerm, setSearchTerm] = useState("");
//   const [expandedCategories, setExpandedCategories] = useState({});
//   const [editingItem, setEditingItem] = useState(null);
//   const [editForm, setEditForm] = useState({});

//   useEffect(() => {
//     const fetchInventory = async () => {
//       try {
//         const res = await axios.get("/inventory/");
//         setInventory(res.data.data || []);
//       } catch (err) {
//         console.error("Failed to fetch inventory.", err);
//       }
//     };
//     fetchInventory();
//   }, []);

//   // Handle search input change.
//   const handleSearchChange = (e) => {
//     setSearchTerm(e.target.value);
//   };

//   // Filter inventory based on search term.
//   const filteredInventory = searchTerm
//     ? inventory.filter((item) =>
//         item.name.toLowerCase().includes(searchTerm.toLowerCase())
//       )
//     : inventory;

//   // Group items by category (or "Uncategorized" if category is missing).
//   const groupedInventory = filteredInventory.reduce((groups, item) => {
//     const category = item.category ? item.category : "Uncategorized";
//     if (!groups[category]) {
//       groups[category] = [];
//     }
//     groups[category].push(item);
//     return groups;
//   }, {});

//   // Alphabetically sort the category keys.
//   const sortedCategories = Object.keys(groupedInventory).sort();

//   // Toggle expanded state for a category.
//   const toggleCategory = (category) => {
//     setExpandedCategories((prev) => ({
//       ...prev,
//       [category]: !prev[category],
//     }));
//   };

//   // When "Edit" is clicked, open the modal for that item.
//   const handleEdit = (item) => {
//     setEditingItem(item);
//     setEditForm({
//       name: item.name || "",
//       company: item.company || "",
//       quantity: item.quantity || "",
//       unit_price: item.unit_price || "",
//       category: item.category || "",
//       barcode: item.barcode || "",
//       hsn_code: item.hsn_code || "",
//       // Optionally, include image if you allow editing image:
//       // image: item.image || ""
//     });
//   };

//   // Update the edit form state.
//   const handleEditChange = (field, value) => {
//     setEditForm((prev) => ({ ...prev, [field]: value }));
//   };

//   // Submit the update for the edited item.
//   const handleEditSubmit = async (e) => {
//     e.preventDefault();
//     try {
//       // Prepare payload; here we assume that to identify which record to update,
//       // the backend expects the item name and company (or ideally a unique _id).
//       const payload = {
//         originalName: editingItem.name, // Use an identifier, or _id if available
//         originalCompany: editingItem.company,
//         ...editForm,
//       };
//       // Send the update request (modify URL/method if necessary)
//       const res = await axios.put("/inventory/update", payload);
//       // Update local state: Replace the matching item with updated data.
//       setInventory((prev) =>
//         prev.map((item) =>
//           item.name === editingItem.name && item.company === editingItem.company
//             ? { ...item, ...editForm }
//             : item
//         )
//       );
//       setEditingItem(null);
//     } catch (err) {
//       console.error("Error updating item:", err);
//       // Optionally set error state or display a message.
//     }
//   };

//   // Cancel editing.
//   const handleEditCancel = () => {
//     setEditingItem(null);
//   };

//   // Placeholder image if no image is available.
//   const placeholderImage = "https://via.placeholder.com/150?text=No+Image";

//   return (
//     <div className="p-6 min-h-screen bg-gray-100">
//       <h1 className="text-2xl font-bold mb-6 text-center">Inventory List</h1>
//       <div className="mb-6 max-w-md mx-auto">
//         <input
//           type="text"
//           placeholder="Search items..."
//           value={searchTerm}
//           onChange={handleSearchChange}
//           className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
//         />
//       </div>
//       <div className="max-w-6xl mx-auto space-y-6">
//         {sortedCategories.map((category) => {
//           const items = groupedInventory[category];
//           const isExpanded = expandedCategories[category];
//           return (
//             <div
//               key={category}
//               className="bg-white border border-gray-300 rounded-md shadow-sm"
//             >
//               {/* Category header with toggle */}
//               <div
//                 className="flex justify-between items-center px-4 py-3 cursor-pointer bg-gray-50"
//                 onClick={() => toggleCategory(category)}
//               >
//                 <div className="flex items-center space-x-2">
//                   <h2 className="text-lg font-semibold text-gray-800">
//                     {category}
//                   </h2>
//                   <span className="text-sm text-gray-600">
//                     ({items.length} {items.length === 1 ? "item" : "items"})
//                   </span>
//                 </div>
//                 <button className="text-gray-600 focus:outline-none">
//                   {isExpanded ? "▲" : "▼"}
//                 </button>
//               </div>
//               {/* Expanded grid of item cards */}
//               {isExpanded && (
//                 <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
//                   {items.map((item, index) => (
//                     <div
//                       key={index}
//                       className="relative bg-white border border-gray-300 rounded-md shadow-sm p-4 flex flex-col"
//                     >
//                       {/* Edit button at top right */}
//                       <button
//                         onClick={() => handleEdit(item)}
//                         className="absolute top-2 right-2 bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded text-xs"
//                       >
//                         Edit
//                       </button>
//                       <h3 className="text-base font-semibold text-gray-800 text-center mb-2">
//                         {item.name}
//                       </h3>
//                       <div className="flex justify-center mb-4">
//                         <img
//                           src={item.image || placeholderImage}
//                           alt={item.name}
//                           className="object-cover w-40 h-40 rounded-md"
//                         />
//                       </div>
//                       <div className="text-sm text-gray-700 space-y-1">
//                         <p>
//                           <span className="font-medium">Company:</span>{" "}
//                           {item.company || "N/A"}
//                         </p>
//                         <p>
//                           <span className="font-medium">Quantity:</span>{" "}
//                           {item.quantity}
//                         </p>
//                         <p>
//                           <span className="font-medium">Unit Price (₹):</span>{" "}
//                           {Number(item.unit_price).toFixed(2)}
//                         </p>
//                         <p>
//                           <span className="font-medium">Category:</span>{" "}
//                           {item.category || "N/A"}
//                         </p>
//                         <p>
//                           <span className="font-medium">Barcode:</span>{" "}
//                           {item.barcode || "N/A"}
//                         </p>
//                         <p>
//                           <span className="font-medium">HSN Code:</span>{" "}
//                           {item.hsn_code || "N/A"}
//                         </p>
//                       </div>
//                     </div>
//                   ))}
//                 </div>
//               )}
//             </div>
//           );
//         })}
//       </div>

//       {/* Edit Modal */}
//       {editingItem && (
//         <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
//           <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg">
//             <h2 className="text-xl font-bold mb-4">Edit Item</h2>
//             <form onSubmit={handleEditSubmit} className="space-y-4">
//               <div>
//                 <label className="block text-gray-700 mb-1">Item Name</label>
//                 <input
//                   type="text"
//                   value={editForm.name}
//                   onChange={(e) => handleEditChange("name", e.target.value)}
//                   className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
//                 />
//               </div>
//               <div>
//                 <label className="block text-gray-700 mb-1">Company</label>
//                 <input
//                   type="text"
//                   value={editForm.company}
//                   onChange={(e) => handleEditChange("company", e.target.value)}
//                   className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
//                 />
//               </div>
//               <div className="grid grid-cols-2 gap-4">
//                 <div>
//                   <label className="block text-gray-700 mb-1">Quantity</label>
//                   <input
//                     type="number"
//                     value={editForm.quantity}
//                     onChange={(e) =>
//                       handleEditChange("quantity", e.target.value)
//                     }
//                     className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
//                   />
//                 </div>
//                 <div>
//                   <label className="block text-gray-700 mb-1">Unit Price (₹)</label>
//                   <input
//                     type="number"
//                     value={editForm.unit_price}
//                     onChange={(e) =>
//                       handleEditChange("unit_price", e.target.value)
//                     }
//                     className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
//                   />
//                 </div>
//               </div>
//               <div>
//                 <label className="block text-gray-700 mb-1">Category</label>
//                 <input
//                   type="text"
//                   value={editForm.category}
//                   onChange={(e) =>
//                     handleEditChange("category", e.target.value)
//                   }
//                   className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
//                 />
//               </div>
//               <div>
//                 <label className="block text-gray-700 mb-1">Barcode</label>
//                 <input
//                   type="text"
//                   value={editForm.barcode}
//                   onChange={(e) =>
//                     handleEditChange("barcode", e.target.value)
//                   }
//                   className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
//                 />
//               </div>
//               <div>
//                 <label className="block text-gray-700 mb-1">HSN Code</label>
//                 <input
//                   type="text"
//                   value={editForm.hsn_code}
//                   onChange={(e) =>
//                     handleEditChange("hsn_code", e.target.value)
//                   }
//                   className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
//                 />
//               </div>
//               <div className="flex justify-end space-x-4 mt-4">
//                 <button
//                   type="button"
//                   onClick={handleEditCancel}
//                   className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md transition-colors"
//                 >
//                   Cancel
//                 </button>
//                 <button
//                   type="submit"
//                   className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md transition-colors"
//                 >
//                   Save Changes
//                 </button>
//               </div>
//             </form>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }

// export default InventoryList;

