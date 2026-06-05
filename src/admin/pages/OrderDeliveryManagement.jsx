import { useState, useMemo } from "react";
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  PointElement, LineElement, ArcElement, Tooltip, Legend, Filler,
} from "chart.js";
import { Line, Doughnut } from "react-chartjs-2";
import { supabase } from "../../supabase/supabase";
import { useAdminContext } from "../../context/AdminContext";
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
  const { orders, ordersLoading, refetchOrders } = useAdminContext();

  const [search,       setSearch]       = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [processing,   setProcessing]   = useState(null);

  const formatDate = (d) => !d ? "—" : new Date(d).toLocaleDateString("en-PK", {
    year: "numeric", month: "short", day: "numeric",
  });

  const truncate = (text, max = 30) =>
    !text ? "—" : text.length > max ? text.substring(0, max) + "..." : text;

  const handleMarkDelivered = async (order) => {
    if (!window.confirm(
      `Confirm delivery for "${order.auctions?.products?.title}"?\n\n` +
      `This will mark the order as delivered and release payment to the seller.`
    )) return;

    try {
      setProcessing(order.id);

      // ── Step 1: Update or create delivery record ──────────────────
      if (order.deliveries?.id) {
        const { error: deliveryErr } = await supabase
          .from("deliveries")
          .update({
            status:        "delivered",
            delivery_date: new Date().toISOString(),
          })
          .eq("id", order.deliveries.id);

        if (deliveryErr) {
          console.error("Delivery update error:", deliveryErr);
          toast.error(`Error updating delivery: ${deliveryErr.message}`);
          return;
        }
      } else {
        const { error: createErr } = await supabase
          .from("deliveries")
          .insert({
            order_id:        order.id,
            buyer_id:        order.buyer_id,
            seller_id:       order.seller_id,
            status:          "delivered",
            courier_service: "TCS",
            delivery_date:   new Date().toISOString(),
          });

        if (createErr) {
          console.error("Delivery insert error:", createErr);
          toast.error(`Error creating delivery: ${createErr.message}`);
          return;
        }
      }

      // ── Step 2: Update order_status → delivered ───────────────────
      const { error: orderErr } = await supabase
        .from("orders")
        .update({ order_status: "delivered" })
        .eq("id", order.id);

      if (orderErr) {
        console.error("Order status error:", orderErr);
        toast.error(`Error updating order: ${orderErr.message}`);
        return;
      }

      // ── Step 3: Release payment if still on hold ──────────────────
      if (order.payments?.id && order.payments?.hold_status === true) {
        const { error: payErr } = await supabase
          .from("payments")
          .update({ hold_status: false })
          .eq("id", order.payments.id);

        if (payErr) {
          console.error("Payment release error (non-critical):", payErr);
        }

        const { error: txErr } = await supabase
          .from("transactions")
          .update({
            status:       "released",
            release_date: new Date().toISOString(),
          })
          .eq("payment_id", order.payments.id)
          .eq("status",     "onhold");

        if (txErr) {
          console.error("Transaction release error (non-critical):", txErr);
        }
      }

      // ── Step 4: Notify seller ─────────────────────────────────────
      if (order.sellers?.user_id) {
        try {
          const { error: sellerNotifErr } = await supabase
            .from("notifications")
            .insert({
              user_id:          order.sellers.user_id,
              title:            "Delivery Confirmed — Payment Released! 💰",
              message:          `The delivery of "${order.auctions?.products?.title}" has been confirmed. Your payment has been released.`,
              type:             "payment",
              notification_for: "seller",
              is_read:          false,
            });
          if (sellerNotifErr) console.error("Seller notification error:", sellerNotifErr);
        } catch (sellerNotifEx) {
          console.error("Seller notification exception:", sellerNotifEx);
        }
      }

      // ── Step 5: Notify buyer ──────────────────────────────────────
      try {
        const { data: buyerData } = await supabase
          .from("buyers")
          .select("user_id")
          .eq("id", order.buyer_id)
          .maybeSingle();

        if (buyerData?.user_id) {
          const { error: buyerNotifErr } = await supabase
            .from("notifications")
            .insert({
              user_id:          buyerData.user_id,
              title:            "Your Order Has Been Delivered ✅",
              message:          `Your order for "${order.auctions?.products?.title}" has been marked as delivered. Thank you for shopping with us!`,
              type:             "delivery",
              notification_for: "buyer",
              is_read:          false,
            });
          if (buyerNotifErr) console.error("Buyer notification error:", buyerNotifErr);
        }
      } catch (buyerNotifEx) {
        console.error("Buyer notification exception:", buyerNotifEx);
      }

      toast.success("Order marked as delivered and payment released!");
      setTimeout(() => refetchOrders(), 500);

    } catch (err) {
      console.error("handleMarkDelivered error:", err);
      toast.error(`Error: ${err?.message || "Check browser console for details."}`);
    } finally {
      setProcessing(null);
    }
  };

  const filteredOrders = useMemo(() => {
    const q = search.toLowerCase();
    return orders.filter((order) => {
      const matchesSearch =
        order.auctions?.products?.title?.toLowerCase().includes(q) ||
        order.buyers?.profiles?.name?.toLowerCase().includes(q)    ||
        order.sellers?.profiles?.name?.toLowerCase().includes(q)   ||
        order.id?.toLowerCase().includes(q);
      const deliveryStatus = order.deliveries?.status || "pending";
      const matchesStatus  = filterStatus === "all" || deliveryStatus === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [orders, search, filterStatus]);

  const stats = useMemo(() => ({
    total:     orders.length,
    delivered: orders.filter((o) => o.deliveries?.status === "delivered").length,
    shipped:   orders.filter((o) => o.deliveries?.status === "shipped").length,
    pending:   orders.filter((o) => !o.deliveries || o.deliveries?.status === "pending").length,
  }), [orders]);

  const statsData = [
    { title: "Total Orders",     value: ordersLoading ? "..." : stats.total,     subtitle: "All recorded orders"     },
    { title: "Delivered",        value: ordersLoading ? "..." : stats.delivered, subtitle: "Successfully delivered"  },
    { title: "Shipped",          value: ordersLoading ? "..." : stats.shipped,   subtitle: "Seller has shipped"      },
    { title: "Pending Shipment", value: ordersLoading ? "..." : stats.pending,   subtitle: "Awaiting seller to ship" },
  ];

  const ordersTrend = useMemo(() => {
    const monthly = Array(12).fill(0);
    orders.forEach((o) => {
      if (o.order_date) monthly[new Date(o.order_date).getMonth()]++;
    });
    return {
      labels: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
      datasets: [{
        label: "Orders", data: monthly,
        borderColor: "#2563EB", backgroundColor: "rgba(37,99,235,0.15)",
        fill: true, tension: 0.4,
      }],
    };
  }, [orders]);

  const deliveryBreakdown = useMemo(() => ({
    labels: ["Delivered", "Shipped", "Pending"],
    datasets: [{
      data: [stats.delivered, stats.shipped, stats.pending],
      backgroundColor: ["#10B981", "#3B82F6", "#F59E0B"],
    }],
  }), [stats]);

  const doughnutOptions = {
    responsive: true, maintainAspectRatio: false, cutout: "0%",
    layout: { padding: { top: 10, bottom: 30 } },
    plugins: { legend: { position: "top", align: "center", labels: { boxWidth: 30, padding: 15 } } },
  };

  const lineOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { position: "top", align: "center", labels: { boxWidth: 30, padding: 15 } } },
  };

  const getDeliveryLabel = (status) => {
    if (status === "shipped")   return "Shipped";
    if (status === "delivered") return "Delivered";
    if (status === "failed")    return "Failed";
    return "Pending";
  };

  const getOrderStatusLabel = (status) => {
    if (status === "confirmed")  return "Confirmed";
    if (status === "cancelled")  return "Cancelled";
    if (status === "delivered")  return "Delivered";
    return "Pending";
  };

  // Only shipped orders can be marked delivered — in_transit removed
  const canMarkDelivered = (order) => order.deliveries?.status === "shipped";

  return (
    <div className="admin-page">

      <div className="stats-grid">
        {statsData.map((item, i) => (
          <StatCard key={i} title={item.title} value={item.value} subtitle={item.subtitle} />
        ))}
      </div>

      <div className="admin-section">
        <h3 className="admin-section-heading">Orders & Deliveries</h3>

        <div className="admin-controls">
          <input
            type="text"
            placeholder="Search by product, buyer, seller or order ID"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {/* in_transit removed from filter — enum value no longer exists */}
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
            <option value="failed">Failed</option>
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
                  <th>Shipping</th>
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
                  <tr><td colSpan="14" className="empty-row">No orders found</td></tr>
                ) : filteredOrders.map((order) => (
                  <tr key={order.id}>
                    <td title={order.auctions?.products?.title}>
                      {truncate(order.auctions?.products?.title)}
                    </td>
                    <td>{order.buyers?.profiles?.name  || "—"}</td>
                    <td>{order.sellers?.profiles?.name || "—"}</td>

                    {/* amount, service_tax, shipping_fee — all exist in orders table per schema */}
                    <td>PKR {order.amount?.toLocaleString()       || "—"}</td>
                    <td>PKR {order.service_tax?.toLocaleString()  || "—"}</td>
                    <td>PKR {order.shipping_fee?.toLocaleString() || "—"}</td>
                    <td>PKR {order.total_amount?.toLocaleString() || "—"}</td>

                    <td>
                      <StatusBadge
                        label={order.payments?.status
                          ? order.payments.status.charAt(0).toUpperCase() + order.payments.status.slice(1)
                          : "Pending"}
                        type={order.payments?.status || "pending"}
                      />
                    </td>

                    <td>
                      <StatusBadge
                        label={getOrderStatusLabel(order.order_status)}
                        type={order.order_status || "pending"}
                      />
                    </td>

                    <td>
                      <StatusBadge
                        label={getDeliveryLabel(order.deliveries?.status)}
                        type={order.deliveries?.status || "pending"}
                      />
                    </td>

                    <td>{order.deliveries?.courier_service || "—"}</td>
                    <td>{order.deliveries?.tracking_no     || "—"}</td>
                    <td>{formatDate(order.order_date)}</td>

                    <td className="actions">
                      {canMarkDelivered(order) ? (
                        <ActionButton
                          label={processing === order.id ? "Updating..." : "Mark Delivered"}
                          variant="success"
                          onClick={() => handleMarkDelivered(order)}
                          disabled={processing === order.id}
                        />
                      ) : order.deliveries?.status === "delivered" ? (
                        <span style={{ color: "#10b981", fontSize: "13px", fontWeight: "600" }}>
                          ✓ Delivered
                        </span>
                      ) : (
                        <span style={{ color: "#999", fontSize: "12px" }}>
                          Awaiting shipment
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

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