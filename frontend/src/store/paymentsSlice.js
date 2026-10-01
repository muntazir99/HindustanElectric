import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../api.js';
import { fetchCustomers } from './customersSlice.js'; // To refresh customer data after payment

// Async thunk to record a new payment
export const recordPayment = createAsyncThunk(
  'payments/recordPayment',
  async (paymentData, { rejectWithValue, dispatch }) => {
    try {
      const response = await api.post('/payments/', paymentData);
      // After a successful payment, refetch customers to get updated balances
      dispatch(fetchCustomers());
      return response.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to record payment.');
    }
  }
);

const paymentsSlice = createSlice({
  name: 'payments',
  initialState: {
    loading: false,
    error: null,
    successMessage: ''
  },
  reducers: {
    clearPaymentMessages: (state) => {
        state.error = null;
        state.successMessage = '';
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(recordPayment.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.successMessage = '';
      })
      .addCase(recordPayment.fulfilled, (state, action) => {
        state.loading = false;
        state.successMessage = action.payload.message;
      })
      .addCase(recordPayment.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { clearPaymentMessages } = paymentsSlice.actions;
export default paymentsSlice.reducer;