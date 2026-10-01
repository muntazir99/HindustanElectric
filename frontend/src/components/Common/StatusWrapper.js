import React from 'react';

const StatusWrapper = ({ loading, error, children }) => {
  if (loading) {
    return (
      <div className="flex justify-center items-center p-6">
        <p className="text-xl text-gray-700">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center p-6 bg-red-100 rounded-md">
        <p className="text-xl text-red-600">Error: {error}</p>
      </div>
    );
  }

  return children;
};

export default StatusWrapper;