import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import SellerSidebar from "./components/SellerSidebar";
import SellerHeader from "./components/SellerHeader";
import "./styles/sellerDashboard.css";

// Map sidebar menu names to their routes
export const SELLER_ROUTES = {
  "Dashboard Overview":     "/seller/dashboard",
  "Live Auction Monitoring":"/seller/live-auctions",
  "Auction Management":     "/seller/auction-management",
  "Earnings & Payouts":     "/seller/earnings",
  "Orders & Delivery":      "/seller/orders",
};

// Reverse map: path → menu name (for highlighting active item)
const PATH_TO_NAME = Object.fromEntries(
  Object.entries(SELLER_ROUTES).map(([k, v]) => [v, k])
);

const getPageTitle = (pathname) => {
  // Exact match first
  if (PATH_TO_NAME[pathname]) return PATH_TO_NAME[pathname];
  // Partial match (e.g. /seller/create-auction)
  if (pathname.includes("create-auction")) return "Create Auction";
  return "Seller Portal";
};

const SellerLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

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

  const activeItem = getPageTitle(location.pathname);

  const handleItemClick = (itemName) => {
    const route = SELLER_ROUTES[itemName];
    if (route) navigate(route);
    // Close sidebar on mobile after navigation
    if (window.innerWidth <= 768) setIsCollapsed(false);
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

      <div className={`seller-main ${!isMobile && isCollapsed ? "collapsed" : ""}`}>
        <SellerHeader title={activeItem} />
        {/* Outlet renders the matched child route */}
        <div className="seller-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default SellerLayout;