import { apiSlice } from './apiSlice';

export const suppliersApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        getSuppliers: builder.query({
            query: () => '/purchases/suppliers',
            transformResponse: (response) => response.data, // Unwrap the 'data' property
            providesTags: ['Suppliers'],
        }),
        addSupplier: builder.mutation({
            query: (body) => ({
                url: '/purchases/suppliers',
                method: 'POST',
                body,
            }),
            invalidatesTags: ['Suppliers'],
        }),
    }),
});

export const { useGetSuppliersQuery, useAddSupplierMutation } = suppliersApi;
