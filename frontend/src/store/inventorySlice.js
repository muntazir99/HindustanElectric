import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../api.js';

// Async thunk for fetching inventory data
export const fetchInventory = createAsyncThunk(
  'inventory/fetchInventory',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/inventory/');
      return (response.data.data || []).filter(item => item); // Ensure we return a clean array
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch inventory.');
    }
  }
);

const inventorySlice = createSlice({
  name: 'inventory',
  initialState: {
    items: [],
    loading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchInventory.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchInventory.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(fetchInventory.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export default inventorySlice.reducer;