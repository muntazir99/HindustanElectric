import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchPurchaseOrders } from '../../store/purchaseOrderSlice.js';
import StatusWrapper from '../Common/StatusWrapper.js';
import { Link } from 'react-router-dom';

function PurchaseOrderList() {
  const dispatch = useDispatch();
  const { items: purchaseOrders, loading, error } = useSelector((state) => state.purchaseOrders);

  useEffect(() => {
    dispatch(fetchPurchaseOrders());
  }, [dispatch]);

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  const getStatusChip = (status) => {
    switch (status) {
      case 'Completed':
        return 'bg-green-100 text-green-800';
      case 'Partially Received':
        return 'bg-blue-100 text-blue-800';
      case 'Completed with Variance':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  return (
    <StatusWrapper loading={loading} error={error}>
      <div className="p-6 bg-gray-100 min-h-screen">
        <div className="max-w-6xl mx-auto bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold">Purchase Orders</h1>
            <Link to="/purchase-orders/new" className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
              Create New PO
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full table-auto">
              <thead>
                <tr className="bg-gray-200">
                  <th className="px-4 py-2 text-left">PO Date</th>
                  <th className="px-4 py-2 text-left">Supplier</th>
                  <th className="px-4 py-2 text-left">Total Cost (₹)</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(purchaseOrders || []).map((po) => (
                  <tr key={po._id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-2">{formatDate(po.po_date)}</td>
                    <td className="px-4 py-2 capitalize">{po.supplier_name}</td>
                    <td className="px-4 py-2">{Number(po.total_cost).toFixed(2)}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusChip(po.status)}`}>
                        {po.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-center space-x-2">
                      {/* --- START OF FIX --- */}
                      <Link to={`/purchase-orders/${po._id}`}>
                        <button className="text-sm bg-gray-500 text-white px-3 py-1 rounded">View</button>
                      </Link>
                      <Link to={`/purchase-orders/${po._id}/receive`}>
                        <button 
                          disabled={po.status === 'Completed' || po.status === 'Completed with Variance'}
                          className="text-sm bg-green-500 text-white px-3 py-1 rounded disabled:bg-gray-400"
                        >
                          Receive
                        </button>
                      </Link>
                      {/* --- END OF FIX --- */}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(!purchaseOrders || purchaseOrders.length === 0) && (
              <p className="text-center text-gray-500 mt-4">No purchase orders found.</p>
            )}
          </div>
        </div>
      </div>
    </StatusWrapper>
  );
}

export default PurchaseOrderList;