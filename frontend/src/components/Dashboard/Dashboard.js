// src/components/Dashboard/Dashboard.js
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import api from "../../api.js";

// Chart.js and react-chartjs-2 imports
// Bar is no longer used directly here
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import StatusWrapper from "../Common/StatusWrapper.js"; // Import the wrapper component
import { ACTIONS, CHART_VIEWS } from "../../utils/constants.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

import DashboardStats from "./DashboardStats.js";
import SalesChart from "./SalesChart.js";
import InventorySummary from "./InventorySummary.js";
import SalesSummary from "./SalesSummary.js";
import CategoryGrid from "./CategoryGrid.js";

function Dashboard() {
  const [inventory, setInventory] = useState([]);
  const [logs, setLogs] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(""); // Add state for error messages
  const [expandedCategories, setExpandedCategories] = useState({});
  const [saleChartView, setSaleChartView] = useState(CHART_VIEWS.DAILY);

  const navigate = useNavigate();

  // Decode user from token
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }
    try {
      const decoded = jwtDecode(token);
      setUser(decoded);
    } catch (error) {
      localStorage.removeItem("token");
      navigate("/login");
    }
  }, [navigate]);

  // Fetch inventory and logs
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(""); // Reset error on new fetch
      const [invRes, logsRes] = await Promise.all([
        api.get("/inventory/?limit=1000"),
        api.get("/logs/"),
      ]);
      setInventory(invRes.data.data || []);
      setLogs(Array.isArray(logsRes.data.data) ? logsRes.data.data : []);
    } catch (error) {
      console.error("Error fetching data:", error);
      setError("Failed to load dashboard data."); // Set a user-friendly error
      if (error.response?.status === 401) {
        localStorage.clear();
        navigate("/login");
      }
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, fetchData]);

  // Delete an item from inventory
  const handleDelete = async (name, company) => {
    if (
      !window.confirm(`Are you sure you want to delete "${name}" from ${company}?`)
    )
      return;
    try {
      await api.delete("/inventory/delete", { data: { name, company } });
      // Refetch data to get the latest state
      fetchData();
    } catch (error) {
      console.error("Error deleting item:", error);
      setError("Failed to delete the item.");
    }
  };

  // Extract unique categories (non-empty)
  const categories = useMemo(() => Array.from(
    new Set(inventory.map((item) => item.category).filter(Boolean))
  ), [inventory]);

  // Toggle expansion for a category (allows independent expansion)
  const toggleExpand = (cat) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [cat]: !prev[cat],
    }));
  };

  // --- Sales & Purchase Calculations ---
  const { totalCost, totalRevenue } = useMemo(() => {
    let cost = 0;
    let revenue = 0;
    logs.forEach((log) => {
      if (log.action === ACTIONS.ADD_INVENTORY) {
        const qty = Number(log.quantity_added) || 0;
        const price = Number(log.unit_price) || 0;
        cost += qty * price;
      } else if (log.action === ACTIONS.SELL) {
        const qty = Number(log.quantity_sold) || Number(log.quantity) || 0;
        const price = Number(log.price) || 0;
        revenue += qty * price;
      }
    });
    return { totalCost: cost, totalRevenue: revenue };
  }, [logs]);

  // --- Profit Calculation ---
  const { sellLogs, totalProfit } = useMemo(() => {
    const sells = logs.filter(
      (log) => typeof log.action === "string" && log.action.toLowerCase() === ACTIONS.SELL
    );
    const profit = sells.reduce((sum, log) => {
      const matchingItem = inventory.find(
        (item) =>
          item.name.toLowerCase() === log.item_name.toLowerCase() &&
          item.company.toLowerCase() === log.company.toLowerCase()
      );
      const costPrice = matchingItem ? Number(matchingItem.unit_price) : 0;
      const qty = Number(log.quantity_sold) || Number(log.quantity) || 0;
      const sellPrice = Number(log.price) || 0;
      return sum + (sellPrice - costPrice) * qty;
    }, 0);
    return { sellLogs: sells, totalProfit: profit };
  }, [logs, inventory]);

  // Chart for Money Spent vs Money Earned
  const chartDataSpentEarned = useMemo(() => ({
    labels: ["Money Spent", "Money Earned"],
    datasets: [
      {
        label: "Amount (₹)",
        data: [totalCost, totalRevenue],
        backgroundColor: ["#f87171", "#34d399"],
      },
    ],
  }), [totalCost, totalRevenue]);

  // Chart for Total Sales vs Profit Earned
  const salesProfitChartData = useMemo(() => ({
    labels: ["Total Sales", "Profit Earned"],
    datasets: [
      {
        label: "Amount (₹)",
        data: [totalRevenue, totalProfit],
        backgroundColor: ["#34d399", "#facc15"],
      },
    ],
  }), [totalRevenue, totalProfit]);

  // --- Aggregated Sales & Profit Data for Trends ---
  const groupLogsBy = (logsArray, view) => {
    const groups = {};
    logsArray.forEach((log) => {
      if (typeof log.action !== "string" || log.action.toLowerCase() !== ACTIONS.SELL || !log.timestamp) return;
      const logDate = new Date(log.timestamp);
      if (isNaN(logDate.getTime())) return;

      let key;
      if (view === CHART_VIEWS.DAILY) {
        key = logDate.toISOString().slice(0, 10);
      } else if (view === CHART_VIEWS.WEEKLY) {
        const firstDay = new Date(logDate.getFullYear(), 0, 1);
        const pastDays = Math.floor((logDate - firstDay) / (24 * 60 * 60 * 1000));
        const weekNumber = Math.ceil((pastDays + firstDay.getDay() + 1) / 7);
        key = `${logDate.getFullYear()}-W${weekNumber}`;
      } else if (view === CHART_VIEWS.MONTHLY) {
        key = logDate.toISOString().slice(0, 7);
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(log);
    });
    return groups;
  };

  const aggregatedChartData = useMemo(() => {
    const groups = groupLogsBy(logs, saleChartView);
    const sortedKeys = Object.keys(groups).sort();
    const labels = sortedKeys;
    const salesData = sortedKeys.map((key) =>
      groups[key].reduce((sum, log) => sum + (Number(log.quantity_sold) || 0) * (Number(log.price) || 0), 0)
    );
    const profitData = sortedKeys.map((key) =>
      groups[key].reduce((sum, log) => {
        const matchingItem = inventory.find(item => item.name.toLowerCase() === log.item_name.toLowerCase() && item.company.toLowerCase() === log.company.toLowerCase());
        const costPrice = matchingItem ? Number(matchingItem.unit_price) : 0;
        return sum + ((Number(log.price) || 0) - costPrice) * (Number(log.quantity_sold) || 0);
      }, 0)
    );
    return {
      labels,
      datasets: [
        { label: "Sales", data: salesData, backgroundColor: "#34d399" },
        { label: "Profit", data: profitData, backgroundColor: "#facc15" },
      ],
    };
  }, [logs, saleChartView, inventory]);

  return (
    <StatusWrapper loading={loading} error={error}>
      <div className="min-h-screen bg-gray-100 p-6">
        {/* Quick Actions Section */}
        <div className="max-w-6xl mx-auto mb-8">
          <h2 className="text-xl font-bold text-gray-800 mb-4 px-2 border-l-4 border-blue-500">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <button
              onClick={() => navigate('/logs/allot')}
              className="flex items-center justify-center gap-4 bg-green-600 hover:bg-green-700 text-white p-6 rounded-xl shadow-lg transition-transform transform hover:scale-105"
            >
              <span className="text-4xl">🛒</span>
              <div className="text-left">
                <span className="block text-2xl font-bold">Sell Item</span>
                <span className="text-green-100 text-sm">Record a new sale</span>
              </div>
            </button>

            <button
              onClick={() => navigate('/inventory/add')}
              className="flex items-center justify-center gap-4 bg-blue-600 hover:bg-blue-700 text-white p-6 rounded-xl shadow-lg transition-transform transform hover:scale-105"
            >
              <span className="text-4xl">📦</span>
              <div className="text-left">
                <span className="block text-2xl font-bold">Add Stock</span>
                <span className="text-blue-100 text-sm">Add new items to inventory</span>
              </div>
            </button>

            {user?.role === 'admin' && (
              <button
                onClick={() => navigate('/purchase-orders/new')}
                className="flex items-center justify-center gap-4 bg-purple-600 hover:bg-purple-700 text-white p-6 rounded-xl shadow-lg transition-transform transform hover:scale-105"
              >
                <span className="text-4xl">📄</span>
                <div className="text-left">
                  <span className="block text-2xl font-bold">New PO</span>
                  <span className="text-purple-100 text-sm">Create Purchase Order</span>
                </div>
              </button>
            )}
          </div>
        </div>

        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <DashboardStats totalRevenue={totalRevenue} inventoryCount={inventory.length} />
          <SalesChart
            saleChartView={saleChartView}
            setSaleChartView={setSaleChartView}
            aggregatedChartData={aggregatedChartData}
          />
        </div>

        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
          <InventorySummary inventory={inventory} handleDelete={handleDelete} />
          <SalesSummary
            chartDataSpentEarned={chartDataSpentEarned}
            salesProfitChartData={salesProfitChartData}
            totalProfit={totalProfit}
          />
        </div>

        <CategoryGrid
          categories={categories}
          expandedCategories={expandedCategories}
          toggleExpand={toggleExpand}
          inventory={inventory}
        />
      </div>
    </StatusWrapper>
  );
}

export default Dashboard;
