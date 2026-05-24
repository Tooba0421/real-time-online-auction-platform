import { Routes, Route, Navigate } from "react-router-dom";
import { SellerProvider } from "../context/SellerContext";
import SellerLayout from "./SellerLayout";
import SellerHome from "./pages/SellerHome";
import LiveAuctions from "./pages/LiveAuctions";
import AuctionManagement from "./pages/AuctionManagement";
import CreateAuction from "./pages/CreateAuction";
import EarningsPayouts from "./pages/EarningsPayouts";
import OrdersDelivery from "./pages/OrdersDelivery";

// SellerProvider wraps the entire portal so sellerId and all data
// are fetched ONCE and shared across every page via context.
// No page ever fetches its own sellerId again.

const SellerPortal = () => {
  return (
    <SellerProvider>
      <Routes>
        {/* All seller pages share the same layout (sidebar + header) */}
        <Route element={<SellerLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<SellerHome />} />
          <Route path="live-auctions" element={<LiveAuctions />} />
          <Route path="auction-management" element={<AuctionManagement />} />
          <Route path="create-auction" element={<CreateAuction />} />
          <Route path="earnings" element={<EarningsPayouts />} />
          <Route path="orders" element={<OrdersDelivery />} />
        </Route>
      </Routes>
    </SellerProvider>
  );
};

export default SellerPortal;