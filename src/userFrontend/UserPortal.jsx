import { Routes, Route } from "react-router-dom";
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

const UserPortal = () => {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/product/:id" element={<ProductDetailPage />} />
      <Route path="/notifications" element={<NotificationsPage />} />
      <Route path="/checkout" element={<CheckoutPage />} />
      <Route path="/category/:category" element={<CategoryPage />} />
      <Route path="/auctions" element={<AuctionsPage />} />
      <Route path="/how-to-bid" element={<HowToBid />} />
      <Route path="/auction-rules" element={<AuctionRules />} />
      <Route path="/buyer-protection" element={<BuyerProtection />} />
      <Route path="/seller-guide" element={<SellerGuide />} />
      <Route path="/become-seller" element={<BecomeSeller />} />
      <Route path="/faq" element={<FAQ />} />
      <Route path="/search" element={<SearchPage />} />
    </Routes>
  );
};

export default UserPortal;