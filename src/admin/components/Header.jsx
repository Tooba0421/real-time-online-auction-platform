import { FaBell } from "react-icons/fa";
import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabase/supabase";
import { useAuthContext } from "../../context/AuthContext";
import "../styles/adminDashboard.css";

const Header = ({ title }) => {
  const navigate = useNavigate();
  const { user, profile } = useAuthContext();
  const [unreadCount, setUnreadCount] = useState(0);
  const channelRef = useRef(null);

  const fetchUnreadCount = async () => {
    if (!user) return;
    const { count } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_read", false);
    setUnreadCount(count || 0);
  };

  useEffect(() => {
    if (!user) return;

    fetchUnreadCount();

    // ✅ Fix: store channel in ref so we can properly remove it on cleanup.
    // The original code called subscription.unsubscribe() which doesn't exist
    // on Supabase realtime channels — the correct API is supabase.removeChannel().
    channelRef.current = supabase
      .channel(`admin-header-notifications-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => fetchUnreadCount()
      )
      .subscribe();

    return () => {
      if (channelRef.current) {
        try { supabase.removeChannel(channelRef.current); } catch (_) {}
        channelRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const getInitial = () => {
    const name = profile?.name || user?.email || "A";
    return name.charAt(0).toUpperCase();
  };

  return (
    <nav className="header">
      <div className="header-left">
        <h1 className="header-title">{title}</h1>
      </div>

      <div className="header-right">
        {/* Notification Bell */}
        <div
          className="header-notification"
          onClick={() => navigate("/notifications")}
          style={{ cursor: "pointer" }}
        >
          <FaBell className="bell" />
          {unreadCount > 0 && (
            <span className="notification-badge">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </div>

        {/* Profile */}
        <div
          className="header-profile"
          onClick={() => navigate("/profile")}
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
