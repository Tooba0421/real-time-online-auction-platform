import { useState, useEffect } from "react";

import SellerSidebar from "../components/SellerSidebar";
import SellerHeader from "../components/SellerHeader";

import SellerHome from "./SellerHome";
import LiveAuctions from "./LiveAuctions";
import AuctionManagement from "./AuctionManagement";
import CreateAuction from "./CreateAuction";
import EarningsPayouts from "./EarningsPayouts";
import OrdersDelivery from "./OrdersDelivery";

import "../styles/sellerDashboard.css";

const SellerDashboard = () => {
  const [activeItem, setActiveItem] = useState("Dashboard Overview");
  const [showCreateAuction, setShowCreateAuction] = useState(false);
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

  // Auto close on mobile
  const handleItemClick = (item) => {
    setActiveItem(item);
    if (window.innerWidth <= 768) {
      setIsCollapsed(false);
    }
  };

  const renderContent = () => {
    if (showCreateAuction) {
      return <CreateAuction onBack={() => setShowCreateAuction(false)} />;
    }

    switch (activeItem) {
      case "Live Auction Monitoring":
        return <LiveAuctions />;
      case "Auction Management":
        return (
          <AuctionManagement
            openCreateAuction={() => setShowCreateAuction(true)}
          />
        );
      case "Listings & Inventory":
        return <ListingsInventory />;
      case "Bidding & Buyer Insights":
        return <BuyerInsights />;
      case "Earnings & Payouts":
        return <EarningsPayouts />;
      case "Orders & Delivery":
        return <OrdersDelivery />;
      default:
        return <SellerHome />;
    }
  };

  return (
    <div className="seller-layout">
      <SellerSidebar
        activeItem={activeItem}
        setActiveItem={handleItemClick}
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
        isMobile={isMobile}
      />

      <div
        className={`seller-main ${
          !isMobile && isCollapsed ? "collapsed" : ""
        }`}
      >
        <SellerHeader title={activeItem} />
        <div className="seller-content">{renderContent()}</div>
      </div>
    </div>
  );
};

export default SellerDashboard;