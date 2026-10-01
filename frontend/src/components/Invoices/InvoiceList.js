// src/components/Invoices/InvoiceList.js
import React, { useState, useEffect } from "react";
import axios from "../../api.js";

function InvoiceList() {
  // State for date filtering (YYYY-MM-DD)
  const [selectedDate, setSelectedDate] = useState("");
  const [invoices, setInvoices] = useState([]);
  const [invoiceSearchTerm, setInvoiceSearchTerm] = useState(""); // New state for invoice number search
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Fetch invoices from the backend endpoint (optionally filtered by date)
  useEffect(() => {
    const fetchInvoices = async () => {
      try {
        setLoading(true);
        setError("");
        let url = "/upload/bills";
        if (selectedDate) {
          url += `?date=${selectedDate}`;
        }
        const res = await axios.get(url);
        console.log("Fetched invoices:", res.data.data);  // Debug output
        setInvoices(res.data.data || []);
      } catch (err) {
        console.error("Error fetching invoices:", err);
        setError("Failed to fetch invoices.");
      } finally {
        setLoading(false);
      }
    };
    fetchInvoices();
  }, [selectedDate]);

  // Filter invoices into GST and Non-GST using the billType field.
  const gstInvoices = invoices.filter(inv => (inv.billType || "").toLowerCase() === "gst");
  const nongstInvoices = invoices.filter(inv => (inv.billType || "").toLowerCase() === "nongst");

  // Additional filter: search based on invoice number (case-insensitive)
  const filteredGSTInvoices = gstInvoices.filter(inv =>
    String(inv.invoice_number).toLowerCase().includes(invoiceSearchTerm.toLowerCase())
  );
  const filteredNonGSTInvoices = nongstInvoices.filter(inv =>
    String(inv.invoice_number).toLowerCase().includes(invoiceSearchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="p-6 flex justify-center items-center min-h-screen bg-gray-100">
        <p className="text-xl">Loading invoices...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 flex justify-center items-center min-h-screen bg-gray-100">
        <p className="text-xl text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">
        Invoices
      </h1>

      {/* Date Picker */}
      <div className="flex justify-center mb-4">
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Invoice Number Search */}
      <div className="flex justify-center mb-6">
        <input
          type="text"
          placeholder="Search invoice number..."
          value={invoiceSearchTerm}
          onChange={(e) => setInvoiceSearchTerm(e.target.value)}
          className="p-2 w-full max-w-md border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* GST Invoices Section */}
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">
          Original Invoices (GST)
        </h2>
        {filteredGSTInvoices.length === 0 ? (
          <p className="text-center text-gray-600">
            No GST invoices found{selectedDate ? ` for ${selectedDate}` : ""}.
          </p>
        ) : (
          <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {filteredGSTInvoices.map((invoice) => (
              <div
                key={invoice.invoice_number}
                className="bg-white border border-gray-300 rounded-lg shadow-sm p-6"
              >
                <h3 className="text-xl font-bold text-gray-800 mb-2">
                  Invoice #{invoice.invoice_number}
                </h3>
                <p className="text-gray-600 mb-1">
                  Uploaded: {new Date(invoice.uploaded_at).toLocaleString()}
                </p>
                <p className="text-sm text-gray-500 mb-2">Original Invoice</p>
                <a
                  href={invoice.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline text-sm"
                >
                  View PDF
                </a>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Non-GST Invoices Section */}
      <div>
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">
          Normal Invoices (Non-GST)
        </h2>
        {filteredNonGSTInvoices.length === 0 ? (
          <p className="text-center text-gray-600">
            No Non-GST invoices found{selectedDate ? ` for ${selectedDate}` : ""}.
          </p>
        ) : (
          <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {filteredNonGSTInvoices.map((invoice) => (
              <div
                key={invoice.invoice_number}
                className="bg-white border border-gray-300 rounded-lg shadow-sm p-6"
              >
                <h3 className="text-xl font-bold text-gray-800 mb-2">
                  Invoice #{invoice.invoice_number}
                </h3>
                <p className="text-gray-600 mb-1">
                  Uploaded: {new Date(invoice.uploaded_at).toLocaleString()}
                </p>
                <p className="text-sm text-gray-500 mb-2">Normal Invoice</p>
                <a
                  href={invoice.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline text-sm"
                >
                  View PDF
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default InvoiceList;
