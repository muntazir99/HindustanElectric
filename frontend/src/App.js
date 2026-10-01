import { Suspense, lazy } from "react";
import { BrowserRouter as Router, Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext.js";
import ErrorBoundary from "./components/Common/ErrorBoundary.js";
import Layout from "./components/Common/Layout.js";
import { TrailProvider } from "./hooks/useTrail.js";

const Login = lazy(() => import("./components/Auth/LoginAuth.js"));
const CreateUser = lazy(() => import("./components/Auth/CreateUser.js"));
const Home = lazy(() => import("./pages/Home.js"));
const More = lazy(() => import("./pages/More.js"));
const ItemList = lazy(() => import("./pages/items/ItemList.js"));
const ItemNew = lazy(() => import("./pages/items/ItemNew.js"));
const ItemDetail = lazy(() => import("./pages/items/ItemDetail.js"));
const PurchaseList = lazy(() => import("./pages/purchases/PurchaseList.js"));
const PurchaseEntry = lazy(() => import("./pages/purchases/PurchaseEntry.js"));
const CountList = lazy(() => import("./pages/stock/CountList.js"));
const CountSheet = lazy(() => import("./pages/stock/CountSheet.js"));
const Adjustments = lazy(() => import("./pages/stock/Adjustments.js"));
const ImportPage = lazy(() => import("./pages/ImportPage.js"));
const Suppliers = lazy(() => import("./pages/Suppliers.js"));
const Billing = lazy(() => import("./pages/billing/Billing.js"));
const BillList = lazy(() => import("./pages/billing/BillList.js"));
const BillDetail = lazy(() => import("./pages/billing/BillDetail.js"));
const BillPrint = lazy(() => import("./pages/billing/BillPrint.js"));
const CustomerList = lazy(() => import("./pages/customers/CustomerList.js"));
const CustomerDetail = lazy(() => import("./pages/customers/CustomerDetail.js"));
const ReceiptPrint = lazy(() => import("./pages/customers/ReceiptPrint.js"));
const CreditNotePrint = lazy(() => import("./pages/billing/CreditNotePrint.js"));

/** A fresh screen per bill, so moving from /purchases/new to /purchases/12 resets everything. */
function PurchaseEntryRoute() {
  const { id } = useParams();
  return <PurchaseEntry key={id || "new"} />;
}

/** A fresh, empty form each time "Add another item" opens it again. */
function ItemNewRoute() {
  const { key } = useLocation();
  return <ItemNew key={key} />;
}

function Loading() {
  return <div className="flex h-screen items-center justify-center text-gray-600">Loading…</div>;
}

function PrivateRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <Loading />;
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function OwnerRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  return user?.role === "owner" ? children : <Navigate to="/dashboard" replace />;
}

function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <ErrorBoundary>
      <TrailProvider>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          {/* Printing: no menu or layout around the bill. */}
          <Route
            path="/bills/:id/print"
            element={
              <PrivateRoute>
                <BillPrint />
              </PrivateRoute>
            }
          />
          <Route
            path="/credit-notes/:id/print"
            element={
              <PrivateRoute>
                <CreditNotePrint />
              </PrivateRoute>
            }
          />
          <Route
            path="/receipts/:id/print"
            element={
              <PrivateRoute>
                <ReceiptPrint />
              </PrivateRoute>
            }
          />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <Layout />
              </PrivateRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Home />} />
            <Route path="more" element={<More />} />
            <Route path="billing" element={<Billing />} />
            <Route path="bills" element={<BillList />} />
            <Route path="bills/:id" element={<BillDetail />} />
            <Route path="customers" element={<CustomerList />} />
            <Route path="customers/:id" element={<CustomerDetail />} />
            <Route path="items" element={<ItemList />} />
            <Route path="items/new" element={<ItemNewRoute />} />
            <Route path="items/:id" element={<ItemDetail />} />
            <Route path="purchases" element={<PurchaseList />} />
            <Route path="purchases/new" element={<PurchaseEntryRoute />} />
            <Route path="purchases/:id" element={<PurchaseEntryRoute />} />
            <Route path="counts" element={<CountList />} />
            <Route path="counts/:id" element={<CountSheet />} />
            <Route path="suppliers" element={<Suppliers />} />
            <Route path="adjustments" element={<OwnerRoute><Adjustments /></OwnerRoute>} />
            <Route path="import" element={<OwnerRoute><ImportPage /></OwnerRoute>} />
            <Route path="create-user" element={<OwnerRoute><CreateUser /></OwnerRoute>} />
          </Route>
          <Route path="*" element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />} />
        </Routes>
      </Suspense>
      </TrailProvider>
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}
