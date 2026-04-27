import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import AdminPortal from "./admin/AdminPortal";
import SellerPortal from "./seller/SellerPortal";
import UserPortal from "./userFrontend/UserPortal";
import { supabase } from "./supabase";

function App() {

  useEffect(() => {
    window.history.scrollRestoration = "manual";

    // Test Supabase connection
    const testConnection = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')

      if (error) {
        console.log('Supabase connection failed:', error)
      } else {
        console.log('Supabase connected successfully!', data)
      }
    }
    testConnection()
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        {/* User Portal */}
        <Route path="/*" element={<UserPortal />} />

        {/* Admin Portal */}
        <Route path="/admin/*" element={<AdminPortal />} />

        {/* Seller Portal */}
        <Route path="/seller/*" element={<SellerPortal />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;