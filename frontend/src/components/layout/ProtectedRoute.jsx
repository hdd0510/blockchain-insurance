import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

// Redirect to /login if no authenticated user.
// `roles` (array | string) restricts access to specific roles, e.g. ["admin"] or ["hospital","admin"].
// `adminOnly` kept for back-compat with v1.
export default function ProtectedRoute({ children, adminOnly = false, roles = null }) {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;

  const allowed = roles
    ? (Array.isArray(roles) ? roles : [roles]).includes(user.role)
    : adminOnly
    ? user.role === "admin"
    : true;

  if (!allowed) return <Navigate to="/dashboard" replace />;

  return children;
}
