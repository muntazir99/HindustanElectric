import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../api.js';

// --- ASYNCHRONOUS THUNKS ---

// Async thunk to create a new purchase order
export const createPurchaseOrder = createAsyncThunk(
  'purchaseOrders/create',
  async (poData, { rejectWithValue }) => {
    try {
      const response = await api.post('/purchases/orders', poData);
      return response.data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to create purchase order.');
    }
  }
);

// Async thunk to fetch all purchase orders
export const fetchPurchaseOrders = createAsyncThunk(
  'purchaseOrders/fetchAll',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/purchases/orders');
      return response.data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch purchase orders.');
    }
  }
);

// Async thunk to fetch a single purchase order by its ID
export const fetchPurchaseOrderById = createAsyncThunk(
  'purchaseOrders/fetchById',
  async (orderId, { rejectWithValue }) => {
    try {
      const response = await api.get(`/purchases/orders/${orderId}`);
      return response.data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch PO details.');
    }
  }
);

// Async thunk to manually close a purchase order
export const closePurchaseOrder = createAsyncThunk(
  'purchaseOrders/close',
  async (orderId, { rejectWithValue, dispatch }) => {
    try {
      const response = await api.post(`/purchases/orders/${orderId}/close`);
      // After closing, refetch all POs to update the list status
      dispatch(fetchPurchaseOrders());
      return { ...response.data, orderId }; // Pass orderId along for specific updates
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to close PO.');
    }
  }
);


// --- SLICE DEFINITION ---

const purchaseOrderSlice = createSlice({
  name: 'purchaseOrders',
  initialState: {
    items: [],
    selectedOrder: null, // To hold the details of a single fetched order
    loading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      // Reducers for creating a PO
      .addCase(createPurchaseOrder.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createPurchaseOrder.fulfilled, (state, action) => {
        state.loading = false;
        state.items.unshift(action.payload);
      })
      .addCase(createPurchaseOrder.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Reducers for fetching all POs
      .addCase(fetchPurchaseOrders.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPurchaseOrders.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(fetchPurchaseOrders.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Reducers for fetching a single PO
      .addCase(fetchPurchaseOrderById.pending, (state) => {
        state.loading = true;
        state.selectedOrder = null;
        state.error = null;
      })
      .addCase(fetchPurchaseOrderById.fulfilled, (state, action) => {
        state.loading = false;
        state.selectedOrder = action.payload;
      })
      .addCase(fetchPurchaseOrderById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Reducers for closing a PO
      .addCase(closePurchaseOrder.pending, (state) => {
        state.loading = true;
      })
      .addCase(closePurchaseOrder.fulfilled, (state, action) => {
        state.loading = false;
        // Update the status in the main list
        const index = state.items.findIndex(po => po._id === action.payload.orderId);
        if (index !== -1) {
            state.items[index].status = action.payload.message.includes("Variance") 
                ? "Completed with Variance" 
                : "Completed";
        }
        // Update the selected order as well, if it's the one being viewed
        if (state.selectedOrder && state.selectedOrder._id === action.payload.orderId) {
            state.selectedOrder.status = state.items[index].status;
        }
      })
      .addCase(closePurchaseOrder.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export default purchaseOrderSlice.reducer;