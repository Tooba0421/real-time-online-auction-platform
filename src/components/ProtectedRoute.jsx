import { Navigate } from "react-router-dom";
import { useAuthContext } from "./../context/AuthContext";

// ── ProtectedRoute ─────────────────────────────────────────────────
// Props:
//   children     — the page component to render if check passes
//   requiredRole — optional. If provided, user must have this role.
//                  If not provided, just checks if user is logged in.
//   redirectTo   — where to send the user if check fails (default "/")

const ProtectedRoute = ({
  children,
  requiredRole = null,
  redirectTo = "/",
}) => {
  const { user, profile, loading } = useAuthContext();

  // Wait for auth to finish loading before making any decision
  // Without this, it would redirect logged-in users on page refresh
  // because user is null for a brief moment while session is restored
  if (loading) {
    return (
      <div style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        fontSize: "16px",
        color: "#999",
      }}>
        Loading...
      </div>
    );
  }

  // Not logged in — redirect to home
  if (!user) {
    return <Navigate to={redirectTo} replace />;
  }

  // Logged in but wrong role — redirect to home
  if (requiredRole && profile?.role !== requiredRole) {
    return <Navigate to={redirectTo} replace />;
  }

  // All checks passed — render the page
  return children;
};

export default ProtectedRoute;