import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchAgingReport } from '../../store/reportsSlice.js';
import StatusWrapper from '../Common/StatusWrapper.js';

function AgingReport() {
  const dispatch = useDispatch();
  const { agingReport, loading, error } = useSelector((state) => state.reports);

  useEffect(() => {
    dispatch(fetchAgingReport());
  }, [dispatch]);

  const customers = Object.keys(agingReport).sort();

  return (
    <StatusWrapper loading={loading} error={error}>
      <div className="p-6 bg-gray-100 min-h-screen">
        <div className="max-w-6xl mx-auto bg-white p-6 rounded-lg shadow-sm border">
          <h1 className="text-2xl font-bold mb-6">Accounts Receivable Aging Report</h1>
          <div className="overflow-x-auto">
            <table className="w-full table-auto">
              <thead>
                <tr className="bg-gray-200">
                  <th className="px-4 py-2 text-left">Customer</th>
                  <th className="px-4 py-2 text-right">0-30 Days</th>
                  <th className="px-4 py-2 text-right">31-60 Days</th>
                  <th className="px-4 py-2 text-right">61-90 Days</th>
                  <th className="px-4 py-2 text-right">90+ Days</th>
                  <th className="px-4 py-2 text-right font-bold">Total Due</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customerName) => {
                  const data = agingReport[customerName];
                  return (
                    <tr key={customerName} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-2 capitalize">{customerName}</td>
                      <td className="px-4 py-2 text-right">₹{data['0-30'].toFixed(2)}</td>
                      <td className="px-4 py-2 text-right">₹{data['31-60'].toFixed(2)}</td>
                      <td className="px-4 py-2 text-right">₹{data['61-90'].toFixed(2)}</td>
                      <td className="px-4 py-2 text-right">₹{data['90+'].toFixed(2)}</td>
                      <td className="px-4 py-2 text-right font-bold">₹{data.total.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {customers.length === 0 && (
              <p className="text-center text-gray-500 mt-4">No outstanding balances found.</p>
            )}
          </div>
        </div>
      </div>
    </StatusWrapper>
  );
}

export default AgingReport;