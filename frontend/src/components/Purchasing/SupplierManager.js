import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useGetSuppliersQuery, useAddSupplierMutation } from '../../api/suppliersApi.js';
import StatusWrapper from '../Common/StatusWrapper.js';

function SupplierManager() {
  const { data: suppliers = [], isLoading, isError, error } = useGetSuppliersQuery();
  const [addSupplier, { isLoading: isAdding }] = useAddSupplierMutation();

  const { register, handleSubmit, formState: { errors }, reset } = useForm();
  const [serverMessage, setServerMessage] = useState("");

  const onSubmit = async (data) => {
    setServerMessage("");
    try {
      await addSupplier(data).unwrap();
      setServerMessage("Supplier added successfully!");
      reset();
    } catch (err) {
      setServerMessage(err.message || "An error occurred.");
    }
  };

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Add Supplier Form */}
        <div className="md:col-span-1 bg-white p-6 rounded-lg shadow-sm border">
          <h2 className="text-2xl font-bold mb-4">Add New Supplier</h2>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Supplier Name</label>
              <input
                type="text"
                className="w-full p-2 border rounded mt-1"
                {...register("name", { required: "Supplier name is required" })}
              />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Contact Person (Optional)</label>
              <input type="text" className="w-full p-2 border rounded mt-1" {...register("contact_person")} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Phone (Optional)</label>
              <input type="text" className="w-full p-2 border rounded mt-1" {...register("phone")} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">GSTIN (Optional)</label>
              <input type="text" className="w-full p-2 border rounded mt-1" {...register("gstin")} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Address (Optional)</label>
              <textarea className="w-full p-2 border rounded mt-1" {...register("address")} />
            </div>
            <button type="submit" disabled={isAdding} className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600 disabled:bg-gray-400">
              {isAdding ? 'Saving...' : 'Save Supplier'}
            </button>
            {serverMessage && <p className={`mt-2 text-sm ${serverMessage.includes('error') ? 'text-red-500' : 'text-green-500'}`}>{serverMessage}</p>}
          </form>
        </div>

        {/* Supplier List */}
        <div className="md:col-span-2 bg-white p-6 rounded-lg shadow-sm border">
          <h2 className="text-2xl font-bold mb-4">Existing Suppliers</h2>
          <StatusWrapper loading={isLoading} error={isError ? (error?.data?.message || 'Failed to fetch') : null}>
            <div className="overflow-x-auto">
              <table className="w-full table-auto">
                <thead>
                  <tr className="bg-gray-200">
                    <th className="px-4 py-2 text-left">Name</th>
                    <th className="px-4 py-2 text-left">Contact</th>
                    <th className="px-4 py-2 text-left">Phone</th>
                    <th className="px-4 py-2 text-left">GSTIN</th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers.map((supplier, index) => (
                    <tr key={index} className="border-b">
                      <td className="px-4 py-2 capitalize">{supplier.name}</td>
                      <td className="px-4 py-2">{supplier.contact_person || 'N/A'}</td>
                      <td className="px-4 py-2">{supplier.phone || 'N/A'}</td>
                      <td className="px-4 py-2">{supplier.gstin || 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!isLoading && suppliers.length === 0 && <p className="text-center text-gray-500 mt-4">No suppliers found.</p>}
            </div>
          </StatusWrapper>
        </div>
      </div>
    </div>
  );
}

export default SupplierManager;