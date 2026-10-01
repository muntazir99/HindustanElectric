import React from "react";

const DashboardStats = ({ totalRevenue, inventoryCount }) => {
    return (
        <div className="col-span-1 flex flex-col space-y-4">
            <div className="p-4 bg-white border border-gray-300 rounded-md shadow-sm">
                <p className="text-gray-500">Total Sale</p>
                <p className="text-2xl font-bold text-gray-800">
                    ₹{totalRevenue.toFixed(2)}
                </p>
            </div>
            <div className="p-4 bg-white border border-gray-300 rounded-md shadow-sm">
                <p className="text-gray-500">Total Products</p>
                <p className="text-2xl font-bold text-gray-800">{inventoryCount}</p>
            </div>
        </div>
    );
};

export default DashboardStats;
