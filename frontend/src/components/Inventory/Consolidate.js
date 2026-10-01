import React, { useState } from "react";
import axios from "../../api.js";

function Consolidate() {
  const [message, setMessage] = useState("");

  const handleConsolidate = async () => {
    try {
      const res = await axios.post("/inventory/consolidate");
      setMessage(res.data.message);
    } catch (err) {
      setMessage("Failed to consolidate inventory. Please try again.");
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-100">
      <div className="bg-white p-6 rounded shadow-lg w-full max-w-sm text-center">
        <h2 className="text-xl font-bold mb-4">Consolidate Inventory</h2>
        <button
          onClick={handleConsolidate}
          className="w-full bg-purple-500 text-white p-2 rounded"
        >
          Consolidate
        </button>
        {message && <p className="mt-4 text-purple-500">{message}</p>}
      </div>
    </div>
  );
}

export default Consolidate;
