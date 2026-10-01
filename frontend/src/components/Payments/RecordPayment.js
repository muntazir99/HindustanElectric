import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { fetchCustomers } from '../../store/customersSlice.js';
import { recordPayment, clearPaymentMessages } from '../../store/paymentsSlice.js';
import api from '../../api.js'; // We need the api instance for our call
import StatusWrapper from '../Common/StatusWrapper.js';

function RecordPayment() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { register, handleSubmit, watch, formState: { errors }, reset } = useForm();
  
  const { items: customers, loading: customersLoading } = useSelector((state) => state.customers);
  const { loading: paymentLoading, error, successMessage } = useSelector((state) => state.payments);

  const [unpaidInvoices, setUnpaidInvoices] = useState([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false); // State for invoice loading
  const selectedCustomerId = watch("customer_id");

  useEffect(() => {
    dispatch(fetchCustomers());
    dispatch(clearPaymentMessages());
  }, [dispatch]);

  // --- START OF FIX ---
  // This useEffect now makes a real API call when a customer is selected.
  useEffect(() => {
    const fetchInvoices = async () => {
      if (selectedCustomerId) {
        setInvoicesLoading(true);
        try {
          // Use the real backend endpoint we created
          const res = await api.get(`/customers/${selectedCustomerId}/unpaid-invoices`);
          setUnpaidInvoices(res.data.data || []);
        } catch (err) {
          console.error("Failed to fetch unpaid invoices:", err);
          setUnpaidInvoices([]);
        } finally {
          setInvoicesLoading(false);
        }
      } else {
        setUnpaidInvoices([]); // Clear invoices if no customer is selected
      }
    };
    fetchInvoices();
  }, [selectedCustomerId]);
  // --- END OF FIX ---

  const onSubmit = async (data) => {
    const resultAction = await dispatch(recordPayment(data));
    if (recordPayment.fulfilled.match(resultAction)) {
      reset(); // Clear the form
      setTimeout(() => {
        navigate('/reports/aging'); // Redirect to the aging report to see the result
      }, 2000);
    }
  };

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <div className="max-w-xl mx-auto bg-white p-6 rounded-lg shadow-sm border">
        <h1 className="text-2xl font-bold mb-6">Record Customer Payment</h1>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Customer</label>
            <select
              {...register("customer_id", { required: "Please select a customer" })}
              className="w-full p-2 border rounded mt-1 capitalize"
              disabled={customersLoading}
            >
              <option value="">Select a customer...</option>
              {(customers || []).map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
            {errors.customer_id && <p className="text-red-500 text-xs mt-1">{errors.customer_id.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Unpaid Invoice</label>
            <select
              {...register("invoice_id", { required: "Please select an invoice" })}
              className="w-full p-2 border rounded mt-1"
              disabled={!selectedCustomerId || unpaidInvoices.length === 0 || invoicesLoading}
            >
              <option value="">{invoicesLoading ? "Loading invoices..." : "Select an invoice..."}</option>
              {unpaidInvoices.map(inv => <option key={inv._id} value={inv._id}>{inv.invoice_number} (₹{inv.total_amount.toFixed(2)})</option>)}
            </select>
            {errors.invoice_id && <p className="text-red-500 text-xs mt-1">{errors.invoice_id.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Amount Paid (₹)</label>
            <input
              type="number"
              step="0.01"
              className="w-full p-2 border rounded mt-1"
              {...register("amount_paid", { required: "Amount is required", valueAsNumber: true, min: { value: 0.01, message: "Amount must be positive" } })}
            />
            {errors.amount_paid && <p className="text-red-500 text-xs mt-1">{errors.amount_paid.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Payment Date</label>
            <input
              type="date"
              defaultValue={new Date().toISOString().split('T')[0]}
              className="w-full p-2 border rounded mt-1"
              {...register("payment_date", { required: "Payment date is required" })}
            />
            {errors.payment_date && <p className="text-red-500 text-xs mt-1">{errors.payment_date.message}</p>}
          </div>

          <button type="submit" disabled={paymentLoading} className="w-full bg-green-500 text-white p-3 rounded hover:bg-green-600 disabled:bg-gray-400">
            {paymentLoading ? 'Recording...' : 'Record Payment'}
          </button>

          {successMessage && <p className="mt-2 text-center text-sm text-green-600">{successMessage}</p>}
          {error && <p className="mt-2 text-center text-sm text-red-600">{error}</p>}
        </form>
      </div>
    </div>
  );
}

export default RecordPayment;