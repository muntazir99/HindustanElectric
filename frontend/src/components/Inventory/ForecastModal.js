
import React, { useEffect, useState } from "react";
import { Line } from "react-chartjs-2";
import api from "../../api.js";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
} from "chart.js";

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
);

const ForecastModal = ({ item, onClose }) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [chartData, setChartData] = useState(null);
    const [summary, setSummary] = useState(null);

    useEffect(() => {
        const fetchForecast = async () => {
            try {
                setLoading(true);
                setError("");

                const payload = {
                    item_name: item.name,
                    company: item.company
                }

                const res = await api.post("/ai/forecast", payload);

                if (res.data.success) {
                    const data = res.data.data;
                    setSummary(res.data.summary);

                    // Prepare Chart Data
                    const labels = data.map(d => d.date);
                    const actuals = data.map(d => d.actual); // Contains values or null for future
                    const predictions = data.map(d => d.is_future ? d.prediction : null); // Only future part
                    // We might want a continuous line for prediction that starts where history ends?
                    // For simplicity, let's just plot two lines.

                    // Better visualization:
                    // "History" line: all points that have 'actual'
                    // "Forecast" line: starts from the last historical point and goes forward

                    setChartData({
                        labels: labels,
                        datasets: [
                            {
                                label: 'Historical Sales',
                                data: actuals,
                                borderColor: '#3b82f6', // blue
                                backgroundColor: 'rgba(59, 130, 246, 0.5)',
                                tension: 0.3,
                                pointRadius: 3
                            },
                            {
                                label: 'AI Prediction',
                                data: data.map(d => d.prediction), // Plot prediction for whole range or just future?
                                // If we plot for whole range, we can see how well it fits history too (Prophet does this).
                                // Let's use 'prediction' field for the whole line but maybe dash it?
                                borderColor: '#f59e0b', // amber
                                backgroundColor: 'rgba(245, 158, 11, 0.5)',
                                borderDash: [5, 5],
                                tension: 0.3,
                                pointRadius: 0
                            }
                        ]
                    });

                } else {
                    setError(res.data.message || "Could not generate forecast.");
                }

            } catch (err) {
                console.error(err);
                setError(err.response?.data?.message || err.message || "Failed to fetch forecast.");
            } finally {
                setLoading(false);
            }
        };

        if (item) {
            fetchForecast();
        }
    }, [item]);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">Demand Forecast: {item.name}</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-xl">&times;</button>
                </div>

                {loading && (
                    <div className="flex flex-col items-center justify-center h-64">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                        <p className="mt-4 text-gray-600">consulting the oracle...</p>
                    </div>
                )}

                {error && (
                    <div className="bg-red-50 text-red-600 p-4 rounded mb-4">
                        {error}
                        <p className="text-sm mt-2 text-gray-500">Note: AI needs at least 5-10 past sales transactions to work.</p>
                    </div>
                )}

                {!loading && !error && chartData && (
                    <div>
                        <div className="mb-4 grid grid-cols-2 gap-4">
                            <div className="bg-blue-50 p-3 rounded">
                                <p className="text-sm text-gray-600">Total Predicted Demand (Next 30 Days)</p>
                                <p className="text-2xl font-bold text-blue-700">{summary?.total_predicted_demand_next_30_days} units</p>
                            </div>
                            <div className="bg-yellow-50 p-3 rounded">
                                <p className="text-sm text-gray-600">Trend</p>
                                <p className="text-2xl font-bold capitalize text-yellow-700">{summary?.trend}</p>
                            </div>
                        </div>
                        <div className="h-64">
                            <Line
                                data={chartData}
                                options={{
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    interaction: {
                                        mode: 'index',
                                        intersect: false,
                                    },
                                    plugins: {
                                        legend: {
                                            position: 'top',
                                        },
                                    }
                                }}
                            />
                        </div>
                        <p className="text-xs text-gray-500 mt-4 text-center">
                            * Predictions are based on historical sales patterns. Use as a guide, not a guarantee.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ForecastModal;
