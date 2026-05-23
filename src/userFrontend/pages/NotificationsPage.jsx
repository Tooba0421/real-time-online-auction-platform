import { useNavigate } from "react-router-dom";
import { useLayoutEffect, useEffect, useState } from "react";
import { FaArrowLeft, FaBell, FaGavel, FaTrophy, FaTruck,
         FaCheckCircle, FaTimesCircle, FaShieldAlt, FaMoneyBillWave } from "react-icons/fa";
import { supabase } from "../../supabase/supabase";
import { useAuthContext } from "../../context/AuthContext";
import Header from "../components/Header";
import Footer from "../components/Footer";
import "../styles/common.css";
import "../styles/notifications.css";

// Icon and color per notification type
const getNotifStyle = (type) => {
  switch (type) {
    case "bid":
      return { icon: <FaGavel />, color: "#3b82f6", bg: "#eff6ff" };
    case "outbid":
      return { icon: <FaTimesCircle />, color: "#ef4444", bg: "#fef2f2" };
    case "auction_won":
      return { icon: <FaTrophy />, color: "#f59e0b", bg: "#fffbeb" };
    case "auction_ended":
      return { icon: <FaBell />, color: "#6b7280", bg: "#f9fafb" };
    case "payment":
      return { icon: <FaMoneyBillWave />, color: "#10b981", bg: "#ecfdf5" };
    case "delivery":
      return { icon: <FaTruck />, color: "#8b5cf6", bg: "#f5f3ff" };
    case "approval":
      return { icon: <FaShieldAlt />, color: "#D4AF37", bg: "#fefce8" };
    default:
      return { icon: <FaBell />, color: "#6b7280", bg: "#f9fafb" };
  }
};

const formatTime = (dateStr) => {
  if (!dateStr) return "";
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now - date) / 1000);

  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  if (diff < 172800) return "Yesterday";
  return date.toLocaleDateString("en-PK", {
    month: "short", day: "numeric", year: "numeric",
  });
};

const NotificationsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuthContext();

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchNotifications();
  }, [user]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) { console.error(error); return; }

      setNotifications(data || []);

      // Mark all unread as read when page opens
      const unreadIds = (data || [])
        .filter((n) => !n.is_read)
        .map((n) => n.id);

      if (unreadIds.length > 0) {
        await supabase
          .from("notifications")
          .update({ is_read: true })
          .in("id", unreadIds);

        // Update local state so badge clears immediately
        setNotifications((prev) =>
          prev.map((n) => ({ ...n, is_read: true }))
        );
      }

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Mark a single notification as read
  const markOneRead = async (notif) => {
    if (notif.is_read) return;
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notif.id);
    setNotifications((prev) =>
      prev.map((n) => n.id === notif.id ? { ...n, is_read: true } : n)
    );
  };

  // Mark all as read manually
  const markAllRead = async () => {
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
    if (unreadIds.length === 0) return;

    await supabase
      .from("notifications")
      .update({ is_read: true })
      .in("id", unreadIds);

    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <>
      <Header />

      <div className="notifications">

          {/* Header row */}
          <div className="page-header">
            <button
              className="back-btn"
              onClick={() => {
                if (window.history.length > 1) navigate(-1);
                else navigate("/");
              }}
            >
              <FaArrowLeft />
            </button>
            <h2 className="page-heading">Notifications</h2>

            {unreadCount > 0 && (
                <button
                className="mark-all-read-btn"
                onClick={markAllRead}
              >
                Mark all as read
              </button>
            )}
          </div>
        <div className="notifications-container">

          {/* Content */}
          {!user ? (
            <div className="notif-empty">
              <FaBell size={40} color="#ccc" />
              <p>Please log in to view notifications.</p>
            </div>
          ) : loading ? (
            <div className="notif-empty">
              <p>Loading notifications...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="notif-empty">
              <FaBell size={40} color="#ccc" />
              <p>No notifications yet.</p>
            </div>
          ) : (
            <div className="notifications-list">
              {notifications.map((n) => {
                const style = getNotifStyle(n.type);
                return (
                  <div
                    key={n.id}
                    className={`notification-item ${n.is_read ? "read" : "unread"}`}
                    onClick={() => markOneRead(n)}
                    style={{ borderLeft: `4px solid ${style.color}` }}
                  >
                    {/* Unread dot */}
                    {!n.is_read && <span className="unread-dot" />}

                    {/* Icon */}
                    <div
                      className="notif-icon"
                      style={{ color: style.color, background: style.bg }}
                    >
                      {style.icon}
                    </div>

                    {/* Text */}
                    <div className="notification-text">
                      <p className="notif-title">{n.title}</p>
                      <p className="notif-message">{n.message}</p>
                      <span className="notif-time">{formatTime(n.created_at)}</span>
                    </div>

                  </div>
                );
              })}
            </div>
          )}

        </div>
      </div>

      <Footer />
    </>
  );
};

export default NotificationsPage;