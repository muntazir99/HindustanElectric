import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../api.js';

// Async thunk to fetch the aging report data
export const fetchAgingReport = createAsyncThunk(
  'reports/fetchAging',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/reports/aging');
      return response.data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch aging report.');
    }
  }
);

const reportsSlice = createSlice({
  name: 'reports',
  initialState: {
    agingReport: {},
    loading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchAgingReport.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAgingReport.fulfilled, (state, action) => {
        state.loading = false;
        state.agingReport = action.payload;
      })
      .addCase(fetchAgingReport.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export default reportsSlice.reducer;