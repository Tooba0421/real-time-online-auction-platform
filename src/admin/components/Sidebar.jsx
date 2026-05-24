import { NavLink, useNavigate } from "react-router-dom";
import {
  FaTachometerAlt, FaUsers, FaStore, FaUserCheck,
  FaBoxOpen, FaGavel, FaTruck, FaMoneyBillWave, FaBars,
} from "react-icons/fa";
import "../styles/adminDashboard.css";

const sidebarItems = [
  { name: "Dashboard Overview",         path: "/admin",          icon: <FaTachometerAlt />, end: true },
  { name: "User Management",            path: "/admin/users",    icon: <FaUsers /> },
  { name: "Seller Management",          path: "/admin/sellers",  icon: <FaStore /> },
  { name: "Bidder Management",          path: "/admin/bidders",  icon: <FaUserCheck /> },
  { name: "Products & Listings",        path: "/admin/products", icon: <FaBoxOpen /> },
  { name: "Auctions & Bid Monitoring",  path: "/admin/auctions", icon: <FaGavel /> },
  { name: "Order & Delivery",           path: "/admin/orders",   icon: <FaTruck /> },
  { name: "Revenue Payouts",            path: "/admin/revenue",  icon: <FaMoneyBillWave /> },
];

const Sidebar = ({ activeItem, isCollapsed, setIsCollapsed, isMobile }) => {
  return (
    <aside
      className={`sidebar
        ${isMobile ? "mobile-mode" : ""}
        ${!isMobile && isCollapsed ? "collapsed" : ""}
        ${isMobile && isCollapsed ? "open" : ""}
      `}
    >
      {/* Desktop title */}
      <h3 className="sidebar-title desktop-title">AUCTION ADMIN</h3>

      {/* Mobile toggle */}
      <div className={`sidebar-header mobile-toggle ${isCollapsed ? "expanded" : ""}`}>
        <FaBars
          className="sidebar-toggle"
          onClick={() => setIsCollapsed(!isCollapsed)}
        />
        {isCollapsed && <span className="mobile-title-text">AUCTION ADMIN</span>}
      </div>

      <ul className="nav flex-column gap-2">
        {sidebarItems.map((item) => (
          <li key={item.name}>
            <NavLink
              to={item.path}
              end={item.end}
              className={({ isActive }) =>
                `sidebar-item ${isActive ? "active" : ""}`
              }
            >
              <span className="sidebar-icon">{item.icon}</span>
              <span className="sidebar-text">{item.name}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </aside>
  );
};

export default Sidebar;