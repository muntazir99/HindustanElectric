import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../api.js';

// Async thunk to fetch all customers
export const fetchCustomers = createAsyncThunk(
  'customers/fetchCustomers',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/customers/');
      return response.data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch customers.');
    }
  }
);

// Async thunk to add a new customer
export const addCustomer = createAsyncThunk(
  'customers/addCustomer',
  async (customerData, { rejectWithValue }) => {
    try {
      const response = await api.post('/customers/', customerData);
      return response.data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to add customer.');
    }
  }
);

const customersSlice = createSlice({
  name: 'customers',
  initialState: {
    items: [],
    loading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      // Reducers for fetchCustomers
      .addCase(fetchCustomers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCustomers.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(fetchCustomers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Reducers for addCustomer
      .addCase(addCustomer.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(addCustomer.fulfilled, (state, action) => {
        state.loading = false;
        state.items.push(action.payload); // Add the new customer to the list
      })
      .addCase(addCustomer.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export default customersSlice.reducer;