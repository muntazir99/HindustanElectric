import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../api.js';

// Async thunk to fetch all logs
export const fetchLogs = createAsyncThunk(
  'logs/fetchLogs',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/logs/');
      // Ensure we return an array, even if the API response is faulty
      return Array.isArray(response.data.data) ? response.data.data : [];
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch logs.');
    }
  }
);

const logsSlice = createSlice({
  name: 'logs',
  initialState: {
    items: [],
    loading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchLogs.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchLogs.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(fetchLogs.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export default logsSlice.reducer;