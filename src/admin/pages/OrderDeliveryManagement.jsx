import { useState, useMemo } from "react";
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  PointElement, LineElement, ArcElement, Tooltip, Legend, Filler,
} from "chart.js";
import { Line, Doughnut } from "react-chartjs-2";
import { supabase } from "../../supabase/supabase";
import { useAdminContext } from "../../context/AdminContext";
import { useAuthContext } from "../../context/AuthContext";
import toast from "react-hot-toast";
import StatCard from "../../common/components/StatCard";
import StatusBadge from "../../common/components/StatusBadge";
import ActionButton from "../../common/components/ActionButton";
import "../styles/adminLayout.css";
import "../styles/orderDeliveryManagement.css";

ChartJS.register(
  CategoryScale, LinearScale, PointElement,
  LineElement, ArcElement, Tooltip, Legend, Filler
);

const OrderDeliveryManagement = () => {
  const { user } = useAuthContext();
  const { orders, ordersLoading, refetchOrders } = useAdminContext();

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [processing, setProcessing] = useState(null);

  // ── Helper to log admin actions ───────────────────────────────────
  const logAdminAction = async (actionType, targetId, targetTable, remarks) => {
    try {
      await supabase.from("admin_actions").insert({
        admin_id: user.id,
        action_type: actionType,
        target_id: targetId,
        target_table: targetTable,
        remarks: remarks,
      });
    } catch (err) {
      console.error("Admin action log error:", err);
    }
  };

  // ── Helper to update transaction status ───────────────────────────
  const updateTransactionStatus = async (paymentId, status) => {
    const { error } = await supabase
      .from("transactions")
      .update({
        status: status,
        release_date: status === "released" ? new Date().toISOString() : null,
      })
      .eq("payment_id", paymentId);
    
    if (error) console.error("Transaction update error:", error);
    return !error;
  };

  const formatDate = (d) =>
    !d ? "—" : new Date(d).toLocaleDateString("en-PK", {
      year: "numeric", month: "short", day: "numeric",
    });

  // ── Mark order as delivered (FIXED: Transaction rollback) ─────────
  const handleMarkDelivered = async (order) => {
    if (!window.confirm(
      `Confirm delivery for "${order.auctions?.products?.title}"?\n\n` +
      `This will mark the order as delivered and release payment to the seller.`
    )) return;

    // Store original states for rollback
    let originalDeliveryStatus = null;
    let originalDeliveryId = null;
    let transactionUpdated = false;

    try {
      setProcessing(order.id);

      // ── Step 1: Get original delivery state for rollback ──────────
      if (order.deliveries?.id) {
        originalDeliveryId = order.deliveries.id;
        originalDeliveryStatus = order.deliveries.status;
      }

      // ── Step 2: Update delivery status ────────────────────────────
      if (order.deliveries?.id) {
        const { error: deliveryError } = await supabase
          .from("deliveries")
          .update({
            status: "delivered",
            delivery_date: new Date().toISOString(),
          })
          .eq("id", order.deliveries.id);

        if (deliveryError) {
          toast.error("Error updating delivery status");
          console.error(deliveryError);
          return;
        }
      } else {
        // No delivery record yet — create one marked as delivered
        const { error: createError } = await supabase
          .from("deliveries")
          .insert({
            order_id: order.id,
            buyer_id: order.buyer_id,
            seller_id: order.seller_id,
            status: "delivered",
            courier_service: "TCS",
            delivery_date: new Date().toISOString(),
          });

        if (createError) {
          toast.error("Error creating delivery record");
          console.error(createError);
          return;
        }
      }

      // ── Step 3: Update order status ───────────────────────────────
      const { error: orderError } = await supabase
        .from("orders")
        .update({ order_status: "confirmed" })
        .eq("id", order.id);

      if (orderError) {
        // Rollback delivery update
        if (originalDeliveryId && originalDeliveryStatus) {
          await supabase
            .from("deliveries")
            .update({ status: originalDeliveryStatus, delivery_date: null })
            .eq("id", originalDeliveryId);
        }
        toast.error("Error updating order status");
        return;
      }

      // ── Step 4: Update product status to sold ─────────────────────
      if (order.auctions?.id) {
        const { data: auctionData } = await supabase
          .from("auctions")
          .select("product_id")
          .eq("id", order.auctions.id)
          .single();

        if (auctionData?.product_id) {
          const { error: productError } = await supabase
            .from("products")
            .update({ status: "sold" })
            .eq("id", auctionData.product_id);
          
          if (productError) console.error("Product update error:", productError);
        }
      }

      // ── Step 5: Release payment hold ──────────────────────────────
      if (order.payments?.id) {
        const { error: paymentError } = await supabase
          .from("payments")
          .update({ hold_status: false })
          .eq("id", order.payments.id);

        if (paymentError) {
          console.error("Payment release error:", paymentError);
        }
      }

      // ── Step 6: Release seller transaction ────────────────────────
      if (order.payments?.id) {
        const success = await updateTransactionStatus(order.payments.id, "released");
        if (success) transactionUpdated = true;
      }

      // ── Step 7: Log admin action ──────────────────────────────────
      await logAdminAction(
        "mark_delivered", 
        order.id, 
        "orders", 
        `Order marked as delivered by admin. Payment released to seller.`
      );

      // ── Step 8: Notify seller ─────────────────────────────────────
      const sellerUserId = order.sellers?.profiles?.id || order.sellers?.user_id;
      if (sellerUserId) {
        await supabase.from("notifications").insert({
          user_id: sellerUserId,
          title: "Payment Released! 💰",
          message: `The delivery of "${order.auctions?.products?.title}" has been confirmed by admin. Your payment has been released.`,
          type: "payment",
          notification_for: "seller",
          is_read: false,
        });
      }

      // ── Step 9: Notify buyer ──────────────────────────────────────
      const { data: buyerData } = await supabase
        .from("buyers")
        .select("user_id")
        .eq("id", order.buyer_id)
        .single();

      if (buyerData?.user_id) {
        await supabase.from("notifications").insert({
          user_id: buyerData.user_id,
          title: "Delivery Confirmed ✅",
          message: `Your delivery for "${order.auctions?.products?.title}" has been marked as delivered. Thank you for your purchase!`,
          type: "delivery",
          notification_for: "buyer",
          is_read: false,
        });
      }

      toast.success("Order marked as delivered and payment released to seller!");
      await refetchOrders();

    } catch (err) {
      console.error(err);
      
      // Attempt rollback if transaction was updated
      if (transactionUpdated && order.payments?.id) {
        await updateTransactionStatus(order.payments.id, "onhold");
      }
      
      toast.error("Something went wrong. Please try again.");
    } finally {
      setProcessing(null);
    }
  };

  // ── Filtered orders ───────────────────────────────────────────────
  const filteredOrders = useMemo(() => {
    const q = search.toLowerCase();
    return orders.filter((order) => {
      const matchesSearch =
        order.auctions?.products?.title?.toLowerCase().includes(q) ||
        order.buyers?.profiles?.name?.toLowerCase().includes(q) ||
        order.sellers?.profiles?.name?.toLowerCase().includes(q) ||
        order.id?.toLowerCase().includes(q);
      const deliveryStatus = order.deliveries?.status || "pending";
      const matchesStatus = filterStatus === "all" || deliveryStatus === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [orders, search, filterStatus]);

  // ── Stats ─────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total: orders.length,
    delivered: orders.filter((o) => o.deliveries?.status === "delivered").length,
    inTransit: orders.filter((o) => o.deliveries?.status === "in_transit").length,
    pending: orders.filter((o) => !o.deliveries || o.deliveries?.status === "pending").length,
    shipped: orders.filter((o) => o.deliveries?.status === "shipped").length,
  }), [orders]);

  const statsData = [
    { title: "Total Orders", value: ordersLoading ? "..." : stats.total, subtitle: "All recorded orders" },
    { title: "Delivered", value: ordersLoading ? "..." : stats.delivered, subtitle: "Successfully delivered" },
    { title: "In Transit", value: ordersLoading ? "..." : stats.inTransit, subtitle: "Currently shipping" },
    { title: "Pending Delivery", value: ordersLoading ? "..." : stats.pending, subtitle: "Not yet shipped" },
  ];

  const ordersTrend = useMemo(() => {
    const monthly = Array(12).fill(0);
    orders.forEach((o) => {
      if (o.order_date) monthly[new Date(o.order_date).getMonth()]++;
    });
    return {
      labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
      datasets: [{
        label: "Orders",
        data: monthly,
        borderColor: "#2563EB",
        backgroundColor: "rgba(37,99,235,0.15)",
        fill: true,
        tension: 0.4,
      }],
    };
  }, [orders]);

  const deliveryBreakdown = useMemo(() => ({
    labels: ["Delivered", "In Transit", "Shipped", "Pending"],
    datasets: [{
      data: [stats.delivered, stats.inTransit, stats.shipped, stats.pending],
      backgroundColor: ["#10B981", "#3B82F6", "#8B5CF6", "#F59E0B"],
    }],
  }), [stats]);

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "0%",
    layout: { padding: { top: 10, bottom: 30 } },
    plugins: {
      legend: { position: "top", align: "center", labels: { boxWidth: 30, padding: 15 } },
    },
  };

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "top", align: "center", labels: { boxWidth: 30, padding: 15 } },
    },
  };

  // Helper: can this order be marked as delivered?
  const canMarkDelivered = (order) => {
    const s = order.deliveries?.status;
    return s === "shipped" || s === "in_transit";
  };

  // Helper: get delivery status display label
  const getDeliveryStatusLabel = (status) => {
    if (status === "in_transit") return "In Transit";
    if (status === "delivered") return "Delivered";
    if (status === "shipped") return "Shipped";
    return "Pending";
  };

  return (
    <div className="admin-page">

      {/* STAT CARDS */}
      <div className="stats-grid">
        {statsData.map((item, i) => (
          <StatCard key={i} title={item.title} value={item.value} subtitle={item.subtitle} />
        ))}
      </div>

      {/* ORDERS TABLE */}
      <div className="admin-section">
        <h3 className="admin-section-heading">Orders & Deliveries</h3>

        <div className="admin-controls">
          <input
            type="text"
            placeholder="Search by product, buyer, seller or order ID"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="search-input"
          />
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="shipped">Shipped</option>
            <option value="in_transit">In Transit</option>
            <option value="delivered">Delivered</option>
          </select>
        </div>

        {ordersLoading ? (
          <div className="loading-state">Loading orders...</div>
        ) : (
          <div className="table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Buyer</th>
                  <th>Seller</th>
                  <th>Amount</th>
                  <th>Service Tax</th>
                  <th>Total</th>
                  <th>Payment</th>
                  <th>Order Status</th>
                  <th>Delivery Status</th>
                  <th>Courier</th>
                  <th>Tracking No</th>
                  <th>Order Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan="13" className="empty-row">No orders found</td>
                  </tr>
                ) : filteredOrders.map((order) => (
                  <tr key={order.id}>
                    <td className="product-cell" title={order.auctions?.products?.title}>
                      {order.auctions?.products?.title?.length > 30 
                        ? order.auctions.products.title.substring(0, 30) + "..." 
                        : order.auctions?.products?.title || "—"}
                    </td>
                    <td className="buyer-cell">{order.buyers?.profiles?.name || "—"}</td>
                    <td className="seller-cell">{order.sellers?.profiles?.name || "—"}</td>
                    <td className="amount-cell">PKR {order.amount?.toLocaleString()}</td>
                    <td className="tax-cell">PKR {order.service_tax?.toLocaleString()}</td>
                    <td className="total-cell">PKR {order.total_amount?.toLocaleString()}</td>
                    <td className="status-cell">
                      <StatusBadge
                        label={order.payments?.status || "pending"}
                        type={order.payments?.status || "pending"}
                      />
                    </td>
                    <td className="status-cell">
                      <StatusBadge
                        label={order.order_status}
                        type={order.order_status}
                      />
                    </td>
                    <td className="status-cell">
                      <StatusBadge
                        label={getDeliveryStatusLabel(order.deliveries?.status)}
                        type={order.deliveries?.status || "pending"}
                      />
                    </td>
                    <td className="courier-cell">{order.deliveries?.courier_service || "—"}</td>
                    <td className="tracking-cell">
                      {order.deliveries?.tracking_no ? (
                        <span className="tracking-number">{order.deliveries.tracking_no}</span>
                      ) : "—"}
                    </td>
                    <td className="date-cell">{formatDate(order.order_date)}</td>

                    {/* Action column */}
                    <td className="actions">
                      {canMarkDelivered(order) ? (
                        <ActionButton
                          label={processing === order.id ? "Updating..." : "Mark Delivered"}
                          variant="success"
                          onClick={() => handleMarkDelivered(order)}
                          disabled={processing === order.id}
                        />
                      ) : order.deliveries?.status === "delivered" ? (
                        <span className="delivered-text">✓ Delivered</span>
                      ) : (
                        <span className="no-action-text">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CHARTS */}
      <div className="overview-grid">
        <div className="chart-box">
          <h3 className="admin-section-heading">Orders Trend</h3>
          <div className="chart-container">
            <Line data={ordersTrend} options={lineOptions} />
          </div>
        </div>
        <div className="chart-box">
          <h3 className="admin-section-heading">Delivery Status Breakdown</h3>
          <div className="chart-container">
            <Doughnut data={deliveryBreakdown} options={doughnutOptions} />
          </div>
        </div>
      </div>

    </div>
  );
};

export default OrderDeliveryManagement;