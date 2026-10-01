import React from "react";
import { Bar } from "react-chartjs-2";
import { CHART_VIEWS } from "../../utils/constants.js";

const SalesChart = ({
    saleChartView,
    setSaleChartView,
    aggregatedChartData,
}) => {
    return (
        <div className="col-span-2 bg-white border border-gray-300 rounded-md p-4 shadow-sm">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl text-gray-800">
                    Sales & Profit Trends (
                    {saleChartView.charAt(0).toUpperCase() + saleChartView.slice(1)})
                </h2>
                <div className="flex space-x-2">
                    <button
                        onClick={() => setSaleChartView(CHART_VIEWS.DAILY)}
                        className={`px-3 py-1 border rounded-md ${saleChartView === CHART_VIEWS.DAILY
                                ? "bg-gray-200"
                                : "bg-white hover:bg-gray-100"
                            }`}
                    >
                        Daily
                    </button>
                    <button
                        onClick={() => setSaleChartView(CHART_VIEWS.WEEKLY)}
                        className={`px-3 py-1 border rounded-md ${saleChartView === CHART_VIEWS.WEEKLY
                                ? "bg-gray-200"
                                : "bg-white hover:bg-gray-100"
                            }`}
                    >
                        Weekly
                    </button>
                    <button
                        onClick={() => setSaleChartView(CHART_VIEWS.MONTHLY)}
                        className={`px-3 py-1 border rounded-md ${saleChartView === CHART_VIEWS.MONTHLY
                                ? "bg-gray-200"
                                : "bg-white hover:bg-gray-100"
                            }`}
                    >
                        Monthly
                    </button>
                </div>
            </div>
            <Bar
                data={aggregatedChartData}
                options={{
                    plugins: { legend: { display: true } },
                    scales: { y: { beginAtZero: true } },
                }}
            />
        </div>
    );
};

export default SalesChart;
