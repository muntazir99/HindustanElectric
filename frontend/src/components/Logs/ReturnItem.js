
// import React, { useState } from "react";
// import axios from "../../api.js";

// function ReturnItem() {
//   const [itemName, setItemName] = useState("");
//   const [quantity, setQuantity] = useState(0);
//   const [buyer, setBuyer] = useState(""); // Renamed from 'taker' to 'buyer'
//   const [message, setMessage] = useState("");

//   const handleReturn = async (e) => {
//     e.preventDefault();
//     setMessage("");
//     try {
//       const res = await axios.post("/logs/return", {
//         item_name: itemName,
//         quantity,
//         buyer, // Now sending buyer
//       });
//       setMessage(res.data.message);
//     } catch (err) {
//       setMessage("Failed to return item. Please try again.");
//     }
//   };

//   return (
//     <div className="flex justify-center items-center min-h-screen bg-gray-100">
//       <div className="bg-white p-6 rounded shadow-lg w-full max-w-sm">
//         <h2 className="text-xl font-bold mb-4">Return Item</h2>
//         <form onSubmit={handleReturn}>
//           <input
//             type="text"
//             placeholder="Item Name"
//             value={itemName}
//             onChange={(e) => setItemName(e.target.value)}
//             className="w-full p-2 border rounded mb-4"
//           />
//           <input
//             type="number"
//             placeholder="Quantity"
//             value={quantity}
//             onChange={(e) => setQuantity(Number(e.target.value))}
//             className="w-full p-2 border rounded mb-4"
//           />
//           <input
//             type="text"
//             placeholder="Buyer Name"  // Updated placeholder
//             value={buyer}
//             onChange={(e) => setBuyer(e.target.value)}
//             className="w-full p-2 border rounded mb-4"
//           />
//           <button
//             type="submit"
//             className="w-full bg-blue-500 text-white p-2 rounded"
//           >
//             Return Item
//           </button>
//         </form>
//         {message && <p className="mt-4 text-center text-blue-500">{message}</p>}
//       </div>
//     </div>
//   );
// }

// export default ReturnItem;


import React, { useState } from "react";
import axios from "../../api.js";

function ReturnItem() {
  const [itemName, setItemName] = useState("");
  const [company, setCompany] = useState("");  // New field for Company Name
  const [quantity, setQuantity] = useState(0);
  const [buyer, setBuyer] = useState("");
  const [message, setMessage] = useState("");

  const handleReturn = async (e) => {
    e.preventDefault();
    setMessage("");
    try {
      const res = await axios.post("/logs/return", {
        item_name: itemName,
        company,       // Sending company along with the return data
        quantity,
        buyer,
      });
      setMessage(res.data.message);
    } catch (err) {
      setMessage("Failed to return item. Please try again.");
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-100">
      <div className="bg-white p-6 rounded shadow-lg w-full max-w-sm">
        <h2 className="text-xl font-bold mb-4">Return Item</h2>
        <form onSubmit={handleReturn} className="space-y-4">
          <input
            type="text"
            placeholder="Item Name"
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            className="w-full p-2 border rounded mb-4"
          />
          <input
            type="text"
            placeholder="Company Name"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            className="w-full p-2 border rounded mb-4"
          />
          <input
            type="number"
            placeholder="Quantity"
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            className="w-full p-2 border rounded mb-4"
          />
          <input
            type="text"
            placeholder="Buyer Name"
            value={buyer}
            onChange={(e) => setBuyer(e.target.value)}
            className="w-full p-2 border rounded mb-4"
          />
          <button type="submit" className="w-full bg-blue-500 text-white p-2 rounded">
            Return Item
          </button>
        </form>
        {message && <p className="mt-4 text-center text-blue-500">{message}</p>}
      </div>
    </div>
  );
}

export default ReturnItem;
