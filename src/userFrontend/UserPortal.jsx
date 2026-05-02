import { Routes, Route } from "react-router-dom";
import ProtectedRoute from "../components/ProtectedRoute";
import HomePage from "./pages/HomePage";
import ProductDetailPage from "./pages/ProductDetailPage";
import NotificationsPage from "./pages/NotificationsPage";
import CheckoutPage from "./pages/CheckoutPage";
import CategoryPage from "./pages/CategoryPage";
import AuctionsPage from "./pages/AuctionsPage";
import HowToBid from "./pages/HowToBid";
import AuctionRules from "./pages/AuctionRules";
import BuyerProtection from "./pages/BuyerProtection";
import SellerGuide from "./pages/SellerGuide";
import BecomeSeller from "./pages/BecomeSeller";
import FAQ from "./pages/FAQ";
import SearchPage from "./pages/SearchPage";
import ProfilePage from "./pages/ProfilePage";
import ResetPasswordPage from "./pages/ResetPasswordPage";

const UserPortal = () => {
  return (
    <Routes>

      {/* Public pages — anyone can access */}
      <Route path="/" element={<HomePage />} />
      <Route path="/product/:id" element={<ProductDetailPage />} />
      <Route path="/category/:category" element={<CategoryPage />} />
      <Route path="/auctions" element={<AuctionsPage />} />
      <Route path="/how-to-bid" element={<HowToBid />} />
      <Route path="/auction-rules" element={<AuctionRules />} />
      <Route path="/buyer-protection" element={<BuyerProtection />} />
      <Route path="/seller-guide" element={<SellerGuide />} />
      <Route path="/become-seller" element={<BecomeSeller />} />
      <Route path="/faq" element={<FAQ />} />
      <Route path="/search" element={<SearchPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* Protected pages — only logged in users */}
      <Route path="/notifications" element={
        // <ProtectedRoute>
          <NotificationsPage />
        //  </ProtectedRoute>
      } />

      <Route path="/checkout" element={
        // <ProtectedRoute>
          <CheckoutPage />
        // </ProtectedRoute>
      } />

      <Route path="/profile" element={
        // <ProtectedRoute>
          <ProfilePage />
        // </ProtectedRoute>
      } />

    </Routes>
  );
};

export default UserPortal;