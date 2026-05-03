import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import { AuthProvider } from "./context/AuthContext";
import { Toaster } from 'react-hot-toast'
import ProtectedRoute from "./components/ProtectedRoute";
import AdminPortal from "./admin/AdminPortal";
import SellerPortal from "./seller/SellerPortal";
import UserPortal from "./userFrontend/UserPortal";

function App() {

  useEffect(() => {
    window.history.scrollRestoration = "manual";
  }, []);

  return (
    <AuthProvider>
      <BrowserRouter>
      <Toaster position="top-right" />
        <Routes>
          {/* User Portal — public */}
          <Route path="/*" element={<UserPortal />} />

          {/* Admin Portal — admin only */}
          <Route path="/admin/*" element={
            // <ProtectedRoute allowedRole="admin">
              <AdminPortal />
            // </ProtectedRoute>
          } />

          {/* Seller Portal — seller only */}
          <Route path="/seller/*" element={
            // <ProtectedRoute allowedRole="seller">
              <SellerPortal />
            // </ProtectedRoute>
          } />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;