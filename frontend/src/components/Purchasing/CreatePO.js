import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useForm, useFieldArray } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { fetchSuppliers } from '../../store/suppliersSlice.js';
import { fetchInventory } from '../../store/inventorySlice.js';
import { createPurchaseOrder } from '../../store/purchaseOrderSlice.js';
import StatusWrapper from '../Common/StatusWrapper.js';

function CreatePO() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const { items: suppliers, loading: suppliersLoading } = useSelector((state) => state.suppliers);
  const { items: inventory, loading: inventoryLoading } = useSelector((state) => state.inventory);
  const { loading: poLoading, error: poError } = useSelector((state) => state.purchaseOrders);

  const { register, control, handleSubmit, watch, formState: { errors } } = useForm({
    defaultValues: {
      items: [{ item_id: '', quantity: 1, cost_price: '' }]
    }
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  const [serverMessage, setServerMessage] = useState("");

  useEffect(() => {
    dispatch(fetchSuppliers());
    dispatch(fetchInventory());
  }, [dispatch]);

  const selectedSupplierId = watch('supplier_id');
  const supplierName = suppliers.find(s => s._id === selectedSupplierId)?.name || '';

  const onSubmit = async (data) => {
    setServerMessage("");
    const poData = {
      ...data,
      supplier_name: supplierName,
      po_date: new Date().toISOString().split('T')[0], // Use today's date
      items: data.items.map(item => ({
          ...item,
          name: inventory.find(i => i._id === item.item_id)?.name || 'Unknown',
          quantity: parseInt(item.quantity, 10),
          cost_price: parseFloat(item.cost_price)
      }))
    };
    
    const resultAction = await dispatch(createPurchaseOrder(poData));
    if (createPurchaseOrder.fulfilled.match(resultAction)) {
      navigate('/purchase-orders'); // Navigate to a PO list page (we'll create this next)
    } else {
        setServerMessage(resultAction.payload || "An error occurred creating the PO.");
    }
  };

  return (
    <StatusWrapper loading={suppliersLoading || inventoryLoading} error={poError || serverMessage}>
      <div className="p-6 bg-gray-100 min-h-screen">
        <div className="max-w-4xl mx-auto bg-white p-6 rounded-lg shadow-sm border">
          <h1 className="text-2xl font-bold mb-6">Create Purchase Order</h1>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Supplier and Date Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">Supplier</label>
                <select
                  {...register("supplier_id", { required: "Please select a supplier" })}
                  className="w-full p-2 border rounded mt-1"
                >
                  <option value="">Select a supplier...</option>
                  {suppliers.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
                </select>
                {errors.supplier_id && <p className="text-red-500 text-xs mt-1">{errors.supplier_id.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Notes (Optional)</label>
                <input type="text" {...register("notes")} className="w-full p-2 border rounded mt-1" />
              </div>
            </div>

            {/* Items Section */}
            <h2 className="text-lg font-semibold border-t pt-4">Items to Order</h2>
            {fields.map((field, index) => (
              <div key={field.id} className="grid grid-cols-12 gap-4 items-center">
                <div className="col-span-5">
                  <select {...register(`items.${index}.item_id`, { required: true })} className="w-full p-2 border rounded">
                    <option value="">Select an item...</option>
                    {inventory.map(i => <option key={i._id} value={i._id}>{i.name} ({i.company})</option>)}
                  </select>
                </div>
                <div className="col-span-3">
                  <input type="number" placeholder="Quantity" {...register(`items.${index}.quantity`, { required: true, min: 1 })} className="w-full p-2 border rounded" />
                </div>
                <div className="col-span-3">
                  <input type="number" step="0.01" placeholder="Cost Price (₹)" {...register(`items.${index}.cost_price`, { required: true, min: 0 })} className="w-full p-2 border rounded" />
                </div>
                <div className="col-span-1">
                  {fields.length > 1 && <button type="button" onClick={() => remove(index)} className="text-red-500">✖</button>}
                </div>
              </div>
            ))}
            <button type="button" onClick={() => append({ item_id: '', quantity: 1, cost_price: '' })} className="text-blue-500 text-sm">+ Add Item</button>

            {/* Submission */}
            <div className="border-t pt-4">
              <button type="submit" disabled={poLoading} className="w-full bg-green-500 text-white p-3 rounded hover:bg-green-600 disabled:bg-gray-400">
                {poLoading ? 'Creating PO...' : 'Create Purchase Order'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </StatusWrapper>
  );
}

export default CreatePO;