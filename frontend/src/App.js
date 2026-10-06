import { Suspense, lazy } from "react";
import { BrowserRouter as Router, Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext.js";
import ErrorBoundary from "./components/Common/ErrorBoundary.js";
import Layout from "./components/Common/Layout.js";
import { TrailProvider } from "./hooks/useTrail.js";
import { A, OWNER } from "./lib/access.js";

const Login = lazy(() => import("./components/Auth/LoginAuth.js"));
const StaffAccess = lazy(() => import("./pages/StaffAccess.js"));
const Home = lazy(() => import("./pages/Home.js"));
const More = lazy(() => import("./pages/More.js"));
const NotFound = lazy(() => import("./pages/NotFound.js"));
const NoAccess = lazy(() => import("./pages/NoAccess.js"));
const ItemList = lazy(() => import("./pages/items/ItemList.js"));
const ItemNew = lazy(() => import("./pages/items/ItemNew.js"));
const ItemDetail = lazy(() => import("./pages/items/ItemDetail.js"));
const PurchaseList = lazy(() => import("./pages/purchases/PurchaseList.js"));
const PurchaseEntry = lazy(() => import("./pages/purchases/PurchaseEntry.js"));
const CountList = lazy(() => import("./pages/stock/CountList.js"));
const CountSheet = lazy(() => import("./pages/stock/CountSheet.js"));
const Adjustments = lazy(() => import("./pages/stock/Adjustments.js"));
const DayEnd = lazy(() => import("./pages/reports/DayEnd.js"));
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

/** Shows the screen only to someone with one of these switches (or "owner" for owner-only screens). */
function Allowed({ any, children }) {
  const { can, isOwner, loading } = useAuth();
  if (loading) return <Loading />;
  const ok = any === OWNER ? isOwner : can(...any);
  return ok ? children : <NoAccess />;
}

const ok = (any, element) => <Allowed any={any}>{element}</Allowed>;

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
              <PrivateRoute>{ok([A.BILLING, A.VIEW_BILLS, A.RETURNS], <BillPrint />)}</PrivateRoute>
            }
          />
          <Route
            path="/credit-notes/:id/print"
            element={
              <PrivateRoute>{ok([A.RETURNS, A.VIEW_BILLS], <CreditNotePrint />)}</PrivateRoute>
            }
          />
          <Route
            path="/receipts/:id/print"
            element={
              <PrivateRoute>{ok([A.PAYMENTS, A.VIEW_KHATA], <ReceiptPrint />)}</PrivateRoute>
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
            {/* Each screen needs one of these switches; finding items is open to everyone. */}
            <Route path="billing" element={ok([A.BILLING], <Billing />)} />
            <Route path="bills" element={ok([A.VIEW_BILLS, A.RETURNS], <BillList />)} />
            <Route path="bills/:id" element={ok([A.VIEW_BILLS, A.RETURNS], <BillDetail />)} />
            <Route path="customers" element={ok([A.VIEW_KHATA, A.PAYMENTS], <CustomerList />)} />
            <Route path="customers/:id" element={ok([A.VIEW_KHATA, A.PAYMENTS], <CustomerDetail />)} />
            <Route path="items" element={<ItemList />} />
            <Route path="items/new" element={ok([A.ADD_ITEMS], <ItemNewRoute />)} />
            <Route path="items/:id" element={<ItemDetail />} />
            <Route path="purchases" element={ok([A.PURCHASES], <PurchaseList />)} />
            <Route path="purchases/new" element={ok([A.PURCHASES], <PurchaseEntryRoute />)} />
            <Route path="purchases/:id" element={ok([A.PURCHASES], <PurchaseEntryRoute />)} />
            <Route path="counts" element={ok([A.COUNT_STOCK, A.FIX_STOCK], <CountList />)} />
            <Route path="counts/:id" element={ok([A.COUNT_STOCK, A.FIX_STOCK], <CountSheet />)} />
            <Route path="suppliers" element={ok([A.PURCHASES], <Suppliers />)} />
            <Route path="adjustments" element={ok([A.FIX_STOCK], <Adjustments />)} />
            <Route path="reports/day-end" element={ok([A.VIEW_SALES], <DayEnd />)} />
            <Route path="import" element={ok([A.IMPORT, A.EDIT_ITEMS], <ImportPage />)} />
            <Route path="staff" element={ok(OWNER, <StaffAccess />)} />
            <Route path="create-user" element={<Navigate to="/staff" replace />} />
            <Route path="*" element={<NotFound />} />
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
