import { useNavigate, useLocation } from "react-router-dom";
import {
  FaTachometerAlt, FaUsers, FaStore, FaUserCheck,
  FaBoxOpen, FaGavel, FaTruck, FaMoneyBillWave, FaBars,
} from "react-icons/fa";
import "../styles/adminDashboard.css";

const sidebarItems = [
  { name: "Dashboard Overview",        path: "/admin",          icon: <FaTachometerAlt /> },
  { name: "User Management",           path: "/admin/users",    icon: <FaUsers /> },
  { name: "Seller Management",         path: "/admin/sellers",  icon: <FaStore /> },
  { name: "Bidder Management",         path: "/admin/bidders",  icon: <FaUserCheck /> },
  { name: "Products & Listings",       path: "/admin/products", icon: <FaBoxOpen /> },
  { name: "Auctions & Bid Monitoring", path: "/admin/auctions", icon: <FaGavel /> },
  { name: "Order & Delivery",          path: "/admin/orders",   icon: <FaTruck /> },
  { name: "Revenue Payouts",           path: "/admin/revenue",  icon: <FaMoneyBillWave /> },
];

const Sidebar = ({ isCollapsed, setIsCollapsed, isMobile }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  return (
    <aside
      className={`seller-sidebar
        ${isMobile ? "mobile-mode" : ""}
        ${!isMobile && isCollapsed ? "collapsed" : ""}
        ${isMobile && isCollapsed ? "open" : ""}
      `}
    >
      {/* Desktop Title */}
      <h3 className="sidebar-title desktop-title">AUCTION ADMIN</h3>

      {/* Mobile Toggle */}
      <div className={`sidebar-header mobile-toggle ${isCollapsed ? "expanded" : ""}`}>
        <FaBars
          className="sidebar-toggle"
          onClick={() => setIsCollapsed(!isCollapsed)}
        />
        {isCollapsed && (
          <span className="mobile-title-text">AUCTION ADMIN</span>
        )}
      </div>

      <ul className="nav d-flex flex-column gap-2">
        {sidebarItems.map((item) => (
          <li key={item.name}>
            <button
              className={`sidebar-item ${isActive(item.path) ? "active" : ""}`}
              onClick={() => {
                navigate(item.path);
                if (window.innerWidth <= 768) setIsCollapsed(false);
              }}
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