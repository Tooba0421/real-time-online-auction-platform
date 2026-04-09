import { FaBell } from "react-icons/fa";
import "../styles/adminDashboard.css";

const Header = ({ title }) => {
  return (
    <nav className="header">
      <div className="header-left">
        <h1 className="header-title">{title}</h1>
      </div>

      <div className="header-right">
        <div className="header-notification">
          <FaBell className="bell" />
          <span className="notification-badge">3</span>
        </div>

        <div className="header-profile">
          <img
            src="https://i.pravatar.cc/40"
            alt="Admin Avatar"
            className="profile-avatar"
          />
          <span className="profile-name">Admin</span>
        </div>
      </div>
    </nav>
  );
};

export default Header;