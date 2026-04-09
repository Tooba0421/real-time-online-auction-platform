import {
  FaTachometerAlt,
  FaGavel,
  FaTasks,
  FaBoxOpen,
  FaChartLine,
  FaMoneyBillWave,
  FaTruck,
  FaBars,
} from "react-icons/fa";

import "../styles/sellerDashboard.css";

const sellerMenu = [
  { name: "Dashboard Overview", icon: <FaTachometerAlt /> },
  { name: "Live Auction Monitoring", icon: <FaGavel /> },
  { name: "Auction Management", icon: <FaTasks /> },
  { name: "Listings & Inventory", icon: <FaBoxOpen /> },
  { name: "Bidding & Buyer Insights", icon: <FaChartLine /> },
  { name: "Earnings & Payouts", icon: <FaMoneyBillWave /> },
  { name: "Orders & Delivery", icon: <FaTruck /> },
];

const SellerSidebar = ({
  activeItem,
  setActiveItem,
  isCollapsed,
  setIsCollapsed,
  isMobile,
}) => {
  return (
    <aside
      className={`seller-sidebar 
        ${isMobile ? "mobile-mode" : ""} 
        ${!isMobile && isCollapsed ? "collapsed" : ""} 
        ${isMobile && isCollapsed ? "open" : ""}
      `}
    >
      {/* ===== Desktop Title ===== */}
      <h3 className="sidebar-title desktop-title">AUCTION SELLER</h3>

      {/* ===== Mobile Toggle ===== */}
      <div
        className={`sidebar-header mobile-toggle ${
          isCollapsed ? "expanded" : ""
        }`}
      >
        <FaBars
          className="sidebar-toggle"
          onClick={() => setIsCollapsed(!isCollapsed)}
        />
        {isCollapsed && (
          <span className="mobile-title-text">AUCTION SELLER</span>
        )}
      </div>

      <ul className="nav d-flex flex-column gap-2">
        {sellerMenu.map((item) => (
          <li key={item.name}>
            <button
              className={`sidebar-item ${
                activeItem === item.name ? "active" : ""
              }`}
              onClick={() => setActiveItem(item.name)}
            >
              <span className="sidebar-icon">{item.icon}</span>
              <span className="sidebar-text">{item.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
};

export default SellerSidebar;