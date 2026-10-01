import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { fetchPurchaseOrders } from '../../store/purchaseOrderSlice.js';
import { fetchSuppliers } from '../../store/suppliersSlice.js';
import api from '../../api.js';
import StatusWrapper from '../Common/StatusWrapper.js';

function ReceiveGoods() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { orderId } = useParams();

  const { items: purchaseOrders, loading, error } = useSelector((state) => state.purchaseOrders);
  const [submissionError, setSubmissionError] = useState('');

  const purchaseOrder = purchaseOrders.find(po => po._id === orderId);

  const getPreviouslyReceivedQty = (itemId) => {
    if (!purchaseOrder || !purchaseOrder.received_items) return 0;
    return purchaseOrder.received_items
      .filter(item => item.item_id === itemId)
      .reduce((sum, item) => sum + (item.quantity_received || 0), 0);
  };

  const { register, control, handleSubmit, formState: { errors } } = useForm({
    values: {
      items: purchaseOrder?.items.map(item => {
        const previouslyReceived = getPreviouslyReceivedQty(item.item_id);
        const remaining = item.quantity - previouslyReceived;
        return {
          ...item,
          previously_received: previouslyReceived,
          remaining: remaining,
          quantity_received: remaining, // Default to receiving the full remaining amount
        };
      }) || []
    }
  });

  const { fields } = useFieldArray({ control, name: "items" });

  useEffect(() => {
    if (purchaseOrders.length === 0) {
      dispatch(fetchPurchaseOrders());
    }
  }, [dispatch, purchaseOrders.length]);

  const onSubmit = async (data) => {
    setSubmissionError('');
    try {
      const payload = {
        items: data.items.map(item => ({
          item_id: item.item_id,
          name: item.name,
          quantity: parseInt(item.quantity_received, 10) || 0,
          cost_price: parseFloat(item.cost_price)
        }))
      };
      await api.post(`/purchases/orders/${orderId}/receive`, payload);
      navigate('/purchase-orders');
    } catch (err) {
      setSubmissionError(err.response?.data?.message || 'Failed to process receipt.');
    }
  };

  return (
    <StatusWrapper loading={loading && !purchaseOrder} error={error || submissionError}>
      <div className="p-6 bg-gray-100 min-h-screen">
        <div className="max-w-4xl mx-auto bg-white p-6 rounded-lg shadow-sm border">
          {purchaseOrder ? (
            <>
              <h1 className="text-2xl font-bold mb-2">Receive Goods for PO</h1>
              <p className="text-gray-600 mb-6">Supplier: <span className="font-semibold capitalize">{purchaseOrder.supplier_name}</span></p>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <table className="w-full table-auto">
                  <thead>
                    <tr className="bg-gray-200">
                      <th className="px-4 py-2 text-left">Item Name</th>
                      <th className="px-4 py-2 text-center">Ordered</th>
                      <th className="px-4 py-2 text-center">Prev. Received</th>
                      <th className="px-4 py-2 text-center font-bold">Remaining</th>
                      <th className="px-4 py-2 text-center">Receiving Now</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fields.map((field, index) => (
                      <tr key={field.id} className="border-b">
                        <td className="px-4 py-2">{field.name}</td>
                        <td className="px-4 py-2 text-center">{field.quantity}</td>
                        <td className="px-4 py-2 text-center">{field.previously_received}</td>
                        <td className="px-4 py-2 text-center font-bold">{field.remaining}</td>
                        <td className="px-4 py-2 text-center">
                          <input
                            type="number"
                            className="w-24 p-1 border rounded text-center"
                            {...register(`items.${index}.quantity_received`, {
                              required: true, valueAsNumber: true, min: 0
                            })}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-md text-sm">
                  <strong>To create a variance</strong>, simply enter a "Receiving Now" quantity that is different from the "Remaining" quantity for any item. The PO will be marked as "Completed with Variance" upon submission.
                </div>
                <div className="flex justify-end pt-4">
                  <button type="submit" disabled={loading} className="bg-green-500 text-white px-6 py-2 rounded hover:bg-green-600">
                    Confirm Receipt & Update Stock
                  </button>
                </div>
              </form>
            </>
          ) : (
            <p>Loading Purchase Order details...</p>
          )}
        </div>
      </div>
    </StatusWrapper>
  );
}

export default ReceiveGoods;