import { useState, useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AdminProvider } from "../context/AdminContext";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import Home from "./pages/Home";
import UserManagement from "./pages/UserManagement";
import SellerManagement from "./pages/SellerManagement";
import BidderManagement from "./pages/BidderManagement";
import ProductManagement from "./pages/ProductManagement";
import AuctionBidMonitoring from "./pages/AuctionBidMonitoring";
import OrderDeliveryManagement from "./pages/OrderDeliveryManagement";
import RevenuePayouts from "./pages/RevenuePayouts";
import "./styles/adminDashboard.css";

// Map each route path to its page title
// Used by Header and to highlight active sidebar item
const PAGE_TITLES = {
  "/admin":          "Dashboard Overview",
  "/admin/users":    "User Management",
  "/admin/sellers":  "Seller Management",
  "/admin/bidders":  "Bidder Management",
  "/admin/products": "Products & Listings",
  "/admin/auctions": "Auctions & Bid Monitoring",
  "/admin/orders":   "Order & Delivery",
  "/admin/revenue":  "Revenue Payouts",
};

// ── AdminLayout ────────────────────────────────────────────────────
// Renders sidebar + header + nested route outlet.
// Lives inside AdminProvider so all pages share context data.

const AdminLayout = () => {
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Responsive sidebar
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 480;
      setIsMobile(mobile);
      if (!mobile && window.innerWidth > 768) setIsCollapsed(false);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Auto-close sidebar on mobile when route changes
  useEffect(() => {
    if (window.innerWidth <= 768) setIsCollapsed(false);
  }, [location.pathname]);

  // Derive page title from current path
  const title = PAGE_TITLES[location.pathname] || "Admin";

  return (
    <div className="admin-layout">
      {/* Sidebar uses NavLink internally — no setActiveItem needed */}
      <Sidebar
        activeItem={title}
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
        isMobile={isMobile}
      />

      <div className="main-layout">
        <Header title={title} />

        <div className="main-wrapper">
          <Routes>
            <Route index                      element={<Home />} />
            <Route path="users"               element={<UserManagement />} />
            <Route path="sellers"             element={<SellerManagement />} />
            <Route path="bidders"             element={<BidderManagement />} />
            <Route path="products"            element={<ProductManagement />} />
            <Route path="auctions"            element={<AuctionBidMonitoring />} />
            <Route path="orders"              element={<OrderDeliveryManagement />} />
            <Route path="revenue"             element={<RevenuePayouts />} />
            {/* Catch-all — redirect unknown admin paths to dashboard */}
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
};

// ── AdminPortal ────────────────────────────────────────────────────
// Entry point mounted at /admin/* in App.jsx.
// AdminProvider wraps everything so context is fetched ONCE
// and shared across all admin pages — no page fetches its own data.

const AdminPortal = () => {
  return (
    <AdminProvider>
      <AdminLayout />
    </AdminProvider>
  );
};

export default AdminPortal;