import React from "react";

const CategoryGrid = ({
    categories,
    expandedCategories,
    toggleExpand,
    inventory,
}) => {
    return (
        <div className="max-w-6xl mx-auto mt-8">
            <h2 className="text-xl text-gray-800 mb-4">Categories</h2>
            {categories.length === 0 ? (
                <p className="text-gray-600">No categories available</p>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {categories.map((cat, index) => (
                        <div
                            key={index}
                            className="p-4 rounded-md bg-white border border-gray-300"
                        >
                            <button
                                className="w-full text-left font-semibold text-gray-800 focus:outline-none"
                                onClick={() => toggleExpand(cat)}
                            >
                                {cat}
                            </button>
                            {expandedCategories[cat] && (
                                <ul className="mt-2 space-y-1 text-sm text-gray-700">
                                    {inventory
                                        .filter((item) => item.category === cat)
                                        .map((item, idx) => (
                                            <li key={idx} className="border-b border-gray-200 py-1">
                                                {item.name} ({item.company}) - Qty: {item.quantity}
                                            </li>
                                        ))}
                                </ul>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default CategoryGrid;
