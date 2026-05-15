import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { AuthProvider } from "./context/AuthContext";
import { Toaster } from 'react-hot-toast'
import AdminPortal from "./admin/AdminPortal";
import SellerPortal from "./seller/SellerPortal";
import UserPortal from "./userFrontend/UserPortal";
import { supabase } from "./supabase/supabase";

// Separate component to use useNavigate inside BrowserRouter
const AppRoutes = () => {
  const navigate = useNavigate();

  useEffect(() => {
    window.history.scrollRestoration = "manual";
  }, []);

  return (
    <Routes>
      <Route path="/*" element={<UserPortal />} />
      <Route path="/admin/*" element={<AdminPortal />} />
      <Route path="/seller/*" element={<SellerPortal />} />
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