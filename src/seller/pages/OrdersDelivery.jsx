import { useState, useMemo } from "react";
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { supabase } from "../../supabase/supabase";
import { useSellerContext } from "../../context/SellerContext";
import toast from "react-hot-toast";
import StatCard from "../../common/components/StatCard";
import StatusBadge from "../../common/components/StatusBadge";
import ActionButton from "../../common/components/ActionButton";
import "../styles/sellerLayout.css";
import "../styles/orderDelivery.css";

ChartJS.register(ArcElement, Tooltip, Legend);

const OrdersDelivery = () => {
  const { orders, ordersLoading, updateOrderDeliveryLocally, refetchOrders } =
    useSellerContext();

  const [processing,    setProcessing]    = useState(null);
  const [search,        setSearch]        = useState("");
  const [deliveryFilter, setDeliveryFilter] = useState("all"); // filter for deliveries table

  // Tracking number modal
  const [trackingModal, setTrackingModal] = useState(null);
  const [trackingNo,    setTrackingNo]    = useState("");
  const [submitting,    setSubmitting]    = useState(false);

  // Helper — get buyer's user_id (profiles.id) from buyers table
  const getBuyerUserId = async (buyerId) => {
    const { data } = await supabase
      .from("buyers")
      .select("user_id")
      .eq("id", buyerId)
      .single();
    return data?.user_id || null;
  };

  // ── Split orders into two groups ──────────────────────────────────
  // pendingOrders  → no delivery record yet OR delivery status = 'pending'
  // shippedOrders  → delivery status = 'shipped' or 'delivered'
  // NOTE: 'in_transit' is removed from this system
  const pendingOrders = useMemo(() =>
    orders.filter((o) => {
      const status = o.deliveries?.status;
      return !status || status === "pending";
    }),
    [orders]
  );

  const shippedOrders = useMemo(() =>
    orders.filter((o) => {
      const status = o.deliveries?.status;
      return status === "shipped" || status === "delivered";
    }),
    [orders]
  );

  // ── Search + filter for pending orders table ──────────────────────
  const filteredPending = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return pendingOrders;
    return pendingOrders.filter((o) =>
      o.auctions?.products?.title?.toLowerCase().includes(q) ||
      o.buyers?.profiles?.name?.toLowerCase().includes(q)   ||
      o.id.toLowerCase().includes(q)
    );
  }, [pendingOrders, search]);

  // ── Search + filter for deliveries table ─────────────────────────
  const filteredShipped = useMemo(() => {
    const q = search.trim().toLowerCase();
    return shippedOrders.filter((o) => {
      const matchesSearch =
        !q ||
        o.auctions?.products?.title?.toLowerCase().includes(q) ||
        o.buyers?.profiles?.name?.toLowerCase().includes(q)    ||
        o.deliveries?.tracking_no?.toLowerCase().includes(q)   ||
        o.id.toLowerCase().includes(q);

      const matchesFilter =
        deliveryFilter === "all" ||
        o.deliveries?.status === deliveryFilter;

      return matchesSearch && matchesFilter;
    });
  }, [shippedOrders, search, deliveryFilter]);

  // ── Submit tracking number ────────────────────────────────────────
  // When seller enters tracking number:
  //   → delivery record created with status = 'shipped'
  //   → order moves from "Pending" table to "Deliveries" table
  //   → buyer gets notification
  const handleSubmitTracking = async () => {
    if (!trackingNo.trim()) {
      toast.error("Please enter a tracking number");
      return;
    }

    try {
      setSubmitting(true);
      const delivery = trackingModal.deliveries;

      if (delivery?.id) {
        // Update existing delivery record
        const { error } = await supabase
          .from("deliveries")
          .update({
            status:          "shipped",
            tracking_no:     trackingNo.trim(),
            courier_service: "TCS",
          })
          .eq("id", delivery.id);

        if (error) { toast.error("Error updating delivery"); return; }

        updateOrderDeliveryLocally(trackingModal.id, {
          status:          "shipped",
          tracking_no:     trackingNo.trim(),
          courier_service: "TCS",
        });

      } else {
        // Create new delivery record
        const { data: newDelivery, error } = await supabase
          .from("deliveries")
          .insert({
            order_id:        trackingModal.id,
            buyer_id:        trackingModal.buyer_id,
            seller_id:       trackingModal.seller_id,
            status:          "shipped",
            tracking_no:     trackingNo.trim(),
            courier_service: "TCS",
          })
          .select()
          .single();

        if (error) { toast.error("Error creating delivery"); return; }

        updateOrderDeliveryLocally(trackingModal.id, {
          id:              newDelivery.id,
          status:          "shipped",
          tracking_no:     trackingNo.trim(),
          courier_service: "TCS",
        });
      }

      // Notify buyer that order is shipped
      const buyerUserId = await getBuyerUserId(trackingModal.buyer_id);
      if (buyerUserId) {
        await supabase.from("notifications").insert({
          user_id:          buyerUserId,
          title:            "Your Order Has Been Shipped! 📦",
          message:          `Your order for "${trackingModal.auctions?.products?.title}" has been shipped via TCS. Tracking No: ${trackingNo.trim()}. You will be notified once delivered.`,
          type:             "delivery",
          notification_for: "buyer",
          is_read:          false,
        });
      }

      toast.success("Tracking number saved. Order is now shipped!");
      setTrackingModal(null);
      setTrackingNo("");

    } catch (err) {
      console.error(err);
      toast.error("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Stats ─────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total:     orders.length,
    pending:   pendingOrders.length,
    shipped:   orders.filter((o) => o.deliveries?.status === "shipped").length,
    delivered: orders.filter((o) => o.deliveries?.status === "delivered").length,
  }), [orders, pendingOrders]);

  const statsData = [
    { title: "Total Orders",     value: ordersLoading ? "..." : stats.total,     subtitle: "All auction sales"    },
    { title: "Pending Shipment", value: ordersLoading ? "..." : stats.pending,   subtitle: "Need to book courier" },
    { title: "Shipped",          value: ordersLoading ? "..." : stats.shipped,   subtitle: "Awaiting delivery"    },
    { title: "Delivered",        value: ordersLoading ? "..." : stats.delivered, subtitle: "Completed orders"     },
  ];

  const deliveryChartData = useMemo(() => ({
    labels: ["Pending Shipment", "Shipped", "Delivered"],
    datasets: [{
      data: [stats.pending, stats.shipped, stats.delivered],
      backgroundColor: ["#facc15", "#3b82f6", "#22c55e"],
    }],
  }), [stats]);

  const doughnutOptions = {
    responsive: true, maintainAspectRatio: false, cutout: "0%",
    layout: { padding: { top: 10, bottom: 30 } },
    plugins: { legend: { position: "top", align: "center", labels: { boxWidth: 30, padding: 15 } } },
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-PK", {
      year: "numeric", month: "short", day: "numeric",
    });
  };

  return (
    <div className="seller-page">

      {/* STAT CARDS */}
      <div className="stats-grid">
        {statsData.map((item, index) => (
          <StatCard key={index} title={item.title} value={item.value} subtitle={item.subtitle} />
        ))}
      </div>

      {/* ── SEARCH BAR — shared across both tables ─────────────────── */}
      <div className="page-controls" style={{ marginBottom: "1rem" }}>
        <input
          type="text"
          placeholder="Search by product, buyer name or order ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* ── TABLE 1: ORDERS AWAITING SHIPMENT ─────────────────────── */}
      <div className="seller-section">
        <h3 className="seller-section-heading">Orders Awaiting Shipment</h3>

        {ordersLoading ? (
          <div className="loading-state">Loading orders...</div>
        ) : filteredPending.length === 0 ? (
          <div className="no-data-box">
            <p className="no-data-text">
              {search
                ? "No matching orders found."
                : "No pending orders. All orders have been shipped! ✅"
              }
            </p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="seller-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Buyer Name</th>
                  <th>Phone</th>
                  <th>Address</th>
                  <th>City</th>
                  <th>Postal Code</th>
                  <th>Amount</th>
                  <th>Order Date</th>
                  <th>Payment</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredPending.map((o) => (
                  <tr key={o.id}>
                    <td>{o.auctions?.products?.title || "—"}</td>
                    <td>{o.buyers?.profiles?.name    || "—"}</td>
                    <td>{o.buyers?.phone_no          || "—"}</td>
                    <td>
                      <span title={o.buyers?.address || ""}>
                        {o.buyers?.address
                          ? o.buyers.address.length > 25
                            ? o.buyers.address.slice(0, 25) + "..."
                            : o.buyers.address
                          : "—"
                        }
                      </span>
                    </td>
                    <td>{o.buyers?.city        || "—"}</td>
                    <td>{o.buyers?.postal_code || "—"}</td>
                    <td>PKR {o.total_amount?.toLocaleString() || "—"}</td>
                    <td>{formatDate(o.order_date)}</td>
                    <td>
                      <StatusBadge
                        label={o.payments?.status || "pending"}
                        type={o.payments?.status  || "pending"}
                      />
                    </td>
                    <td className="actions">
                      <ActionButton
                        label="Enter Tracking No"
                        variant="secondary"
                        onClick={() => { setTrackingModal(o); setTrackingNo(""); }}
                        disabled={processing === o.id}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── TABLE 2: DELIVERIES ───────────────────────────────────── */}
      <div className="seller-section">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <h3 className="seller-section-heading" style={{ margin: 0 }}>Deliveries</h3>

          {/* Filter dropdown for deliveries table */}
          <select
            value={deliveryFilter}
            onChange={(e) => setDeliveryFilter(e.target.value)}
            style={{
              padding: "8px 12px", borderRadius: "8px",
              border: "1px solid #e0e0e0", fontSize: "13px",
              background: "#fff", cursor: "pointer",
            }}
          >
            <option value="all">All Deliveries</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
          </select>
        </div>

        {ordersLoading ? (
          <div className="loading-state">Loading deliveries...</div>
        ) : filteredShipped.length === 0 ? (
          <div className="no-data-box">
            <p className="no-data-text">
              {search || deliveryFilter !== "all"
                ? "No matching deliveries found."
                : "No shipments yet. Enter a tracking number to ship an order."
              }
            </p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="seller-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Buyer</th>
                  <th>City</th>
                  <th>Amount</th>
                  <th>Courier</th>
                  <th>Tracking No</th>
                  <th>Delivery Status</th>
                  <th>Order Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredShipped.map((o) => {
                  const deliveryStatus = o.deliveries?.status || "shipped";
                  return (
                    <tr key={o.id}>
                      <td>{o.auctions?.products?.title || "—"}</td>
                      <td>{o.buyers?.profiles?.name    || "—"}</td>
                      <td>{o.buyers?.city              || "—"}</td>
                      <td>PKR {o.total_amount?.toLocaleString() || "—"}</td>
                      <td>{o.deliveries?.courier_service || "TCS"}</td>
                      <td>
                        <span style={{
                          fontFamily: "monospace", fontSize: "13px",
                          fontWeight: "600", color: "#3b82f6",
                        }}>
                          {o.deliveries?.tracking_no || "—"}
                        </span>
                      </td>
                      <td>
                        <StatusBadge
                          label={deliveryStatus === "delivered" ? "Delivered" : "Shipped"}
                          type={deliveryStatus}
                        />
                      </td>
                      <td>{formatDate(o.order_date)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CHART */}
      <div className="overview-grid chart-space">
        <div className="chart-box">
          <h3 className="seller-section-heading">Delivery Status Overview</h3>
          <div className="chart-container">
            <Doughnut data={deliveryChartData} options={doughnutOptions} />
          </div>
        </div>
      </div>

      {/* ── TRACKING NUMBER MODAL ─────────────────────────────────── */}
      {trackingModal && (
        <div className="modal-overlay" onClick={() => setTrackingModal(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3>Enter TCS Tracking Number</h3>
            <p className="modal-subtitle">
              Book your shipment with TCS first, then enter the tracking number below.
            </p>

            {/* Buyer delivery info */}
            <div className="shipping-info">
              <p><strong>Product:</strong>      {trackingModal.auctions?.products?.title || "—"}</p>
              <p><strong>Buyer:</strong>         {trackingModal.buyers?.profiles?.name   || "—"}</p>
              <p><strong>Phone:</strong>          {trackingModal.buyers?.phone_no         || "—"}</p>
              <p><strong>Address:</strong>        {trackingModal.buyers?.address          || "—"}</p>
              <p><strong>City:</strong>           {trackingModal.buyers?.city             || "—"}</p>
              <p><strong>Postal Code:</strong>    {trackingModal.buyers?.postal_code      || "—"}</p>
              <p><strong>Order Amount:</strong>   PKR {trackingModal.total_amount?.toLocaleString() || "—"}</p>
            </div>

            <input
              type="text"
              className="form-input"
              placeholder="e.g. TCS-123456789"
              value={trackingNo}
              onChange={(e) => setTrackingNo(e.target.value)}
              style={{ marginTop: "1rem", width: "100%", boxSizing: "border-box" }}
            />

            <div className="modal-actions" style={{ marginTop: "1rem" }}>
              <button
                className="btn-secondary"
                onClick={() => setTrackingModal(null)}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                className="create-btn"
                onClick={handleSubmitTracking}
                disabled={submitting}
              >
                {submitting ? "Saving..." : "Confirm Shipment"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default OrdersDelivery;