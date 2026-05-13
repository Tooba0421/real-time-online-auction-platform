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
          <Route path="/*" element={<UserPortal />} />
          <Route path="/admin/*" element={<AdminPortal />} />
          <Route path="/seller/*" element={<SellerPortal />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;