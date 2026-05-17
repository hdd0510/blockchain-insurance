import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

// Redirect to /login if no authenticated user
// If adminOnly=true, also redirect non-admins
export default function ProtectedRoute({ children, adminOnly = false }) {
  const { user, isAdmin } = useAuth();

  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && !isAdmin) return <Navigate to="/dashboard" replace />;

  return children;
}
