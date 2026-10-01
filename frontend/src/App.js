import React, { Suspense, lazy } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext.js";
import { Provider } from 'react-redux';
import { store } from './store/store.js';

import Layout from "./components/Common/Layout.js";

// Lazy Component Imports
const Dashboard = lazy(() => import("./components/Dashboard/Dashboard.js"));
const AddItem = lazy(() => import("./components/Inventory/AddItem.js"));
const SellItem = lazy(() => import("./components/Logs/SellItem.js"));
const ReturnItem = lazy(() => import("./components/Logs/ReturnItem.js"));
const CalendarDashboard = lazy(() => import("./components/Dashboard/CalendarDashboard.js"));
const Logs = lazy(() => import("./components/Logs/LogsList.js"));
const Inventory = lazy(() => import("./components/Inventory/InventoryList.js"));
const Login = lazy(() => import("./components/Auth/LoginAuth.js"));
const CreateUser = lazy(() => import("./components/Auth/CreateUser.js"));
const Billing = lazy(() => import("./components/Logs/Billing.js"));
const InvoiceList = lazy(() => import("./components/Invoices/InvoiceList.js"));
const SupplierManager = lazy(() => import("./components/Purchasing/SupplierManager.js"));
const CreatePO = lazy(() => import("./components/Purchasing/CreatePO.js"));
const PurchaseOrderList = lazy(() => import("./components/Purchasing/PurchaseOrderList.js"));
const ReceiveGoods = lazy(() => import("./components/Purchasing/ReceiveGoods.js"));
const PurchaseOrderDetail = lazy(() => import("./components/Purchasing/PurchaseOrderDetail.js"));
const CustomerManager = lazy(() => import("./components/Customers/CustomerManager.js"));
const AgingReport = lazy(() => import("./components/Reports/AgingReport.js"));
const RecordPayment = lazy(() => import("./components/Payments/RecordPayment.js"));
// --- Route Protection Components ---
function PrivateRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
  }
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function AdminRoute({ children }) {
  const { user, isAuthenticated, loading } = useAuth();
  if (loading) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
  }
  return isAuthenticated && user.role === 'admin' ? children : <Navigate to="/dashboard" replace />;
}

import ErrorBoundary from "./components/Common/ErrorBoundary.js";

// --- Main App Routes Component ---
function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <ErrorBoundary>
      <Suspense fallback={<div className="flex h-screen items-center justify-center font-semibold text-lg text-gray-600">Loading Application...</div>}>
        <Routes>
          {/* Public Login Route */}
          <Route path="/login" element={<Login />} />

          {/* Protected Routes nested under the Layout */}
          <Route
            path="/"
            element={
              <PrivateRoute>
                <Layout />
              </PrivateRoute>
            }
          >
            {/* When the path is just "/", navigate to the dashboard */}
            <Route index element={<Navigate to="/dashboard" replace />} />

            {/* All other pages are rendered inside the Layout's <Outlet /> */}
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="inventory/add" element={<AddItem />} />
            <Route path="logs" element={<Logs />} />
            <Route path="logs/allot" element={<SellItem />} />
            <Route path="logs/return" element={<ReturnItem />} />
            <Route path="calendar" element={<CalendarDashboard />} />
            <Route path="billing" element={<Billing />} />
            <Route path="invoices" element={<InvoiceList />} />
            <Route path="suppliers" element={<AdminRoute><SupplierManager /></AdminRoute>} />
            <Route path="purchase-orders/new" element={<AdminRoute><CreatePO /></AdminRoute>} />
            <Route path="purchase-orders" element={<AdminRoute><PurchaseOrderList /></AdminRoute>} />
            <Route path="purchase-orders/:orderId/receive" element={<AdminRoute><ReceiveGoods /></AdminRoute>} />
            <Route path="purchase-orders/:orderId" element={<AdminRoute><PurchaseOrderDetail /></AdminRoute>} />
            <Route path="customers" element={<AdminRoute><CustomerManager /></AdminRoute>} />
            <Route path="reports/aging" element={<AdminRoute><AgingReport /></AdminRoute>} />
            <Route path="payments/new" element={<AdminRoute><RecordPayment /></AdminRoute>} />


            {/* Admin-Only Route */}

            <Route
              path="create-user"
              element={
                <AdminRoute>
                  <CreateUser />
                </AdminRoute>
              }
            />
          </Route>

          {/* Fallback for any other path */}
          <Route path="*" element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}

// --- Root App Component ---
function App() {
  return (
    <Provider store={store}>
      <AuthProvider>
        <Router>
          <AppRoutes />
        </Router>
      </AuthProvider>
    </Provider>
  );
}

export default App;