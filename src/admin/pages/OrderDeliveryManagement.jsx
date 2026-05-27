import { useState, useMemo } from "react";
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  PointElement, LineElement, ArcElement, Tooltip, Legend, Filler,
} from "chart.js";
import { Line, Doughnut } from "react-chartjs-2";
import { useAdminContext } from "../../context/AdminContext";
import StatCard from "../../common/components/StatCard";
import StatusBadge from "../../common/components/StatusBadge";
import "../styles/adminLayout.css";
import "../styles/orderDeliveryManagement.css";

ChartJS.register(
  CategoryScale, LinearScale, PointElement,
  LineElement, ArcElement, Tooltip, Legend, Filler
);

// ✅ Only default export — named export removed
const OrderDeliveryManagement = () => {
  const { orders, ordersLoading } = useAdminContext();

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  const formatDate = (d) =>
    !d ? "—" : new Date(d).toLocaleDateString("en-PK", {
      year: "numeric", month: "short", day: "numeric",
    });

  const filteredOrders = useMemo(() => {
    const q = search.toLowerCase();
    return orders.filter((order) => {
      const matchesSearch =
        order.auctions?.products?.title?.toLowerCase().includes(q) ||
        order.buyers?.profiles?.name?.toLowerCase().includes(q)   ||
        order.sellers?.profiles?.name?.toLowerCase().includes(q)  ||
        order.id?.toLowerCase().includes(q);
      const deliveryStatus = order.deliveries?.status || "pending";
      const matchesStatus  = filterStatus === "all" || deliveryStatus === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [orders, search, filterStatus]);

  const stats = useMemo(() => ({
    total:     orders.length,
    delivered: orders.filter((o) => o.deliveries?.status === "delivered").length,
    inTransit: orders.filter((o) => o.deliveries?.status === "in_transit").length,
    pending:   orders.filter((o) => !o.deliveries || o.deliveries?.status === "pending").length,
  }), [orders]);

  const statsData = [
    { title: "Total Orders",     value: ordersLoading ? "..." : stats.total,     subtitle: "All recorded orders"    },
    { title: "Delivered",        value: ordersLoading ? "..." : stats.delivered,  subtitle: "Successfully delivered" },
    { title: "In Transit",       value: ordersLoading ? "..." : stats.inTransit,  subtitle: "Currently shipping"     },
    { title: "Pending Delivery", value: ordersLoading ? "..." : stats.pending,    subtitle: "Not yet shipped"        },
  ];

  // ✅ FIXED — was order.created_at before, orders table uses order_date column
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
    labels: ["Delivered", "In Transit", "Pending"],
    datasets: [{
      data: [stats.delivered, stats.inTransit, stats.pending],
      backgroundColor: ["#10B981", "#3B82F6", "#F59E0B"],
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
                </tr>
              </thead>
              <tbody>
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan="12" className="empty-row">No orders found</td>
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
                    {/* ✅ FIXED — was order.created_at, table column is order_date */}
                    <td>{formatDate(order.order_date)}</td>
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