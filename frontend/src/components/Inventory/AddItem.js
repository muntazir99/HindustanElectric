import React, { useState, useEffect, useRef } from "react";
import { useForm, useWatch } from "react-hook-form";
import api from "../../api.js";
import { UploadIcon, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

function AddItem() {
  const { register, handleSubmit, control, formState: { errors }, reset, setValue, watch } = useForm();
  const [imageFile, setImageFile] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [availableNames, setAvailableNames] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(false);
  const suggestionsRef = useRef(null);
  const navigate = useNavigate();

  // Restock Mode State
  const [isRestockMode, setIsRestockMode] = useState(false);
  const [currentItem, setCurrentItem] = useState(null);

  // Watch fields for logic
  const itemNameValue = watch("name", "");

  // Watch Restock fields (using register names 'new_quantity' and 'new_unit_price')
  const newInputs = useWatch({
    control,
    name: ["new_quantity", "new_unit_price"]
  });
  const newQuantity = newInputs[0];
  const newUnitPrice = newInputs[1];

  // Derived state for WAC preview
  const [projectedData, setProjectedData] = useState({ qty: 0, price: 0 });

  useEffect(() => {
    const fetchAvailableNames = async () => {
      try {
        const res = await api.get("/inventory/names");
        setAvailableNames(res.data.data || []);
      } catch (err) {
        console.error("Error fetching item names:", err);
      }
    };
    fetchAvailableNames();
  }, []);

  // Calculate WAC whenever inputs change in Restock Mode
  useEffect(() => {
    if (isRestockMode && currentItem) {
      const currentQty = Number(currentItem.quantity) || 0;
      const currentPrice = Number(currentItem.unit_price) || 0;

      const addedQty = Number(newQuantity) || 0;
      const addedPrice = Number(newUnitPrice) || 0;

      const finalQty = currentQty + addedQty;

      // Preview only (Logic moved to backend)
      let finalPrice = currentPrice;
      if (finalQty > 0) {
        const totalValue = (currentQty * currentPrice) + (addedQty * addedPrice);
        finalPrice = totalValue / finalQty;
      }

      setProjectedData({
        qty: finalQty,
        price: finalPrice
      });
    }
  }, [newQuantity, newUnitPrice, isRestockMode, currentItem]);


  const handleSuggestionClick = async (suggestion) => {
    setShowSuggestions(false);
    setFetchLoading(true);
    try {
      const res = await api.get(`/inventory/item/${suggestion._id}`);
      const data = res.data.data;

      // Enable Restock Mode
      setIsRestockMode(true);
      setCurrentItem(data);

      // Reset form clearly for Restock inputs
      reset({
        new_quantity: "",
        new_unit_price: "" // Start empty so user inputs the new bill price
      });

    } catch (err) {
      console.error("Error fetching item details:", err);
      setError("Could not fetch item details.");
    } finally {
      setFetchLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) setImageFile(file);
  };

  const resetMode = () => {
    setIsRestockMode(false);
    setCurrentItem(null);
    reset();
    setImageFile(null);
    setMessage("");
    setError("");
  };

  const onSubmit = async (data) => {
    setError("");
    setMessage("");
    setLoading(true);

    try {
      if (isRestockMode) {
        // --- RESTOCK FLOW (Using dedicated endpoint) ---
        if (!currentItem) throw new Error("Item state missing.");

        const payload = {
          id: currentItem._id,
          added_quantity: data.new_quantity,
          new_unit_price: data.new_unit_price, // Sending raw bill price
        };

        const res = await api.post("/inventory/restock", payload);
        const { new_wac, max_price, min_price } = res.data.data;

        setMessage(`Success! Stock updated. New Avg Price: ₹${new_wac.toFixed(2)} (Max: ₹${max_price}, Min: ₹${min_price})`);

        // Tiny delay then clear
        setTimeout(() => resetMode(), 2000);

      } else {
        // --- NEW ITEM FLOW ---
        const formData = new FormData();

        // Standard additions
        Object.keys(data).forEach(key => {
          const value = data[key];
          if (value !== null && value !== undefined && !Number.isNaN(value) && key !== 'file') {
            formData.append(key, value);
          }
        });

        if (imageFile) formData.append("file", imageFile);

        // Date fix
        if (data.date) formData.append("date_of_addition", data.date);
        formData.delete('date');

        await api.post("/inventory/add", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });

        setMessage("Item added successfully.");
        reset();
        setImageFile(null);
      }
    } catch (err) {
      console.error(err);
      setError(err.message || err.response?.data?.message || "Operation failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen p-6 bg-gray-100">
      <div className="p-8 w-full max-w-2xl rounded-lg bg-white border border-gray-300 shadow-lg">

        {/* Header - Changes based on mode */}
        <div className="flex justify-between items-center mb-6 border-b pb-4">
          <h2 className="text-3xl font-bold text-blue-900" style={{ fontFamily: "Reospec" }}>
            {isRestockMode ? "Restock Item" : "New Item"}
          </h2>
          {isRestockMode && (
            <button onClick={resetMode} className="text-sm text-gray-500 hover:text-red-500 underline">
              Cancel / New Item
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

          {/* NEW ITEM SEARCH / NAME INPUT */}
          {!isRestockMode && (
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">Item Name (Type to check availability)</label>
              <input
                type="text"
                placeholder="Start typing name..."
                className="w-full p-4 rounded-lg border-2 border-blue-100 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all text-lg"
                {...register("name", { required: !isRestockMode ? "Name required" : false })}
                onFocus={() => setShowSuggestions(true)}
                autoComplete="off"
              />

              {/* Suggestions Dropdown */}
              {showSuggestions && itemNameValue && (
                <div ref={suggestionsRef} className="absolute z-10 w-full mt-1 bg-white rounded-lg shadow-xl border border-gray-200 max-h-60 overflow-auto text-sm">
                  {availableNames
                    .filter((s) => s.name.toLowerCase().includes(itemNameValue.toLowerCase()))
                    .map((suggestion) => (
                      <div
                        key={suggestion._id}
                        className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b last:border-0 flex justify-between items-center group"
                        onMouseDown={() => handleSuggestionClick(suggestion)}
                      >
                        <div>
                          <span className="font-bold text-gray-800 text-lg">{suggestion.name}</span>
                          <span className="text-gray-500 text-sm block">{suggestion.company}</span>
                        </div>
                        <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs group-hover:bg-green-200">Restock This</span>
                      </div>
                    ))}
                  <div className="px-4 py-3 bg-gray-50 border-t text-center text-gray-500 text-xs">
                    Keep typing to create new...
                  </div>
                </div>
              )}
            </div>
          )}

          {/* === RESTOCK MODE UI === */}
          {isRestockMode && currentItem && (
            <div className="animate-fade-in-down space-y-6">
              {/* Existing Details Card */}
              <div className="bg-blue-50 p-6 rounded-xl border border-blue-200 flex flex-col gap-4 shadow-inner">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-xl font-bold text-blue-900">{currentItem.name}</h3>
                    <p className="text-blue-600">{currentItem.company}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Current Stock</p>
                    <p className="text-2xl font-bold">{currentItem.quantity}</p>
                  </div>
                  <div className="text-right pl-6 border-l border-blue-200">
                    <p className="text-sm text-gray-500">Current Price</p>
                    <p className="text-2xl font-bold">₹{Number(currentItem.unit_price).toFixed(2)}</p>
                  </div>
                </div>

                {/* Historical Price Info */}
                {(currentItem.historical_max_price || currentItem.historical_min_price) && (
                  <div className="flex gap-4 border-t border-blue-200 pt-3 mt-1 text-sm bg-blue-100/50 p-2 rounded">
                    <div className="flex-1 text-center border-r border-blue-300">
                      <span className="block text-gray-600">Max Paid</span>
                      <span className="font-bold text-red-600">
                        {currentItem.historical_max_price ? `₹${Number(currentItem.historical_max_price).toFixed(2)}` : 'N/A'}
                      </span>
                    </div>
                    <div className="flex-1 text-center">
                      <span className="block text-gray-600">Min Paid</span>
                      <span className="font-bold text-green-600">
                        {currentItem.historical_min_price ? `₹${Number(currentItem.historical_min_price).toFixed(2)}` : 'N/A'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Restock Inputs */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-gray-800 mb-2">Quantity to Add</label>
                  <input
                    type="number"
                    placeholder="e.g. 10"
                    className="w-full p-4 border-2 border-green-200 rounded-lg focus:border-green-500 focus:ring-green-200 text-xl font-bold"
                    {...register("new_quantity", { required: true, valueAsNumber: true, min: 1 })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-800 mb-2">New Unit Price (Bill Price)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 120"
                    className="w-full p-4 border-2 border-green-200 rounded-lg focus:border-green-500 focus:ring-green-200 text-xl font-bold"
                    {...register("new_unit_price", { required: true, valueAsNumber: true, min: 0.01 })}
                  />
                </div>
              </div>

              {/* Calculated Preview */}
              {(newQuantity > 0) && (
                <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="text-yellow-600" />
                    <div>
                      <p className="font-bold text-yellow-900">Projected Overview</p>
                      <p className="text-sm text-yellow-700">Final price will be calculated securely by server.</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Est. Avg Price</p>
                    <p className="text-2xl font-bold text-green-700">~₹{projectedData.price.toFixed(2)}</p>
                    <p className="text-xs text-gray-400">Total Qty: {projectedData.qty}</p>
                  </div>
                </div>
              )}
            </div>
          )}


          {/* === NEW ITEM MODE UI === */}
          {!isRestockMode && (
            <>
              {/* Full Form Fields - Grouped (Simplified for brevity as standard mode logic is same) */}
              {/* Section 1: Basic Information */}
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
                  <span className="bg-blue-100 text-blue-600 w-6 h-6 rounded-full flex items-center justify-center text-sm">1</span>
                  Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Company / Brand</label>
                    <input
                      type="text"
                      placeholder="e.g. Philips"
                      className="w-full p-3 rounded-lg border border-gray-300"
                      {...register("company", { required: !isRestockMode ? "Company name is required" : false })}
                    />
                    {errors.company && <p className="text-red-500 text-sm mt-1">{errors.company.message}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Lighting"
                      className="w-full p-3 rounded-lg border border-gray-300"
                      {...register("category")}
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Pricing & Stock */}
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
                  <span className="bg-green-100 text-green-600 w-6 h-6 rounded-full flex items-center justify-center text-sm">2</span>
                  Pricing & Stock
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Unit Price (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      className="w-full p-3 rounded-lg border border-gray-300"
                      {...register("unit_price", { required: !isRestockMode ? "Required" : false, valueAsNumber: true, min: { value: 0.01, message: "Must be positive" } })}
                    />
                    {errors.unit_price && <p className="text-red-500 text-sm mt-1">{errors.unit_price.message}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Initial Quantity</label>
                    <input
                      type="number"
                      placeholder="0"
                      className="w-full p-3 rounded-lg border border-gray-300"
                      {...register("quantity", { required: !isRestockMode ? "Required" : false, valueAsNumber: true, min: { value: 1, message: "Min 1" } })}
                    />
                    {errors.quantity && <p className="text-red-500 text-sm mt-1">{errors.quantity.message}</p>}
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Low Stock Limit</label>
                    <input
                      type="number"
                      placeholder="e.g. 5"
                      className="w-full p-3 rounded-lg border border-gray-300"
                      {...register("minimum_stock", { valueAsNumber: true, min: { value: 0, message: "Cannot be negative" } })}
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Tracking */}
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
                  <span className="bg-purple-100 text-purple-600 w-6 h-6 rounded-full flex items-center justify-center text-sm">3</span>
                  Tracking
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Barcode</label>
                    <input
                      type="text"
                      placeholder="Scan or type"
                      className="w-full p-3 rounded-lg border border-gray-300"
                      {...register("barcode", { required: !isRestockMode ? "Required" : false })}
                    />
                    {errors.barcode && <p className="text-red-500 text-sm mt-1">{errors.barcode.message}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">HSN Code</label>
                    <input
                      type="text"
                      placeholder="1234..."
                      className="w-full p-3 rounded-lg border border-gray-300"
                      {...register("hsn_code", { required: !isRestockMode ? "Required" : false })}
                    />
                    {errors.hsn_code && <p className="text-red-500 text-sm mt-1">{errors.hsn_code.message}</p>}
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Entry Date</label>
                    <input
                      type="date"
                      className="w-full p-3 rounded-lg border border-gray-300"
                      {...register("date", { required: !isRestockMode ? "Date is required" : false })}
                    />
                    {errors.date && <p className="text-red-500 text-sm mt-1">{errors.date.message}</p>}
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <label htmlFor="file" className="flex gap-3 justify-center items-center w-full p-4 rounded-lg border-2 border-dashed border-gray-300 hover:bg-gray-50 cursor-pointer">
                  <input type="file" id="file" onChange={handleFileChange} className="hidden" accept="image/*,application/pdf" />
                  <UploadIcon className="text-gray-500" />
                  <span className="text-gray-600 font-medium">{imageFile ? imageFile.name : "Upload Image / PDF (Optional)"}</span>
                  {imageFile && <button type="button" onClick={(e) => { e.preventDefault(); setImageFile(null); }} className="text-red-500 hover:text-red-700 font-bold ml-2">Remove</button>}
                </label>
              </div>
            </>
          )}


          {fetchLoading && <p className="text-center text-blue-600 font-medium animate-pulse">Loading...</p>}

          <button type="submit" disabled={loading} className={`w-full text-white font-bold text-lg py-4 rounded-lg shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5 ${isRestockMode ? "bg-blue-600 hover:bg-blue-700" : "bg-green-600 hover:bg-green-700"}`}>
            {loading ? "Processing..." : isRestockMode ? "Confirm Restock" : "Save New Item"}
          </button>
        </form>

        {error && <p className="mt-4 text-center text-red-500 font-bold">{error}</p>}
        {message && <p className="mt-4 text-center text-green-500 font-bold">{message}</p>}
      </div>
    </div>
  );
}

export default AddItem;// // src/components/Inventory/AddItem.js
// import React, { useState, useEffect, useRef } from "react";
// import axios from "../../api.js";
// import { UploadIcon } from "lucide-react";

// function AddItem() {
//   const initialItem = {
//     name: "",
//     company: "",
//     unitPrice: "",
//     quantity: "",
//     date: "",
//     category: "",
//     minimumStock: "",
//     barcode: "",
//     file: "",   // Not required; optional image upload.
//     hsn_code: "",
//   };

//   const [item, setItem] = useState(initialItem);
//   const [imageFile, setImageFile] = useState(null); // File upload state (optional)
//   const [message, setMessage] = useState("");
//   const [error, setError] = useState("");
//   const [availableNames, setAvailableNames] = useState([]);
//   const [showSuggestions, setShowSuggestions] = useState(false);
//   const suggestionsRef = useRef(null);
//   const [loading, setLoading] = useState(false);
//   const [fetchLoading, setFetchLoading] = useState(false);

//   useEffect(() => {
//     const fetchAvailableNames = async () => {
//       setLoading(true);
//       try {
//         const res = await axios.get("/inventory/names");
//         setAvailableNames(res.data.data || []);
//       } catch (err) {
//         console.error("Error fetching item names:", err);
//       } finally {
//         setLoading(false);
//       }
//     };
//     fetchAvailableNames();
//   }, []);

//   const handleNameChange = (e) => {
//     setItem({ ...item, name: e.target.value });
//     setShowSuggestions(true);
//   };

//   const handleSuggestionClick = async (suggestion) => {
//     setShowSuggestions(false);
//     setFetchLoading(true);
//     try {
//       const res = await axios.get(`/ inventory / item / ${ suggestion.object_id } `);
//       const data = res.data.data;
//       setItem({
//         name: data.name || "",
//         company: data.company || "",
//         unitPrice: data.unit_price || "",
//         // quantity: data.quantity || "",
//         date: "",
//         category: data.category || "",
//         minimumStock: data.minimum_stock || "",
//         barcode: data.barcode || "",
//         hsn_code: data.hsn_code || "",
//       });
//     } catch (err) {
//       console.error("Error fetching item details:", err);
//     } finally {
//       setFetchLoading(false);
//     }
//   };

//   const handleClickOutside = (e) => {
//     if (suggestionsRef.current && !suggestionsRef.current.contains(e.target)) {
//       setShowSuggestions(false);
//     }
//   };

//   useEffect(() => {
//     document.addEventListener("mousedown", handleClickOutside);
//     return () => document.removeEventListener("mousedown", handleClickOutside);
//   }, []);

//   const handleChange = (field, value) => {
//     setItem({ ...item, [field]: value });
//   };

//   const handleFileChange = (e) => {
//     const file = e.target.files[0];
//     if (!file) return;

//     // Allowed file types (image/PDF)
//     const validTypes = [
//       "image/png",
//       "image/jpeg",
//       "image/jpg",
//       "image/gif",
//       "image/bmp",
//       "image/webp",
//       "application/pdf",
//     ];
//     if (!validTypes.includes(file.type)) {
//       alert("Please upload a valid file (JPG, PNG, WebP, GIF, BMP or PDF).");
//       return;
//     }

//     setImageFile(file);
//   };

//   const handleSubmit = async (e) => {
//     e.preventDefault();
//     setError("");
//     setMessage("");
//     setLoading(true);

//     // Validate required fields (note: file/image is now optional)
//     if (
//       !item.name ||
//       !item.company ||
//       !item.unitPrice ||
//       !item.quantity ||
//       !item.date ||
//       !item.hsn_code ||
//       !item.barcode
//     ) {
//       setError("Name, Company, Unit Price, Quantity, Date, Barcode, and HSN Code are required.");
//       setLoading(false);
//       return;
//     }

//     // Validate numeric fields
//     const unitPrice = Number(item.unitPrice);
//     const quantity = Number(item.quantity);
//     const minimumStock = item.minimumStock ? Number(item.minimumStock) : null;

//     if (unitPrice <= 0 || quantity <= 0) {
//       setError("Unit Price and Quantity must be greater than zero.");
//       setLoading(false);
//       return;
//     }

//     if (minimumStock !== null && minimumStock < 0) {
//       setError("Minimum Stock cannot be negative.");
//       setLoading(false);
//       return;
//     }

//     try {
//       const formData = new FormData();
//       formData.append("name", item.name.trim().toLowerCase());
//       formData.append("company", item.company.trim().toLowerCase());
//       formData.append("unit_price", item.unitPrice);
//       formData.append("quantity", item.quantity);
//       formData.append("date_of_addition", item.date);
//       formData.append("barcode", item.barcode);
//       formData.append("hsn_code", item.hsn_code);

//       if (item.category) {
//         formData.append("category", item.category);
//       }
//       if (minimumStock !== null) {
//         formData.append("minimum_stock", minimumStock);
//       }
//       // Only append file if one was selected; file upload is optional.
//       if (imageFile) {
//         formData.append("file", imageFile);
//       }

//       const res = await axios.post("/inventory/add", formData, {
//         headers: {
//           "Content-Type": "multipart/form-data",
//           Authorization: `Bearer ${ localStorage.getItem("token") } `,
//         },
//       });

//       setMessage(res.data.message || "Item added successfully.");
//       setItem(initialItem);
//       setImageFile(null);
//       document.getElementById("file").value = null; // Clear file input
//     } catch (err) {
//       console.error(err);
//       setError(err.response?.data?.message || "Failed to add item. Please try again.");
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <div className="flex justify-center items-center min-h-screen p-6 bg-gray-100">
//       <div className="p-8 w-full max-w-md rounded-lg bg-white border border-gray-300 shadow-sm">
//         <h2
//           className="text-2xl font-bold mb-6 text-center text-gray-800"
//           style={{ fontFamily: "Reospec" }}
//         >
//           Add Inventory Item
//         </h2>

//         <form onSubmit={handleSubmit} className="space-y-4">
//           {/* Item Name with suggestions */}
//           <div className="relative">
//             <input
//               type="text"
//               placeholder="Item Name"
//               value={item.name}
//               onChange={handleNameChange}
//               onFocus={() => setShowSuggestions(true)}
//               className="w-full p-3 rounded-lg border border-gray-300 text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
//             />
//             {showSuggestions && (
//               <div
//                 ref={suggestionsRef}
//                 className="absolute z-10 w-full mt-1 bg-gray-50 rounded-lg shadow-md max-h-40 overflow-auto text-gray-800 text-sm"
//               >
//                 {!loading ? (
//                   availableNames
//                     .filter((suggestion) =>
//                       suggestion.name.toLowerCase().includes(item.name.toLowerCase())
//                     )
//                     .map((suggestion, idx) => (
//                       <div
//                         key={idx}
//                         className="px-3 py-2 hover:bg-gray-200 cursor-pointer"
//                         onMouseDown={() => handleSuggestionClick(suggestion)}
//                       >
//                         {suggestion.name}
//                       </div>
//                     ))
//                 ) : (
//                   <p className="px-5 py-2">Loading...</p>
//                 )}
//               </div>
//             )}
//           </div>

//           <input
//             type="text"
//             placeholder="Company Name"
//             value={item.company}
//             onChange={(e) => handleChange("company", e.target.value)}
//             className="w-full p-3 rounded-lg border border-gray-300 text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
//           />

//           <div className="grid grid-cols-2 gap-4">
//             <input
//               type="number"
//               placeholder="Unit Price (₹)"
//               value={item.unitPrice}
//               onChange={(e) => handleChange("unitPrice", e.target.value)}
//               className="w-full p-3 rounded-lg border border-gray-300 text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
//             />
//             <input
//               type="number"
//               placeholder="Total Quantity"
//               value={item.quantity}
//               onChange={(e) => handleChange("quantity", e.target.value)}
//               className="w-full p-3 rounded-lg border border-gray-300 text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
//             />
//           </div>

//           <div className="grid grid-cols-2 gap-4">
//             <input
//               type="date"
//               value={item.date}
//               onChange={(e) => handleChange("date", e.target.value)}
//               className="w-full p-3 rounded-lg border border-gray-300 text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
//             />
//             <input
//               type="text"
//               placeholder="Category"
//               value={item.category}
//               onChange={(e) => handleChange("category", e.target.value)}
//               className="w-full p-3 rounded-lg border border-gray-300 text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
//             />
//           </div>

//           <input
//             type="number"
//             placeholder="Minimum Stock (optional)"
//             value={item.minimumStock}
//             onChange={(e) => handleChange("minimumStock", e.target.value)}
//             className="w-full p-3 rounded-lg border border-gray-300 text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
//           />
//           <input
//             type="text"
//             placeholder="Barcode"
//             value={item.barcode}
//             onChange={(e) => handleChange("barcode", e.target.value)}
//             className="w-full p-3 rounded-lg border border-gray-300 text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
//           />
//           <input
//             type="text"
//             placeholder="HSN Code"
//             value={item.hsn_code}
//             onChange={(e) => handleChange("hsn_code", e.target.value)}
//             className="w-full p-3 rounded-lg border border-gray-300 text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
//           />

//           {/* Custom file upload: Optional */}
//           <input
//             type="file"
//             accept="image/png,image/jpeg,image/gif,image/bmp,image/webp,application/pdf"
//             id="file"
//             onChange={handleFileChange}
//             className="hidden"
//           />

//           <div className="flex gap-2 justify-between items-center w-full p-3 rounded-lg border border-gray-300 bg-white text-gray-800 cursor-pointer focus:outline-none">
//             <label htmlFor="file" className="flex gap-2 items-center cursor-pointer">
//               <UploadIcon />
//               <span>{imageFile ? imageFile.name : "Upload Image / PDF (Optional)"}</span>
//             </label>
//             {imageFile && (
//               <button
//                 onClick={(e) => {
//                   e.stopPropagation();
//                   setImageFile(null);
//                   document.getElementById("file").value = null;
//                 }}
//                 className="text-red-500"
//                 title="Clear file"
//               >
//                 ❌
//               </button>
//             )}
//           </div>

//           {fetchLoading && (
//             <small className="block text-center text-gray-500">
//               Autofilling details...
//             </small>
//           )}

//           <div className="flex justify-between">
//             <button
//               type="button"
//               onClick={() => {
//                 setItem(initialItem);
//                 setImageFile(null);
//               }}
//               className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded transition-colors"
//             >
//               Clear & New
//             </button>
//             <button
//               type="submit"
//               className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded transition-colors"
//             >
//               {loading ? "Adding..." : "Add Item"}
//             </button>
//           </div>
//         </form>

//         {error && <p className="mt-4 text-center text-red-500">{error}</p>}
//         {message && <p className="mt-4 text-center text-green-500">{message}</p>}
//       </div>
//     </div>
//   );
// }

// export default AddItem;
