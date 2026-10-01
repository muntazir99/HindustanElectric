import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchPurchaseOrderById, closePurchaseOrder, fetchPurchaseOrders } from '../../store/purchaseOrderSlice.js';
import StatusWrapper from '../Common/StatusWrapper.js';

function PurchaseOrderDetail() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { orderId } = useParams();

  // We select the specific order from the Redux state
  const { selectedOrder: po, loading, error } = useSelector((state) => state.purchaseOrders);

  useEffect(() => {
    // Fetch the specific PO's details when the component mounts
    dispatch(fetchPurchaseOrderById(orderId));
  }, [dispatch, orderId]);

  const handleCloseOrder = async () => {
    if (window.confirm("Are you sure? This will close the order and no more items can be received against it.")) {
      const resultAction = await dispatch(closePurchaseOrder(orderId));
      if (closePurchaseOrder.fulfilled.match(resultAction)) {
        // After closing, go back to the list to see the updated status
        navigate('/purchase-orders');
      }
    }
  };

  const getPreviouslyReceivedQty = (itemId) => {
    if (!po || !po.received_items) return 0;
    return po.received_items
      .filter(item => item.item_id === itemId)
      .reduce((sum, item) => sum + (item.quantity_received || 0), 0);
  };
  
  return (
    <StatusWrapper loading={loading} error={error}>
      <div className="p-6 bg-gray-100 min-h-screen">
        <div className="max-w-4xl mx-auto bg-white p-6 rounded-lg shadow-sm border">
          {po ? (
            <div>
              <div className="flex justify-between items-start mb-4 pb-4 border-b">
                <div>
                  <h1 className="text-2xl font-bold">Purchase Order Details</h1>
                  <p className="text-gray-600">Supplier: <span className="font-semibold capitalize">{po.supplier_name}</span></p>
                  <p className="text-gray-500 text-sm">PO Date: {new Date(po.po_date).toLocaleDateString()}</p>
                </div>
                <div className="text-right">
                    <p className="font-bold text-lg">{po.status}</p>
                    {/* --- START OF FIX --- */}
                    {/* Show close button only if the order is still open */}
                    {(po.status === "Ordered" || po.status === "Partially Received") && (
                         <button onClick={handleCloseOrder} className="text-sm bg-red-500 text-white px-3 py-1 rounded mt-2 hover:bg-red-600">
                            Manually Close Order
                         </button>
                    )}
                    {/* --- END OF FIX --- */}
                </div>
              </div>

              <h2 className="text-lg font-semibold mt-6 mb-2">Order Summary</h2>
              <table className="w-full table-auto">
                <thead>
                  <tr className="bg-gray-200">
                    <th className="px-4 py-2 text-left">Item Name</th>
                    <th className="px-4 py-2 text-center">Ordered</th>
                    <th className="px-4 py-2 text-center">Received</th>
                    <th className="px-4 py-2 text-center">Remaining</th>
                  </tr>
                </thead>
                <tbody>
                  {po.items.map((item) => {
                    const received = getPreviouslyReceivedQty(item.item_id);
                    const remaining = item.quantity - received;
                    return (
                      <tr key={item.item_id} className="border-b">
                        <td className="px-4 py-2">{item.name}</td>
                        <td className="px-4 py-2 text-center">{item.quantity}</td>
                        <td className="px-4 py-2 text-center">{received}</td>
                        <td className={`px-4 py-2 text-center font-bold ${remaining > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                          {remaining}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {po.notes && <div className="mt-4 p-2 bg-gray-50 rounded"><strong>Notes:</strong> {po.notes}</div>}
            </div>
          ) : (
            <p>Loading details...</p>
          )}
        </div>
      </div>
    </StatusWrapper>
  );
}

export default PurchaseOrderDetail;