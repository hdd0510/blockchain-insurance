import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import Navbar from "./components/layout/Navbar";
import ProtectedRoute from "./components/layout/ProtectedRoute";

import LoginPage from "./pages/LoginPage";
import TransactionsPage from "./pages/TransactionsPage";

import DashboardPage from "./pages/DashboardPage";
import PoliciesPage from "./pages/PoliciesPage";
import PolicyDetailPage from "./pages/PolicyDetailPage";
import ClaimsPage from "./pages/ClaimsPage";
import NewClaimPage from "./pages/NewClaimPage";
import ClaimDetailPage from "./pages/ClaimDetailPage";
import AppealsPage from "./pages/AppealsPage";
import HospitalPortalPage from "./pages/HospitalPortalPage";

import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminNewPolicyPage from "./pages/admin/AdminNewPolicyPage";
import AdminClaimsPage from "./pages/admin/AdminClaimsPage";
import AdminAuditLogsPage from "./pages/admin/AdminAuditLogsPage";
import AdminHospitalsPage from "./pages/admin/AdminHospitalsPage";
import InsurerClaimsPage from "./pages/insurer/InsurerClaimsPage";

function AppLayout({ children }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main>{children}</main>
    </div>
  );
}

const wrap = (el) => (
  <ProtectedRoute>
    <AppLayout>{el}</AppLayout>
  </ProtectedRoute>
);

const wrapAdmin = (el) => (
  <ProtectedRoute adminOnly>
    <AppLayout>{el}</AppLayout>
  </ProtectedRoute>
);

const wrapRoles = (el, roles) => (
  <ProtectedRoute roles={roles}>
    <AppLayout>{el}</AppLayout>
  </ProtectedRoute>
);

/** Public route that still uses the app shell (navbar, login state). */
const wrapLayout = (el) => <AppLayout>{el}</AppLayout>;

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/transactions" element={wrapLayout(<TransactionsPage />)} />

          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* Authenticated routes (any role) */}
          <Route path="/dashboard" element={wrap(<DashboardPage />)} />

          {/* Customer routes */}
          <Route path="/policies" element={wrap(<PoliciesPage />)} />
          <Route path="/policies/:id" element={wrap(<PolicyDetailPage />)} />
          <Route path="/claims" element={wrap(<ClaimsPage />)} />
          <Route path="/claims/new" element={wrap(<NewClaimPage />)} />
          <Route path="/claims/:id" element={wrap(<ClaimDetailPage />)} />
          <Route path="/appeals" element={wrap(<AppealsPage />)} />

          <Route
            path="/insurer/claims"
            element={wrapRoles(<InsurerClaimsPage />, ["insurer", "admin"])}
          />

          {/* Hospital portal */}
          <Route
            path="/hospital"
            element={wrapRoles(<HospitalPortalPage />, ["hospital", "admin"])}
          />

          {/* Admin routes */}
          <Route path="/admin" element={wrapAdmin(<AdminDashboard />)} />
          <Route path="/admin/policies/new" element={wrapAdmin(<AdminNewPolicyPage />)} />
          <Route path="/admin/claims" element={wrapAdmin(<AdminClaimsPage />)} />
          <Route path="/admin/audit-logs" element={wrapAdmin(<AdminAuditLogsPage />)} />
          <Route path="/admin/hospitals" element={wrapAdmin(<AdminHospitalsPage />)} />

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
