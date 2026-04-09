import {
  FaTachometerAlt,
  FaUsers,
  FaStore,
  FaBoxOpen,
  FaGavel,
  FaTruck,
  FaMoneyBillWave,
  FaChartLine,
  FaBars,
} from "react-icons/fa";

import "../styles/adminDashboard.css";

const sidebarItems = [
  { name: "Dashboard Overview", icon: <FaTachometerAlt /> },
  { name: "User Management", icon: <FaUsers /> },
  { name: "Seller Management", icon: <FaStore /> },
  { name: "Products & Listings", icon: <FaBoxOpen /> },
  { name: "Auctions & Bid Monitoring", icon: <FaGavel /> },
  { name: "Order & Delivery", icon: <FaTruck /> },
  { name: "Revenue Payouts", icon: <FaMoneyBillWave /> },
];

const Sidebar = ({
  activeItem,
  setActiveItem,
  isCollapsed,
  setIsCollapsed,
  isMobile,
}) => {
  return (
    <aside
  className={`sidebar 
    ${isMobile ? "mobile-mode" : ""} 
    ${!isMobile && isCollapsed ? "collapsed" : ""} 
    ${isMobile && isCollapsed ? "open" : ""}
  `}
>

      {/* ===== Desktop Title (≥769px) ===== */}
      <h3 className="sidebar-title desktop-title">AUCTION ADMIN</h3>

      {/* ===== Mobile Toggle + Title (≤768px) ===== */}
      <div
        className={`sidebar-header mobile-toggle ${isCollapsed ? "expanded" : ""
          }`}
      >
        <FaBars
  className="sidebar-toggle"
  onClick={() => setIsCollapsed(!isCollapsed)}
/>
        {isCollapsed && <span className="mobile-title-text">AUCTION ADMIN</span>}
      </div>

      <ul className="nav flex-column gap-2">
        {sidebarItems.map((item) => (
          <li key={item.name}>
            <button
              className={`sidebar-item ${activeItem === item.name ? "active" : ""}`}
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

export default Sidebar;