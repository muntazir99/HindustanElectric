import React from "react";

const InventorySummary = ({ inventory, handleDelete }) => {
    return (
        <section className="p-6 rounded-xl bg-white border border-gray-300">
            <h2 className="text-xl text-gray-800 mb-4">Inventory Summary</h2>
            <div className="max-h-[600px] overflow-y-auto">
                <ul className="space-y-2">
                    {inventory.map((item, index) => (
                        <li
                            key={index}
                            className="flex justify-between items-center p-3 rounded-md bg-gray-50 border border-gray-200"
                        >
                            <div>
                                <p className="font-semibold text-gray-800">
                                    {item.name}{" "}
                                    <span className="text-sm text-gray-600">
                                        ({item.company})
                                    </span>
                                </p>
                                <p className="text-sm text-gray-600">Qty: {item.quantity}</p>
                            </div>
                            <div className="flex items-center space-x-2">
                                <p className="text-lg font-bold text-gray-800">
                                    ₹{(item.quantity * item.unit_price || 0).toFixed(2)}
                                </p>
                                <button
                                    onClick={() => handleDelete(item.name, item.company)}
                                    className="text-red-500 hover:text-red-700 text-sm"
                                >
                                    Delete
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        </section>
    );
};

export default InventorySummary;
