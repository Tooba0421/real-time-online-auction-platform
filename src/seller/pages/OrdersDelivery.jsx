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

  const [processing, setProcessing] = useState(null);
  const [search, setSearch]         = useState("");

  // Tracking number modal
  const [trackingModal, setTrackingModal] = useState(null);
  const [trackingNo,    setTrackingNo]    = useState("");
  const [submitting,    setSubmitting]    = useState(false);

  // Helper — get buyer's profile user_id from buyers table
  const getBuyerUserId = async (buyerId) => {
    const { data } = await supabase
      .from("buyers")
      .select("user_id")
      .eq("id", buyerId)
      .single();
    return data?.user_id || null;
  };

  // ── Split orders into two groups ──────────────────────────────────
  // pendingOrders  → no delivery record yet, or delivery status = 'pending'
  // shippedOrders  → delivery status = 'shipped', 'in_transit', 'delivered'
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
      return status && status !== "pending";
    }),
    [orders]
  );

  // ── Search filters ────────────────────────────────────────────────
  const filteredPending = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return pendingOrders;
    return pendingOrders.filter((o) =>
      o.auctions?.products?.title?.toLowerCase().includes(q) ||
      o.buyers?.profiles?.name?.toLowerCase().includes(q) ||
      o.id.toLowerCase().includes(q)
    );
  }, [pendingOrders, search]);

  const filteredShipped = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return shippedOrders;
    return shippedOrders.filter((o) =>
      o.auctions?.products?.title?.toLowerCase().includes(q) ||
      o.buyers?.profiles?.name?.toLowerCase().includes(q) ||
      o.deliveries?.tracking_no?.toLowerCase().includes(q) ||
      o.id.toLowerCase().includes(q)
    );
  }, [shippedOrders, search]);

  // ── Submit tracking number → order moves to delivery table ────────
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

      // Notify buyer
      const buyerUserId = await getBuyerUserId(trackingModal.buyer_id);
      if (buyerUserId) {
        await supabase.from("notifications").insert({
          user_id:          buyerUserId,
          title:            "Your Order Has Been Shipped! 📦",
          message:          `Your order for "${trackingModal.auctions?.products?.title}" has been shipped via TCS. Tracking No: ${trackingNo.trim()}`,
          type:             "delivery",
          notification_for: "buyer",
          is_read:          false,
        });
      }

      toast.success("Order marked as shipped! It moved to the Deliveries table.");
      setTrackingModal(null);
      setTrackingNo("");

    } catch (err) {
      console.error(err);
      toast.error("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Mark in transit ───────────────────────────────────────────────
  const handleMarkInTransit = async (order) => {
    try {
      setProcessing(order.id);

      const { error } = await supabase
        .from("deliveries")
        .update({ status: "in_transit" })
        .eq("id", order.deliveries?.id);

      if (error) { toast.error("Error updating delivery status"); return; }

      updateOrderDeliveryLocally(order.id, { status: "in_transit" });

      const buyerUserId = await getBuyerUserId(order.buyer_id);
      if (buyerUserId) {
        await supabase.from("notifications").insert({
          user_id:          buyerUserId,
          title:            "Your Order is In Transit 🚚",
          message:          `Your order for "${order.auctions?.products?.title}" is now in transit via TCS. Expected delivery soon.`,
          type:             "delivery",
          notification_for: "buyer",
          is_read:          false,
        });
      }

      toast.success("Status updated to In Transit");
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong");
      refetchOrders();
    } finally {
      setProcessing(null);
    }
  };

  // ── Stats ─────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total:     orders.length,
    pending:   pendingOrders.length,
    shipped:   orders.filter((o) => o.deliveries?.status === "shipped").length,
    inTransit: orders.filter((o) => o.deliveries?.status === "in_transit").length,
    delivered: orders.filter((o) => o.deliveries?.status === "delivered").length,
  }), [orders, pendingOrders]);

  const statsData = [
    { title: "Total Orders",     value: ordersLoading ? "..." : stats.total,     subtitle: "All auction sales" },
    { title: "Pending Shipment", value: ordersLoading ? "..." : stats.pending,   subtitle: "Need to book courier" },
    { title: "In Transit",       value: ordersLoading ? "..." : stats.inTransit, subtitle: "On the way to buyer" },
    { title: "Delivered",        value: ordersLoading ? "..." : stats.delivered, subtitle: "Completed orders" },
  ];

  const deliveryChartData = useMemo(() => ({
    labels: ["Pending", "Shipped", "In Transit", "Delivered"],
    datasets: [{
      data: [stats.pending, stats.shipped, stats.inTransit, stats.delivered],
      backgroundColor: ["#facc15", "#3b82f6", "#8b5cf6", "#22c55e"],
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

      {/* SEARCH — shared across both tables */}
      <div className="page-controls">
        <input
          type="text"
          placeholder="Search by product, buyer or order ID"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input"
        />
      </div>

      {/* ── ORDERS TABLE — pending shipment ── */}
      <div className="seller-section">
        <h3 className="seller-section-heading">
          Orders Awaiting Shipment
        </h3>

        {ordersLoading ? (
          <div className="loading-state">Loading orders...</div>
        ) : filteredPending.length === 0 ? (
          <div className="no-data-box">
            <p className="no-data-text">
              {search ? "No matching orders found." : "No pending orders. All orders have been shipped! ✅"}
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
                  <th>Order Date</th>
                  <th>Payment</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredPending.map((o) => (
                  <tr key={o.id}>
                    <td>{o.auctions?.products?.title || "—"}</td>
                    <td>{o.buyers?.profiles?.name || "—"}</td>
                    <td>{o.buyers?.phone_no || "—"}</td>
                    <td className="address-cell">
                      <span title={o.buyers?.address || ""}>
                        {o.buyers?.address
                          ? o.buyers.address.length > 25
                            ? o.buyers.address.slice(0, 25) + "..."
                            : o.buyers.address
                          : "—"}
                      </span>
                    </td>
                    <td>{o.buyers?.city || "—"}</td>
                    <td>{o.buyers?.postal_code || "—"}</td>
                    <td>{formatDate(o.order_date)}</td>
                    <td className="status-cell">
                      <StatusBadge
                        label={o.payments?.status || "pending"}
                        type={o.payments?.status  || "pending"}
                      />
                    </td>
                    <td className="actions-cell">
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

      {/* ── DELIVERIES TABLE — shipped / in transit / delivered ── */}
      <div className="seller-section">
        <h3 className="seller-section-heading">Deliveries</h3>

        {ordersLoading ? (
          <div className="loading-state">Loading deliveries...</div>
        ) : filteredShipped.length === 0 ? (
          <div className="no-data-box">
            <p className="no-data-text">
              {search ? "No matching deliveries found." : "No shipments yet. Ship an order to see it here."}
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
                  <th>Courier</th>
                  <th>Tracking No</th>
                  <th>Delivery Status</th>
                  <th>Shipped Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredShipped.map((o) => {
                  const deliveryStatus = o.deliveries?.status || "shipped";
                  return (
                    <tr key={o.id}>
                      <td>{o.auctions?.products?.title || "—"}</td>
                      <td>{o.buyers?.profiles?.name || "—"}</td>
                      <td>{o.buyers?.city || "—"}</td>
                      <td>{o.deliveries?.courier_service || "TCS"}</td>
                      <td className="tracking-cell">
                        <span className="tracking-number">
                          {o.deliveries?.tracking_no || "—"}
                        </span>
                      </td>
                      <td className="status-cell">
                        <StatusBadge
                          label={
                            deliveryStatus === "in_transit" ? "In Transit"
                            : deliveryStatus === "delivered" ? "Delivered"
                            : "Shipped"
                          }
                          type={deliveryStatus}
                        />
                      </td>
                      <td>{formatDate(o.deliveries?.created_at || o.order_date)}</td>
                      <td className="actions-cell">
                        {deliveryStatus === "shipped" && (
                          <ActionButton
                            label="Mark In Transit"
                            variant="secondary"
                            onClick={() => handleMarkInTransit(o)}
                            disabled={processing === o.id}
                          />
                        )}
                        {deliveryStatus === "in_transit" && (
                          <span className="in-transit-text">
                            In Transit
                          </span>
                        )}
                        {deliveryStatus === "delivered" && (
                          <span className="delivered-text">
                            Delivered
                          </span>
                        )}
                      </td>
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

      {/* TRACKING NUMBER MODAL */}
      {trackingModal && (
        <div className="modal-overlay" onClick={() => setTrackingModal(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3>Enter TCS Tracking Number</h3>
            <p className="modal-subtitle">
              Book your shipment with TCS first, then enter the tracking number below.
              Once confirmed, this order moves to the Deliveries table.
            </p>

            <div className="shipping-info">
              <p><strong>Product:</strong> {trackingModal.auctions?.products?.title}</p>
              <p><strong>Buyer:</strong> {trackingModal.buyers?.profiles?.name || "—"}</p>
              <p><strong>Phone:</strong> {trackingModal.buyers?.phone_no || "—"}</p>
              <p><strong>Address:</strong> {trackingModal.buyers?.address || "—"}</p>
              <p><strong>City:</strong> {trackingModal.buyers?.city || "—"}</p>
              <p><strong>Postal Code:</strong> {trackingModal.buyers?.postal_code || "—"}</p>
            </div>

            <input
              type="text"
              className="form-input tracking-input"
              placeholder="e.g. TCS-123456789"
              value={trackingNo}
              onChange={(e) => setTrackingNo(e.target.value)}
            />

            <div className="modal-actions">
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
                {submitting ? "Submitting..." : "Confirm Shipment"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default OrdersDelivery;