import { FaBell } from "react-icons/fa";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabase/supabase";
import { useAuthContext } from "../../context/AuthContext";
import "../styles/adminDashboard.css";

const Header = ({ title }) => {
  const navigate = useNavigate();
  const { user, profile } = useAuthContext();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    fetchUnreadCount();

    // Real time notification count update
    const subscription = supabase
      .channel('admin-notifications')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, () => {
        fetchUnreadCount()
      })
      .subscribe()

    return () => subscription.unsubscribe()
  }, [user]);

  const fetchUnreadCount = async () => {
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false)

    setUnreadCount(count || 0)
  }

  const getInitial = () => {
    const name = profile?.name || user?.email || "S";
    return name.charAt(0).toUpperCase();
  };

  return (
    <nav className="header">
      <div className="header-left">
        <h1 className="header-title">{title}</h1>
      </div>

      <div className="header-right">

        {/* Real notification count */}
        <div className="header-notification">
          <FaBell className="bell" />
          {unreadCount > 0 && (
            <span className="notification-badge">{unreadCount}</span>
          )}
        </div>

        {/* Profile — navigates to UserFrontend ProfilePage */}
        <div
          className="header-profile"
          onClick={() => navigate('/profile')}
          style={{ cursor: "pointer" }}
        >
          <div className="profile-initial-avatar-small">
            {getInitial()}
          </div>
        </div>

      </div>
    </nav>
  );
};

export default Header;