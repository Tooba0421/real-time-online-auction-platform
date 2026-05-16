import { useEffect, useState } from "react";
import { FaBell } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabase/supabase";
import { useAuthContext } from "../../context/AuthContext";
import "../styles/sellerDashboard.css";

const SellerHeader = ({ title }) => {
  const navigate = useNavigate();
  const { user, profile } = useAuthContext();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    fetchUnreadCount();

    // Realtime subscription for new notifications
    const subscription = supabase
      .channel('seller-notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, () => {
        fetchUnreadCount();
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, () => {
        fetchUnreadCount();
      })
      .subscribe();

    return () => subscription.unsubscribe();
  }, [user]);

  const fetchUnreadCount = async () => {
    if (!user) return;

    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false);

    setUnreadCount(count || 0);
  };

  const getInitial = () => {
    const name = profile?.name || user?.email || "S";
    return name.charAt(0).toUpperCase();
  };

  return (
    <nav className="seller-header">
      <div className="header-left">
        <h1 className="header-title">{title}</h1>
      </div>

      <div className="header-right">

        {/* Notification Bell */}
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

export default SellerHeader;