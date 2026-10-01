import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, Package, PlusCircle, BarChart } from 'lucide-react';

const MainDashboard = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-blue-50 flex flex-col items-center justify-center space-y-8 p-4">
      <h2 className="text-3xl font-bold mb-8">Hindustan Electric</h2>
      <div className="space-y-4 w-full max-w-md">
        <button
          onClick={() => navigate('/logs/allot')}
          className="w-full bg-green-600 hover:bg-green-700 text-white text-xl py-4 rounded-lg flex items-center justify-center space-x-3 shadow"
        >
          <ShoppingCart size={24} />
          <span>Make a Sale</span>
        </button>
        <button
          onClick={() => navigate('inventory/add')}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xl py-4 rounded-lg flex items-center justify-center space-x-3 shadow"
        >
          <PlusCircle size={24} />
          <span>Add New Item</span>
        </button>
        <button
          onClick={() => navigate('/inventory')}
          className="w-full bg-purple-600 hover:bg-purple-700 text-white text-xl py-4 rounded-lg flex items-center justify-center space-x-3 shadow"
        >
          <Package size={24} />
          <span>View Inventory</span>
        </button>
        <button
          onClick={() => navigate('/invoices')}
          className="w-full bg-orange-600 hover:bg-orange-700 text-white text-xl py-4 rounded-lg flex items-center justify-center space-x-3 shadow"
        >
          <BarChart size={24} />
          <span>Invoices</span>
        </button>
      </div>
      <div className="mt-10">
        <button
          onClick={() => navigate('/dashboard')}
          className="text-blue-700 underline text-lg flex items-center space-x-1 hover:text-blue-900"
        >
          <BarChart size={18} />
          <span>View Business Insights</span>
        </button>
      </div>
    </div>
  );
};

export default MainDashboard;
