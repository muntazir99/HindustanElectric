import React from "react";
import { Bar } from "react-chartjs-2";

const SalesSummary = ({
    chartDataSpentEarned,
    salesProfitChartData,
    totalProfit,
}) => {
    return (
        <section className="p-6 rounded-xl bg-white border border-gray-300 space-y-6">
            <h2 className="text-xl text-gray-800 mb-4">Sales Summary</h2>
            <div>
                <Bar
                    data={chartDataSpentEarned}
                    options={{
                        plugins: {
                            title: { display: true, text: "Money Spent vs Earned" },
                        },
                    }}
                />
            </div>
            <div>
                <Bar
                    data={salesProfitChartData}
                    options={{
                        plugins: {
                            title: { display: true, text: "Total Sales vs Profit Earned" },
                        },
                    }}
                />
            </div>
            <div className="mt-4 text-center text-lg font-semibold text-gray-800">
                Net Profit: ₹{totalProfit > 0 ? totalProfit.toFixed(2) : "0.00"}
            </div>
        </section>
    );
};

export default SalesSummary;
