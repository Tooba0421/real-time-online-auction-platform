import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { AuthProvider } from "./context/AuthContext";
import { Toaster } from 'react-hot-toast'
import AdminPortal from "./admin/AdminPortal";
import SellerPortal from "./seller/SellerPortal";
import UserPortal from "./userFrontend/UserPortal";
import ProtectedRoute from "./components/ProtectedRoute";

const AppRoutes = () => {
  const navigate = useNavigate();

  useEffect(() => {
    window.history.scrollRestoration = "manual";

  }, []);

  return (
    <Routes>
      <Route path="/*" element={<UserPortal />} />

      <Route
        path="/admin/*"
        element={
          <ProtectedRoute requiredRole="admin">
            <AdminPortal />
          </ProtectedRoute>
        }
      />

      <Route
        path="/seller/*"
        element={
          <ProtectedRoute requiredRole="seller">
            <SellerPortal />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" />
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;