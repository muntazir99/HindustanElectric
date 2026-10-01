import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useForm } from 'react-hook-form';
import { fetchCustomers, addCustomer } from '../../store/customersSlice.js';
import StatusWrapper from '../Common/StatusWrapper.js';

import api from '../../api.js';

function CustomerManager() {
  const dispatch = useDispatch();
  const { items: customers, loading, error } = useSelector((state) => state.customers);
  const { register, handleSubmit, formState: { errors }, reset } = useForm();
  const [serverMessage, setServerMessage] = useState("");
  const [serverError, setServerError] = useState("");

  // Local state for risk scores
  const [riskScores, setRiskScores] = useState({});
  const [loadingRisk, setLoadingRisk] = useState({});

  useEffect(() => {
    dispatch(fetchCustomers());
  }, [dispatch]);

  const onSubmit = async (data) => {
    setServerMessage("");
    setServerError("");
    const resultAction = await dispatch(addCustomer(data));
    if (addCustomer.fulfilled.match(resultAction)) {
      setServerMessage("Customer added successfully!");
      reset();
    } else {
      setServerError(resultAction.payload || "An error occurred.");
    }
  };

  const handleCheckRisk = async (customerId) => {
    setLoadingRisk(prev => ({ ...prev, [customerId]: true }));
    try {
      const res = await api.get(`/ai/credit-score/${customerId}`);
      if (res.data.success) {
        setRiskScores(prev => ({ ...prev, [customerId]: res.data.data }));
      }
    } catch (err) {
      console.error("Failed to fetch risk score", err);
    } finally {
      setLoadingRisk(prev => ({ ...prev, [customerId]: false }));
    }
  };

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Add Customer Form */}
        <div className="md:col-span-1 bg-white p-6 rounded-lg shadow-sm border">
          <h2 className="text-2xl font-bold mb-4">Add New Customer</h2>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Customer Name</label>
              <input
                type="text"
                className="w-full p-2 border rounded mt-1"
                {...register("name", { required: "Customer name is required" })}
              />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">GSTIN (Optional)</label>
              <input type="text" className="w-full p-2 border rounded mt-1" {...register("gstin")} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Address (Optional)</label>
              <textarea className="w-full p-2 border rounded mt-1" {...register("address")} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Credit Limit (₹)</label>
              <input type="number" step="0.01" defaultValue="0" className="w-full p-2 border rounded mt-1" {...register("credit_limit", { valueAsNumber: true, min: 0 })} />
            </div>
            {/* --- NEW TIERED PRICING FIELD --- */}
            <div>
              <label className="block text-sm font-medium text-gray-700">Price Tier</label>
              <select {...register("price_tier")} className="w-full p-2 border rounded mt-1 bg-white">
                <option value="Retail">Retail</option>
                <option value="Wholesale_A">Wholesale A</option>
                <option value="Wholesale_B">Wholesale B</option>
              </select>
            </div>
            {/* --- END OF NEW FIELD --- */}
            <button type="submit" disabled={loading} className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600 disabled:bg-gray-400">
              {loading ? 'Saving...' : 'Save Customer'}
            </button>
            {serverMessage && <p className="mt-2 text-sm text-green-500">{serverMessage}</p>}
            {serverError && <p className="mt-2 text-sm text-red-500">{serverError}</p>}
          </form>
        </div>

        {/* Customer List */}
        <div className="md:col-span-2 bg-white p-6 rounded-lg shadow-sm border">
          <h2 className="text-2xl font-bold mb-4">Wholesale Customers</h2>
          <StatusWrapper loading={loading && (!customers || customers.length === 0)} error={error}>
            <div className="overflow-x-auto">
              <table className="w-full table-auto">
                <thead>
                  <tr className="bg-gray-200">
                    <th className="px-4 py-2 text-left">Name</th>
                    <th className="px-4 py-2 text-left">Price Tier</th>
                    <th className="px-4 py-2 text-right">Credit Limit</th>
                    <th className="px-4 py-2 text-right">Balance</th>
                    <th className="px-4 py-2 text-center">AI Risk Check</th> {/* New Column */}
                  </tr>
                </thead>
                <tbody>
                  {(customers || []).map((customer) => {
                    const scoreData = riskScores[customer._id];
                    return (
                      <tr key={customer._id} className="border-b">
                        <td className="px-4 py-2 capitalize">{customer.name}</td>
                        <td className="px-4 py-2">{customer.price_tier}</td>
                        <td className="px-4 py-2 text-right">₹{Number(customer.credit_limit).toFixed(2)}</td>
                        <td className="px-4 py-2 text-right">₹{Number(customer.current_balance).toFixed(2)}</td>
                        <td className="px-4 py-2 text-center">
                          {scoreData ? (
                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${scoreData.risk_level === "High" ? "bg-red-100 text-red-800" :
                                scoreData.risk_level === "Medium" ? "bg-yellow-100 text-yellow-800" :
                                  "bg-green-100 text-green-800"
                              }`}>
                              {scoreData.score}/100 ({scoreData.risk_level})
                            </span>
                          ) : (
                            <button
                              onClick={() => handleCheckRisk(customer._id)}
                              disabled={loadingRisk[customer._id]}
                              className="text-white bg-indigo-500 hover:bg-indigo-600 px-3 py-1 rounded text-xs disabled:opacity-50"
                            >
                              {loadingRisk[customer._id] ? "Analyzing..." : "Check Score"}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {(!customers || customers.length === 0) && <p className="text-center text-gray-500 mt-4">No customers found.</p>}
            </div>
          </StatusWrapper>
        </div>
      </div>
    </div>
  );
}

export default CustomerManager;