import { useState, useEffect } from "react";

import Sidebar from "../components/Sidebar";
import Header from "../components/Header";

import Home from "./Home";
import UserManagement from "./UserManagement";
import SellerManagement from "./SellerManagement";
import ProductManagement from "./ProductManagement";
import AuctionsBidMonitoring from "./AuctionsBidMonitoring";
import OrderDeliveryManagement from "./OrderDeliveryManagement";
import RevenuePayouts from "./RevenuePayouts";

import "../styles/adminDashboard.css";

const AdminDashboard = () => {
  const [activeItem, setActiveItem] = useState("Dashboard Overview");
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Detect screen size
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 480;
      setIsMobile(mobile);

      if (!mobile && window.innerWidth > 768) {
        setIsCollapsed(false);
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // 🔥 Auto close sidebar when item clicked on mobile
  const handleItemClick = (item) => {
    setActiveItem(item);
    if (window.innerWidth <= 768) {
      setIsCollapsed(false);
    }
  };

  const renderContent = () => {
    switch (activeItem) {
      case "Dashboard Overview":
        return <Home />;
      case "User Management":
        return <UserManagement />;
      case "Seller Management":
        return <SellerManagement />;
      case "Products & Listings":
        return <ProductManagement />;
      case "Auctions & Bid Monitoring":
        return <AuctionsBidMonitoring />;
      case "Order & Delivery":
        return <OrderDeliveryManagement />;
      case "Revenue Payouts":
        return <RevenuePayouts />;
      default:
        return <Home />;
    }
  };

  return (
    <div className="admin-layout">
      <Sidebar
        activeItem={activeItem}
        setActiveItem={handleItemClick}
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
        isMobile={isMobile}
      />

      <div className="main-layout">
        {/* ✅ Now Dynamic */}
        <Header title={activeItem} />

        <div className="main-wrapper">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;