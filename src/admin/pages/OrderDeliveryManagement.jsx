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

  const [search, setSearch]           = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [processing, setProcessing]   = useState(null); // order.id being processed

  const formatDate = (d) =>
    !d ? "—" : new Date(d).toLocaleDateString("en-PK", {
      year: "numeric", month: "short", day: "numeric",
    });

  const handleMarkDelivered = async (order) => {
    if (!window.confirm(
      `Confirm delivery for "${order.auctions?.products?.title}"?\n\n` +
      `This will mark the order as delivered and release payment to the seller.`
    )) return;

    try {
      setProcessing(order.id);

      // ── Step 1: Update delivery status ────────────────────────────
      if (order.deliveries?.id) {
        const { error: deliveryError } = await supabase
          .from("deliveries")
          .update({
            status:        "delivered",
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
            order_id:        order.id,
            buyer_id:        order.buyer_id,
            seller_id:       order.seller_id,
            status:          "delivered",
            courier_service: "TCS",
            delivery_date:   new Date().toISOString(),
          });

        if (createError) {
          toast.error("Error creating delivery record");
          console.error(createError);
          return;
        }
      }

      // ── Step 2: Update order status ───────────────────────────────
      await supabase
        .from("orders")
        .update({ order_status: "confirmed" })
        .eq("id", order.id);

      // ── Step 3: Update product status to sold ─────────────────────
      if (order.auctions?.id) {
        const { data: auctionData } = await supabase
          .from("auctions")
          .select("product_id")
          .eq("id", order.auctions.id)
          .single();

        if (auctionData?.product_id) {
          await supabase
            .from("products")
            .update({ status: "sold" })
            .eq("id", auctionData.product_id);
        }
      }

      // ── Step 4: Release payment hold ──────────────────────────────
      if (order.payments?.id) {
        await supabase
          .from("payments")
          .update({ hold_status: false })
          .eq("id", order.payments.id);
      }

      // ── Step 5: Release seller transaction ────────────────────────
      if (order.payments?.id) {
        await supabase
          .from("transactions")
          .update({
            status:       "released",
            release_date: new Date().toISOString(),
          })
          .eq("payment_id", order.payments.id);
      }

      // ── Step 6: Notify seller ─────────────────────────────────────
      const sellerUserId = order.sellers?.profiles?.id
        || order.sellers?.user_id
        || null;

      if (sellerUserId) {
        await supabase.from("notifications").insert({
          user_id:          sellerUserId,
          title:            "Payment Released! 💰",
          message:          `The delivery of "${order.auctions?.products?.title}" has been confirmed by admin. Your payment has been released.`,
          type:             "payment",
          notification_for: "seller",
          is_read:          false,
        });
      }

      // ── Step 7: Notify buyer ──────────────────────────────────────
      const buyerUserId = order.buyers?.profiles?.user_id
        || order.buyers?.user_id
        || null;

      // Fetch buyer's profile user_id
      const { data: buyerData } = await supabase
        .from("buyers")
        .select("user_id")
        .eq("id", order.buyer_id)
        .single();

      if (buyerData?.user_id) {
        await supabase.from("notifications").insert({
          user_id:          buyerData.user_id,
          title:            "Delivery Confirmed ✅",
          message:          `Your delivery for "${order.auctions?.products?.title}" has been marked as delivered. Thank you for your purchase!`,
          type:             "delivery",
          notification_for: "buyer",
          is_read:          false,
        });
      }

      toast.success("Order marked as delivered and payment released to seller!");
      refetchOrders();

    } catch (err) {
      console.error(err);
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
        order.buyers?.profiles?.name?.toLowerCase().includes(q)    ||
        order.sellers?.profiles?.name?.toLowerCase().includes(q)   ||
        order.id?.toLowerCase().includes(q);
      const deliveryStatus = order.deliveries?.status || "pending";
      const matchesStatus  = filterStatus === "all" || deliveryStatus === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [orders, search, filterStatus]);

  // ── Stats ─────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total:     orders.length,
    delivered: orders.filter((o) => o.deliveries?.status === "delivered").length,
    inTransit: orders.filter((o) => o.deliveries?.status === "in_transit").length,
    pending:   orders.filter((o) => !o.deliveries || o.deliveries?.status === "pending").length,
    shipped:   orders.filter((o) => o.deliveries?.status === "shipped").length,
  }), [orders]);

  const statsData = [
    { title: "Total Orders",     value: ordersLoading ? "..." : stats.total,     subtitle: "All recorded orders"    },
    { title: "Delivered",        value: ordersLoading ? "..." : stats.delivered,  subtitle: "Successfully delivered" },
    { title: "In Transit",       value: ordersLoading ? "..." : stats.inTransit,  subtitle: "Currently shipping"     },
    { title: "Pending Delivery", value: ordersLoading ? "..." : stats.pending,    subtitle: "Not yet shipped"        },
  ];

  const ordersTrend = useMemo(() => {
    const monthly = Array(12).fill(0);
    orders.forEach((o) => {
      if (o.order_date) monthly[new Date(o.order_date).getMonth()]++;
    });
    return {
      labels: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
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
    responsive: true, maintainAspectRatio: false, cutout: "0%",
    layout: { padding: { top: 10, bottom: 30 } },
    plugins: {
      legend: { position: "top", align: "center", labels: { boxWidth: 30, padding: 15 } },
    },
  };

  const lineOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { position: "top", align: "center", labels: { boxWidth: 30, padding: 15 } },
    },
  };

  // Helper: can this order be marked as delivered?
  // Only show button if delivery is shipped or in_transit (not already delivered or pending)
  const canMarkDelivered = (order) => {
    const s = order.deliveries?.status;
    return s === "shipped" || s === "in_transit";
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
          />
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="shipped">Shipped</option>
            <option value="in_transit">In Transit</option>
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
                    <td>{order.auctions?.products?.title || "—"}</td>
                    <td>{order.buyers?.profiles?.name   || "—"}</td>
                    <td>{order.sellers?.profiles?.name  || "—"}</td>
                    <td>PKR {order.amount?.toLocaleString()}</td>
                    <td>PKR {order.service_tax?.toLocaleString()}</td>
                    <td>PKR {order.total_amount?.toLocaleString()}</td>
                    <td>
                      <StatusBadge
                        label={order.payments?.status || "pending"}
                        type={order.payments?.status  || "pending"}
                      />
                    </td>
                    <td>
                      <StatusBadge
                        label={order.order_status}
                        type={order.order_status}
                      />
                    </td>
                    <td>
                      <StatusBadge
                        label={order.deliveries?.status || "pending"}
                        type={order.deliveries?.status  || "pending"}
                      />
                    </td>
                    <td>{order.deliveries?.courier_service || "—"}</td>
                    <td>{order.deliveries?.tracking_no    || "—"}</td>
                    <td>{formatDate(order.order_date)}</td>

                    {/* ── Action column ── */}
                    <td className="actions">
                      {canMarkDelivered(order) ? (
                        <ActionButton
                          label={processing === order.id ? "Updating..." : "Mark Delivered"}
                          variant="success"
                          onClick={() => handleMarkDelivered(order)}
                          disabled={processing === order.id}
                        />
                      ) : order.deliveries?.status === "delivered" ? (
                        <span style={{
                          color: "#10b981",
                          fontSize: "13px",
                          fontWeight: "600",
                        }}>
                          ✓ Delivered
                        </span>
                      ) : (
                        <span style={{ color: "#999", fontSize: "12px" }}>
                          —
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