import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../api.js';

// Async thunk to fetch all suppliers
export const fetchSuppliers = createAsyncThunk(
  'suppliers/fetchSuppliers',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/purchases/suppliers');
      return response.data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch suppliers.');
    }
  }
);

// Async thunk to add a new supplier
export const addSupplier = createAsyncThunk(
  'suppliers/addSupplier',
  async (supplierData, { rejectWithValue }) => {
    try {
      const response = await api.post('/purchases/suppliers', supplierData);
      return response.data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to add supplier.');
    }
  }
);

const suppliersSlice = createSlice({
  name: 'suppliers',
  initialState: {
    items: [],
    loading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      // Reducers for fetchSuppliers
      .addCase(fetchSuppliers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchSuppliers.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(fetchSuppliers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Reducers for addSupplier
      .addCase(addSupplier.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(addSupplier.fulfilled, (state, action) => {
        state.loading = false;
        state.items.push(action.payload); // Add the new supplier to the list
      })
      .addCase(addSupplier.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export default suppliersSlice.reducer;