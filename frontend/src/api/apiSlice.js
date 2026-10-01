import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

// Define the base API slice
export const apiSlice = createApi({
    reducerPath: 'api', // The key in the store
    baseQuery: fetchBaseQuery({
        baseUrl: 'https://hindustanelectric.onrender.com', // Matching src/api.js
        prepareHeaders: (headers) => {
            const token = localStorage.getItem("token");
            if (token) {
                headers.set('Authorization', `Bearer ${token}`);
            }
            return headers;
        }
    }),
    tagTypes: ['Suppliers'], // Define tags for invalidation
    endpoints: (builder) => ({}), // Endpoints will be injected from other files
});
