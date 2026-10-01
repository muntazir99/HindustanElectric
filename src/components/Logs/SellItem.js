// src/components/Logs/SellMultipleItems.js
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "../../api.js";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { UploadIcon } from "lucide-react";

// Child component for a single sale entry with autocomplete for item names
function SaleEntry({ sale, index, handleSaleChange, handleSelectItem, allItems }) {
  const [suggestions, setSuggestions] = useState([]);
  const containerRef = useRef(null);

  // Filter suggestions based on input
  useEffect(() => {
    const inputText = sale.itemName || "";
    if (!inputText) {
      setSuggestions([]);
      return;
    }
    const lowerInput = inputText.toLowerCase();
    const filtered = allItems.filter(item =>
      (item.name || "").toLowerCase().includes(lowerInput)
    );
    filtered.sort((a, b) => {
      const aName = (a.name || "").toLowerCase();
      const bName = (b.name || "").toLowerCase();
      const aStarts = aName.startsWith(lowerInput) ? 0 : 1;
      const bStarts = bName.startsWith(lowerInput) ? 0 : 1;
      return aStarts - bStarts || aName.localeCompare(bName);
    });
    setSuggestions(filtered);
  }, [sale.itemName, allItems]);

  // Close suggestions if click happens outside this component
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setSuggestions([]);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectSuggestion = (suggestion) => {
    // Update the entire sale object with suggestion details
    handleSelectItem(index, suggestion);
    setSuggestions([]);
  };

  return (
    <div className="relative" ref={containerRef}>
      <input
        type="text"
        placeholder="Search item name"
        value={sale.itemName || ""}
        onChange={(e) => handleSaleChange(index, "itemName", e.target.value)}
        className="w-full p-3 rounded-xl text-gray-800 placeholder-gray-500 bg-gray-200 border border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      {suggestions.length > 0 && (
        <ul className="absolute z-10 left-0 right-0 bg-white border border-gray-300 rounded shadow-sm mt-1 max-h-48 overflow-auto text-gray-800 text-sm">
          {suggestions.map((suggestion, idx) => (
            <li
              key={idx}
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelectSuggestion(suggestion);
              }}
              className="px-2 py-1 hover:bg-gray-200 cursor-pointer"
            >
              {suggestion.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SellMultipleItems() {
  const initialSale = {
    item_id: "", // Added ID field
    itemName: "",
    company: "",
    quantity: "",
    price: "",
    availableQuantity: null,
    hsn_code: "",
    unit_price: "",
    image: ""
  };

  const [sales, setSales] = useState([initialSale]);
  const [buyer, setBuyer] = useState("");
  const [cart, setCart] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [allItems, setAllItems] = useState([]);
  const navigate = useNavigate();

  // Fetch inventory details from the API
  useEffect(() => {
    const fetchItems = async () => {
      try {
        const res = await axios.get("/inventory/");
        const items = res.data.data || [];
        setAllItems(items);
      } catch (err) {
        console.error("Error fetching inventory details:", err);
      }
    };
    fetchItems();
  }, []);

  // Update sale on manual input change; clear company/unit_price if itemName changes.
  const handleSaleChange = (index, field, value) => {
    const newSales = [...sales];
    newSales[index][field] = value;
    if (field === "itemName") {
      newSales[index]["item_id"] = ""; // Clear ID if name is typed manually
      newSales[index]["company"] = "";
      newSales[index]["availableQuantity"] = null;
      newSales[index]["unit_price"] = "";
      newSales[index]["image"] = "";
    }
    setSales(newSales);
  };

  // When a suggestion is selected, update the entire sale object.
  const handleSelectItem = (index, suggestion) => {
    const newSales = [...sales];
    newSales[index] = {
      ...newSales[index],
      item_id: suggestion._id, // Capture unique ID
      itemName: suggestion.name,
      company: suggestion.company,
      availableQuantity: suggestion.quantity,
      hsn_code: suggestion.hsn_code,
      unit_price: suggestion.unit_price,
      image: suggestion.image
    };
    setSales(newSales);
  };

  const handleAddSale = () => {
    setSales([...sales, initialSale]);
  };

  const handleRemoveSale = (index) => {
    if (sales.length > 1) {
      setSales(sales.filter((_, i) => i !== index));
    }
  };

  const handleAddToCart = (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    for (let sale of sales) {
      if (!sale.itemName || !sale.company || !sale.quantity || !sale.price) {
        setError("All fields (except buyer) are required for every sale entry.");
        return;
      }
      if (Number(sale.quantity) <= 0 || Number(sale.price) <= 0) {
        setError("Quantity and Price must be greater than zero for every sale entry.");
        return;
      }
      if (
        sale.availableQuantity !== null &&
        Number(sale.quantity) > Number(sale.availableQuantity)
      ) {
        setError(
          `Quantity for "${sale.itemName}" cannot exceed available stock (${sale.availableQuantity}).`
        );
        return;
      }
    }
    if (!buyer.trim()) {
      setError("Buyer name is required.");
      return;
    }
    const updatedSales = sales.map(sale => ({
      item_id: sale.item_id, // Include ID in cart
      itemName: sale.itemName,
      company: sale.company,
      quantity: sale.quantity,
      buyer: buyer.trim(),
      price: sale.price,
      hsn_code: sale.hsn_code
    }));
    setCart(prevCart => [...prevCart, ...updatedSales]);
    setMessage("Items added to cart.");
    setSales([initialSale]);
  };

  const handleProceedToBilling = () => {
    if (cart.length === 0) {
      setError("Cart is empty. Please add items to cart before proceeding to billing.");
      return;
    }
    navigate("/billing", { state: { cart } });
  };

  const totalCartItems = cart.reduce((sum, item) => sum + Number(item.quantity), 0);
  const totalCartCost = cart.reduce(
    (sum, item) => sum + Number(item.quantity) * Number(item.price),
    0
  );

  return (
    <div className="flex flex-col md:flex-row justify-center items-start min-h-screen p-6 bg-gray-100">
      {/* Left Column: Sell Multiple Items Form */}
      <div className="p-8 w-full md:w-2/3 rounded-lg bg-white border border-gray-300 shadow-sm mb-4 md:mb-0 md:mr-4">
        <h2
          className="text-2xl font-bold mb-6 text-center text-gray-800"
          style={{ fontFamily: "Reospec" }}
        >
          Sell Multiple Items
        </h2>

        {/* Buyer Field */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="Buyer Name"
            value={buyer}
            onChange={(e) => setBuyer(e.target.value)}
            className="w-full p-3 rounded-xl text-gray-800 placeholder-gray-500 bg-gray-200 border border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <form onSubmit={handleAddToCart} className="space-y-6">
          {sales.map((sale, index) => (
            <div
              key={index}
              className="p-4 rounded-xl mb-4 bg-gray-200 border border-gray-300"
            >
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-bold text-gray-800">Sale {index + 1}</h3>
                {sales.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveSale(index)}
                    className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded transition-colors text-sm"
                  >
                    Remove
                  </button>
                )}
              </div>
              <SaleEntry
                sale={sale}
                index={index}
                handleSaleChange={handleSaleChange}
                handleSelectItem={handleSelectItem}
                allItems={allItems}
              />
              {/* Item Card: shows photo, remaining quantity and buying price */}
              {sale.itemName && sale.unit_price && (
                <div className="mt-2 p-4 border rounded flex items-center bg-white">
                  {sale.image ? (
                    <img
                      src={sale.image}
                      alt={sale.itemName}
                      className="w-16 h-16 object-cover mr-4 rounded"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-gray-300 flex items-center justify-center mr-4 rounded text-sm text-gray-600">
                      No Image
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-semibold">
                      Remaining: {sale.availableQuantity}
                    </p>
                    <p className="text-sm">
                      Buying Price: ₹{sale.unit_price}
                    </p>
                  </div>
                </div>
              )}
              <input
                type="text"
                placeholder="Company Name"
                value={sale.company}
                className="w-full p-3 rounded-xl text-gray-800 placeholder-gray-500 bg-gray-200 border border-gray-300 focus:outline-none mt-2"
                disabled
              />
              <div className="grid grid-cols-2 gap-4 mt-2">
                <div>
                  <input
                    type="number"
                    placeholder="Quantity"
                    value={sale.quantity}
                    onChange={(e) => handleSaleChange(index, "quantity", e.target.value)}
                    className="w-full p-3 rounded-xl text-gray-800 placeholder-gray-500 bg-gray-200 border border-gray-300 focus:outline-none"
                    max={sale.availableQuantity || undefined}
                  />
                  {sale.availableQuantity !== null && (
                    <p className="text-red-500 mt-1 text-sm">
                      Remaining: {sale.availableQuantity - (Number(sale.quantity) || 0)}
                    </p>
                  )}
                </div>
                <div className="self-start">
                  <input
                    type="number"
                    placeholder="Price (₹)"
                    value={sale.price}
                    onChange={(e) => handleSaleChange(index, "price", e.target.value)}
                    className="w-full p-3 rounded-xl text-gray-800 placeholder-gray-500 bg-gray-200 border border-gray-300 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          ))}
          <div className="flex justify-between">
            <button
              type="button"
              onClick={handleAddSale}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded transition-colors"
            >
              Add Another Sale
            </button>
            <button
              type="submit"
              className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded transition-colors"
            >
              Add to Cart
            </button>
          </div>
        </form>
        {error && <p className="mt-4 text-center text-red-500">{error}</p>}
        {message && <p className="mt-4 text-center text-green-500">{message}</p>}
      </div>

      {/* Right Column: Cart Summary */}
      <div className="w-full md:w-1/3 lg:w-1/4">
        <div className="bg-white rounded-xl shadow-sm p-6 h-full flex flex-col">
          <h2 className="text-xl font-bold mb-4" style={{ fontFamily: "Reospec" }}>
            Cart Summary
          </h2>
          <div className="flex-1 overflow-auto">
            {cart.length === 0 ? (
              <p className="text-gray-500">No items in cart</p>
            ) : (
              <ul className="space-y-3">
                {cart.map((c, idx) => {
                  const itemTotal = Number(c.quantity) * Number(c.price);
                  return (
                    <li key={idx} className="border-b pb-2">
                      <div className="flex justify-between">
                        <p className="text-gray-700 font-semibold">
                          {c.itemName} <span className="text-sm text-gray-500">({c.company})</span>
                        </p>
                        <p className="text-gray-700">₹{itemTotal.toFixed(2)}</p>
                      </div>
                      <p className="text-sm text-gray-500">
                        Qty: {c.quantity} | Price: ₹{c.price}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="mt-4 border-t pt-4 text-gray-700">
            <div className="flex justify-between mb-1">
              <span className="font-semibold">Total Items:</span>
              <span>{totalCartItems}</span>
            </div>
            <div className="flex justify-between mb-2">
              <span className="font-semibold">Subtotal:</span>
              <span>₹{totalCartCost.toFixed(2)}</span>
            </div>
            <button
              onClick={handleProceedToBilling}
              className="w-full bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded transition-colors"
            >
              Checkout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SellMultipleItems;


// import React, { useState, useEffect, useRef } from "react";
// import { useNavigate } from "react-router-dom";
// import axios from "../../api.js";
// import jsPDF from "jspdf";
// import "jspdf-autotable";

// // Child component for a single sale entry with autocomplete for item names
// function SaleEntry({ sale, index, handleSaleChange, handleSelectItem, allItems }) {
//   const [suggestions, setSuggestions] = useState([]);
//   const containerRef = useRef(null);

//   // Filter suggestions based on input
//   useEffect(() => {
//     const inputText = sale.itemName || "";
//     if (!inputText) {
//       setSuggestions([]);
//       return;
//     }
//     const lowerInput = inputText.toLowerCase();
//     const filtered = allItems.filter(item =>
//       (item.name || "").toLowerCase().includes(lowerInput)
//     );
//     filtered.sort((a, b) => {
//       const aName = (a.name || "").toLowerCase();
//       const bName = (b.name || "").toLowerCase();
//       const aStarts = aName.startsWith(lowerInput) ? 0 : 1;
//       const bStarts = bName.startsWith(lowerInput) ? 0 : 1;
//       return aStarts - bStarts || aName.localeCompare(bName);
//     });
//     setSuggestions(filtered);
//   }, [sale.itemName, allItems]);

//   // Close suggestions if click happens outside this component
//   useEffect(() => {
//     const handleClickOutside = (e) => {
//       if (containerRef.current && !containerRef.current.contains(e.target)) {
//         setSuggestions([]);
//       }
//     };
//     document.addEventListener("mousedown", handleClickOutside);
//     return () => {
//       document.removeEventListener("mousedown", handleClickOutside);
//     };
//   }, []);

//   const handleSelectSuggestion = (suggestion) => {
//     // Update the entire sale object with suggestion details
//     handleSelectItem(index, suggestion);
//     setSuggestions([]);
//   };

//   return (
//     <div className="relative" ref={containerRef}>
//       <input
//         type="text"
//         placeholder="Search item name"
//         value={sale.itemName || ""}
//         onChange={(e) => handleSaleChange(index, "itemName", e.target.value)}
//         className="w-full p-3 rounded-xl text-gray-800 placeholder-gray-500 focus:outline-none"
//         style={{
//           background: "#e0e0e0",
//           border: "1px solid rgba(255,255,255,0.3)",
//           boxShadow: "inset 4px 4px 8px #bebebe, inset -4px -4px 8px #ffffff"
//         }}
//       />
//       {suggestions.length > 0 && (
//         <ul className="absolute z-10 left-0 right-0 bg-white border rounded shadow-md mt-1 max-h-48 overflow-auto">
//           {suggestions.map((suggestion, idx) => (
//             <li
//               key={idx}
//               onMouseDown={(e) => {
//                 e.preventDefault();
//                 handleSelectSuggestion(suggestion);
//               }}
//               className="px-2 py-1 hover:bg-gray-200 cursor-pointer"
//             >
//               {suggestion.name}
//             </li>
//           ))}
//         </ul>
//       )}
//     </div>
//   );
// }

// function SellMultipleItems() {
//   const initialSale = {
//     itemName: "",
//     company: "",
//     quantity: "",
//     price: "",
//     availableQuantity: null,
//     hsn_code: "",
//     unit_price: "",
//     image: ""
//   };

//   const [sales, setSales] = useState([initialSale]);
//   const [buyer, setBuyer] = useState("");
//   const [cart, setCart] = useState([]);
//   const [message, setMessage] = useState("");
//   const [error, setError] = useState("");
//   const [allItems, setAllItems] = useState([]);
//   const navigate = useNavigate();

//   // Fetch inventory details from the API
//   useEffect(() => {
//     const fetchItems = async () => {
//       try {
//         const res = await axios.get("/inventory/");
//         const items = res.data.data || [];
//         setAllItems(items);
//       } catch (err) {
//         console.error("Error fetching inventory details:", err);
//       }
//     };
//     fetchItems();
//   }, []);

//   // Update sale on manual input change; clear company/unit_price if itemName is changed.
//   const handleSaleChange = (index, field, value) => {
//     const newSales = [...sales];
//     newSales[index][field] = value;
//     if (field === "itemName") {
//       newSales[index]["company"] = "";
//       newSales[index]["availableQuantity"] = null;
//       newSales[index]["unit_price"] = "";
//       newSales[index]["image"] = "";
//     }
//     setSales(newSales);
//   };

//   // When a suggestion is selected, update the entire sale object.
//   const handleSelectItem = (index, suggestion) => {
//     const newSales = [...sales];
//     newSales[index] = {
//       ...newSales[index],
//       itemName: suggestion.name,
//       company: suggestion.company,
//       availableQuantity: suggestion.quantity,
//       hsn_code: suggestion.hsn_code,
//       unit_price: suggestion.unit_price,
//       image: suggestion.image
//     };
//     setSales(newSales);
//   };

//   const handleAddSale = () => {
//     setSales([...sales, initialSale]);
//   };

//   const handleRemoveSale = (index) => {
//     if (sales.length > 1) {
//       setSales(sales.filter((_, i) => i !== index));
//     }
//   };

//   const handleAddToCart = (e) => {
//     e.preventDefault();
//     setError("");
//     setMessage("");
//     for (let sale of sales) {
//       if (!sale.itemName || !sale.company || !sale.quantity || !sale.price) {
//         setError("All fields (except buyer) are required for every sale entry.");
//         return;
//       }
//       if (Number(sale.quantity) <= 0 || Number(sale.price) <= 0) {
//         setError("Quantity and Price must be greater than zero for every sale entry.");
//         return;
//       }
//       if (
//         sale.availableQuantity !== null &&
//         Number(sale.quantity) > Number(sale.availableQuantity)
//       ) {
//         setError(
//           `Quantity for "${sale.itemName}" cannot exceed available stock (${sale.availableQuantity}).`
//         );
//         return;
//       }
//     }
//     if (!buyer.trim()) {
//       setError("Buyer name is required.");
//       return;
//     }
//     const updatedSales = sales.map(sale => ({
//       itemName: sale.itemName,
//       company: sale.company,
//       quantity: sale.quantity,
//       buyer: buyer.trim(),
//       price: sale.price,
//       hsn_code: sale.hsn_code
//     }));
//     setCart(prevCart => [...prevCart, ...updatedSales]);
//     setMessage("Items added to cart.");
//     setSales([initialSale]);
//   };

//   const handleProceedToBilling = () => {
//     if (cart.length === 0) {
//       setError("Cart is empty. Please add items to cart before proceeding to billing.");
//       return;
//     }
//     navigate("/billing", { state: { cart } });
//   };

//   const totalCartItems = cart.reduce((sum, item) => sum + Number(item.quantity), 0);
//   const totalCartCost = cart.reduce(
//     (sum, item) => sum + Number(item.quantity) * Number(item.price),
//     0
//   );

//   return (
//     <div className="flex flex-col md:flex-row justify-center items-start min-h-screen p-6" style={{ background: "#f3f4f6" }}>
//       <div
//         className="p-8 w-full md:w-2/3 rounded-2xl mb-4 md:mb-0 md:mr-4"
//         style={{
//           background: "#e0e0e0",
//           boxShadow: "8px 8px 16px #bebebe, -8px -8px 16px #ffffff",
//           backdropFilter: "blur(4px)"
//         }}
//       >
//         <h2 className="text-2xl font-bold mb-6 text-center" style={{ fontFamily: "Reospec", color: "#333" }}>
//           Sell Multiple Items
//         </h2>
//         {/* Buyer Field */}
//         <div className="mb-4">
//           <input
//             type="text"
//             placeholder="Buyer Name"
//             value={buyer}
//             onChange={(e) => setBuyer(e.target.value)}
//             className="w-full p-3 rounded-xl text-gray-800 placeholder-gray-500 focus:outline-none"
//             style={{
//               background: "#e0e0e0",
//               border: "1px solid rgba(255,255,255,0.3)",
//               boxShadow: "inset 4px 4px 8px #bebebe, inset -4px -4px 8px #ffffff"
//             }}
//           />
//         </div>
//         <form onSubmit={handleAddToCart} className="space-y-6">
//           {sales.map((sale, index) => (
//             <div
//               key={index}
//               className="p-4 rounded-xl mb-4"
//               style={{
//                 background: "#e0e0e0",
//                 boxShadow: "inset 4px 4px 8px #bebebe, inset -4px -4px 8px #ffffff"
//               }}
//             >
//               <div className="flex justify-between items-center mb-2">
//                 <h3 className="text-lg font-bold text-gray-800">Sale {index + 1}</h3>
//                 {sales.length > 1 && (
//                   <button
//                     type="button"
//                     onClick={() => handleRemoveSale(index)}
//                     className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded transition-all text-sm"
//                   >
//                     Remove
//                   </button>
//                 )}
//               </div>
//               <SaleEntry
//                 sale={sale}
//                 index={index}
//                 handleSaleChange={handleSaleChange}
//                 handleSelectItem={handleSelectItem}
//                 allItems={allItems}
//               />
//               {/* Item Card: shows photo, remaining quantity and buying price */}
//               {sale.itemName && sale.unit_price && (
//                 <div className="mt-2 p-4 border rounded flex items-center">
//                   {sale.image ? (
//                     <img
//                       src={sale.image}
//                       alt={sale.itemName}
//                       className="w-16 h-16 object-cover mr-4"
//                     />
//                   ) : (
//                     <div className="w-16 h-16 bg-gray-200 flex items-center justify-center mr-4 text-sm text-gray-500">
//                       No Image
//                     </div>
//                   )}
//                   <div>
//                     <p className="text-sm font-semibold">
//                       Remaining: {sale.availableQuantity}
//                     </p>
//                     <p className="text-sm">
//                       Buying Price: ₹{sale.unit_price}
//                     </p>
//                   </div>
//                 </div>
//               )}
//               <input
//                 type="text"
//                 placeholder="Company Name"
//                 value={sale.company}
//                 className="w-full p-3 rounded-xl text-gray-800 placeholder-gray-500 focus:outline-none mt-2"
//                 style={{
//                   background: "#e0e0e0",
//                   border: "1px solid rgba(255,255,255,0.3)",
//                   boxShadow: "inset 4px 4px 8px #bebebe, inset -4px -4px 8px #ffffff"
//                 }}
//                 disabled
//               />
//               <div className="grid grid-cols-2 gap-4 mt-2">
//                 <div>
//                   <input
//                     type="number"
//                     placeholder="Quantity"
//                     value={sale.quantity}
//                     onChange={(e) => handleSaleChange(index, "quantity", e.target.value)}
//                     className="w-full p-3 rounded-xl text-gray-800 placeholder-gray-500 focus:outline-none"
//                     style={{
//                       background: "#e0e0e0",
//                       border: "1px solid rgba(255,255,255,0.3)",
//                       boxShadow: "inset 4px 4px 8px #bebebe, inset -4px -4px 8px #ffffff"
//                     }}
//                     max={sale.availableQuantity || undefined}
//                   />
//                   {sale.availableQuantity !== null && (
//                     <p className="text-red-500 mt-1 text-sm">
//                       Remaining: {sale.availableQuantity - (Number(sale.quantity) || 0)}
//                     </p>
//                   )}
//                 </div>
//                 <div className="self-start">
//                   <input
//                     type="number"
//                     placeholder="Price (₹)"
//                     value={sale.price}
//                     onChange={(e) => handleSaleChange(index, "price", e.target.value)}
//                     className="w-full p-3 rounded-xl text-gray-800 placeholder-gray-500 focus:outline-none"
//                     style={{
//                       background: "#e0e0e0",
//                       border: "1px solid rgba(255,255,255,0.3)",
//                       boxShadow: "inset 4px 4px 8px #bebebe, inset -4px -4px 8px #ffffff"
//                     }}
//                   />
//                 </div>
//               </div>
//             </div>
//           ))}
//           <div className="flex justify-between">
//             <button
//               type="button"
//               onClick={handleAddSale}
//               className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded transition-all"
//             >
//               Add Another Sale
//             </button>
//             <button
//               type="submit"
//               className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded transition-all"
//             >
//               Add to Cart
//             </button>
//           </div>
//         </form>
//         {error && <p className="mt-4 text-center text-red-500">{error}</p>}
//         {message && <p className="mt-4 text-center text-green-500">{message}</p>}
//       </div>

//       {/* Right Column: Cart Summary */}
//       <div className="w-full md:w-1/3 lg:w-1/4">
//         <div className="bg-white rounded-xl shadow-md p-6 h-full flex flex-col">
//           <h2 className="text-xl font-bold mb-4" style={{ fontFamily: "Reospec" }}>
//             Cart Summary
//           </h2>
//           <div className="flex-1 overflow-auto">
//             {cart.length === 0 ? (
//               <p className="text-gray-500">No items in cart</p>
//             ) : (
//               <ul className="space-y-3">
//                 {cart.map((c, idx) => {
//                   const itemTotal = Number(c.quantity) * Number(c.price);
//                   return (
//                     <li key={idx} className="border-b pb-2">
//                       <div className="flex justify-between">
//                         <p className="text-gray-700 font-semibold">
//                           {c.itemName} <span className="text-sm text-gray-500">({c.company})</span>
//                         </p>
//                         <p className="text-gray-700">₹{itemTotal.toFixed(2)}</p>
//                       </div>
//                       <p className="text-sm text-gray-500">
//                         Qty: {c.quantity} | Price: ₹{c.price}
//                       </p>
//                     </li>
//                   );
//                 })}
//               </ul>
//             )}
//           </div>
//           <div className="mt-4 border-t pt-4 text-gray-700">
//             <div className="flex justify-between mb-1">
//               <span className="font-semibold">Total Items:</span>
//               <span>{totalCartItems}</span>
//             </div>
//             <div className="flex justify-between mb-2">
//               <span className="font-semibold">Subtotal:</span>
//               <span>₹{totalCartCost.toFixed(2)}</span>
//             </div>
//             <button
//               onClick={handleProceedToBilling}
//               className="w-full bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded transition-all"
//             >
//               Checkout
//             </button>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }

// export default SellMultipleItems;



