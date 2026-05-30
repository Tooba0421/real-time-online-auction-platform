import { useNavigate } from "react-router-dom";
import { useLayoutEffect, useEffect, useState } from "react";
import {
  FaArrowLeft, FaBell, FaGavel, FaTrophy, FaTruck,
  FaTimesCircle, FaShieldAlt, FaMoneyBillWave,
} from "react-icons/fa";
import { supabase } from "../../supabase/supabase";
import { useAuthContext } from "../../context/AuthContext";
import Header from "../components/Header";
import Footer from "../components/Footer";
import "../styles/common.css";
import "../styles/notifications.css";

const toSlug = (title) =>
  title?.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "";

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

// Determine where a notification should navigate to when clicked
const getNotifDestination = async (notif) => {
  const { type, auction_id, product_slug } = notif;

  // If the notification has a product_slug stored, use it directly
  if (product_slug) {
    return `/auction/${product_slug}`;
  }

  // If the notification has an auction_id, resolve the slug
  if (auction_id) {
    const { data } = await supabase
      .from("auctions")
      .select(`products ( title )`)
      .eq("id", auction_id)
      .single();

    if (data?.products?.title) {
      return `/auction/${toSlug(data.products.title)}`;
    }
  }

  return null;
};

const NotificationsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuthContext();

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [navigating, setNavigating] = useState(null);

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

      if (error) { return; }

      setNotifications(data || []);

      // Mark all unread as read on open
      const unreadIds = (data || []).filter((n) => !n.is_read).map((n) => n.id);
      if (unreadIds.length > 0) {
        await supabase
          .from("notifications")
          .update({ is_read: true })
          .in("id", unreadIds);

        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      }
    } catch (err) {
    } finally {
      setLoading(false);
    }
  };

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

  const markAllRead = async () => {
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .in("id", unreadIds);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  // Handle notification click — mark read then navigate if applicable
  const handleNotifClick = async (notif) => {
    await markOneRead(notif);

    // These types should navigate to the auction page
    const navigableTypes = ["auction_won", "outbid", "bid", "auction_ended", "payment", "delivery"];
    if (!navigableTypes.includes(notif.type)) return;

    try {
      setNavigating(notif.id);
      const destination = await getNotifDestination(notif);
      if (destination) {
        navigate(destination);
      }
    } catch (err) {
    } finally {
      setNavigating(null);
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  // Check if a notification is clickable (has navigation)
  const isClickable = (notif) => {
    const clickableTypes = ["auction_won", "outbid", "bid", "auction_ended", "payment", "delivery"];
    return clickableTypes.includes(notif.type) &&
      (notif.auction_id || notif.product_slug);
  };

  return (
    <>
      <Header />

      <div className="notifications">
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
            <button className="mark-all-read-btn" onClick={markAllRead}>
              Mark all as read
            </button>
          )}
        </div>

        <div className="notifications-container">
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
                const clickable = isClickable(n);
                const isLoading = navigating === n.id;

                return (
                  <div
                    key={n.id}
                    className={`notification-item ${n.is_read ? "read" : "unread"} ${clickable ? "clickable" : ""}`}
                    onClick={() => handleNotifClick(n)}
                    style={{
                      borderLeft: `4px solid ${style.color}`,
                      cursor: clickable ? "pointer" : "default",
                      opacity: isLoading ? 0.7 : 1,
                    }}
                  >
                    {!n.is_read && <span className="unread-dot" />}

                    <div
                      className="notif-icon"
                      style={{ color: style.color, background: style.bg }}
                    >
                      {style.icon}
                    </div>

                    <div className="notification-text">
                      <p className="notif-title">{n.title}</p>
                      <p className="notif-message">{n.message}</p>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "4px" }}>
                        <span className="notif-time">{formatTime(n.created_at)}</span>
                        {clickable && !isLoading && (
                          <span style={{
                            fontSize: "11px",
                            color: style.color,
                            fontWeight: "600",
                          }}>
                            → View Auction
                          </span>
                        )}
                        {isLoading && (
                          <span style={{ fontSize: "11px", color: "#999" }}>
                            Opening...
                          </span>
                        )}
                      </div>
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