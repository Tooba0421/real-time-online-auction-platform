import { FaBell } from "react-icons/fa";
import "../styles/sellerDashboard.css";

const SellerHeader = ({ title }) => {
  return (
    <nav className="seller-header">
      <div className="header-left">
        <h1 className="header-title">{title}</h1>
      </div>

      <div className="header-right">
        <div className="header-notification">
          <FaBell className="bell" />
          <span className="notification-badge">2</span>
        </div>

        <div className="header-profile">
          <img
            src="https://i.pravatar.cc/40?img=12"
            alt="Seller"
            className="profile-avatar"
          />
          <span className="profile-name">Seller</span>
        </div>
      </div>
    </nav>
  );
};

export default SellerHeader;