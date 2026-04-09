import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import AdminPortal from "./admin/AdminPortal";
import SellerPortal from "./seller/SellerPortal";
import UserPortal from "./userFrontend/UserPortal";
import ProductDetailPage from "./userFrontend/pages/ProductDetailPage";
import NotificationsPage from "./userFrontend/pages/NotificationsPage";
import CheckoutPage from "./userFrontend/pages/CheckoutPage";
import CategoryPage from "./userFrontend/pages/CategoryPage";
import AuctionsPage from "./userFrontend/pages/AuctionsPage";
import HowToBid from "./userFrontend/pages/HowToBid";
import AuctionRules from "./userFrontend/pages/AuctionRules";
import BuyerProtection from "./userFrontend/pages/BuyerProtection";
import SellerGuide from "./userFrontend/pages/SellerGuide";
import BecomeSeller from "./userFrontend/pages/BecomeSeller";


function App() {

  useEffect(() => {
    window.history.scrollRestoration = "manual";
  }, []);

  return (
    <BrowserRouter>
      <Routes>

        {/* User site */}
        <Route path="/" element={<UserPortal />} />

        {/* Product page */}
        <Route path="/product/:id" element={<ProductDetailPage />} />

        {/* Admin portal */}
        <Route path="/admin" element={<AdminPortal />} />

        {/* Seller portal */}
        <Route path="/seller" element={<SellerPortal />} />

        {/* Notification page */}
        <Route path="/notifications" element={<NotificationsPage />} />

        <Route path="/checkout" element={<CheckoutPage />} />

        <Route path="/category/:category" element={<CategoryPage />} />

        <Route path="/auctions" element={<AuctionsPage />} />

        <Route path="/how-to-bid" element={<HowToBid />} />

        <Route path="/auction-rules" element={<AuctionRules />} />

        <Route path="/buyer-protection" element={<BuyerProtection />} />

        <Route path="/seller-guide" element={<SellerGuide />} />

        <Route path="/become-seller" element={<BecomeSeller />} />

      </Routes>
    </BrowserRouter>
  );
}

export default App;