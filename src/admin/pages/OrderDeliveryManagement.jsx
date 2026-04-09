import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line, Doughnut } from "react-chartjs-2";
import { useState, useMemo } from "react";
import StatusBadge from "../../common/components/StatusBadge";
import StatCard from "../../common/components/StatCard";
import ActionButton from "../../common/components/ActionButton";
import "../styles/adminLayout.css";
import "../styles/orderDeliveryManagement.css";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler
);

/* ================= INITIAL DATA ================= */

const initialOrders = [
  {
    orderId: "ORD-501",
    auctionId: "AUC-2101",
    orderDate: "2026-02-01",
    buyer: "Ali Khan",
    seller: "Sara Ahmed",
    product: "Antique Vase",
    amount: "$850",
    paymentStatus: "Paid",
    deliveryStatus: "In Transit",
    trackingNo: "TRK-889234",
    issue: null,
  },
  {
    orderId: "ORD-502",
    auctionId: "AUC-2102",
    orderDate: "2026-02-02",
    buyer: "Zain Malik",
    seller: "Ali Khan",
    product: "Gaming Laptop",
    amount: "$1200",
    paymentStatus: "Paid",
    deliveryStatus: "Delivered",
    trackingNo: "TRK-112390",
    issue: null,
  },
  {
    orderId: "ORD-503",
    auctionId: "AUC-2103",
    orderDate: "2026-02-03",
    buyer: "Sara Ahmed",
    seller: "Zain Malik",
    product: "Luxury Watch",
    amount: "$2500",
    paymentStatus: "Paid",
    deliveryStatus: "Delayed",
    trackingNo: "TRK-445678",
    issue: {
      type: "Delivery delay",
      status: "Open",
    },
  },
];

const OrderDeliveryManagement = () => {
  const [orders, setOrders] = useState(initialOrders);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  /* ================= FILTER LOGIC ================= */
  const query = search.trim().toLowerCase();
  const filteredOrders = orders.filter((o) => {
    const matchesSearch =
      o.orderId.toLowerCase().includes(query) ||
      o.auctionId.toLowerCase().includes(query) ||
      o.product.toLowerCase().includes(query) ||
      o.buyer.toLowerCase().includes(query) ||
      o.seller.toLowerCase().includes(query);

    const matchesStatus =
      filterStatus === "all" ||
      o.deliveryStatus.toLowerCase().replace(" ", "-") === filterStatus;

    return matchesSearch && matchesStatus;
  });

  /* ================= ORDER-FOCUSED STATS ================= */

  const stats = useMemo(() => {
    const total = orders.length;
    const delivered = orders.filter(o => o.deliveryStatus === "Delivered").length;
    const transit = orders.filter(o => o.deliveryStatus === "In Transit").length;
    const delayed = orders.filter(o => o.deliveryStatus === "Delayed").length;

    return { total, delivered, transit, delayed };
  }, [orders]);

  const statsData = [
    {
      title: "Total Orders",
      value: stats.total,
      subtitle: "All recorded orders",
    },
    {
      title: "Delivered",
      value: stats.delivered,
      subtitle: "Successfully delivered",
    },
    {
      title: "In Transit",
      value: stats.transit,
      subtitle: "In-transit",
    },
    {
      title: "Delayed",
      value: stats.delayed,
      subtitle: "Delivery delays",
    },
  ];

  /* ================= CHART DATA ================= */

  const ordersTrend = useMemo(() => {
    const total = stats.total || 0;

    return {
      labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
      datasets: [
        {
          label: "Orders",
          data: [
            total * 0.6,
            total * 0.8,
            total,
            total * 1.2,
            total * 0.9,
            total * 0.6,
            total * 0.8,
            total,
            total * 1.2,
            total * 0.9,
            total * 1.3,
            total * 1.3,
          ],
          borderColor: "#2563EB",
          backgroundColor: "rgba(37,99,235,0.15)",
          fill: true,
          tension: 0.4,
        },
      ],
    };
  }, [stats.total]);

  const deliveryBreakdown = {
    labels: ["Delivered", "In Transit", "Delayed"],
    datasets: [
      {
        data: [stats.delivered, stats.transit, stats.delayed],
        backgroundColor: ["#10B981", "#3B82F6", "#EF4444"],
      },
    ],
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "0%",
    layout: {
      padding: {
        top: 10,    // space above the chart
        bottom: 30, // space below the chart
      },
    },
    plugins: {
      legend: {
        position: "top",
        align: "center",
        labels: {
          boxWidth: 30,
          padding: 15,
        },
      },
    },
  };

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top",
        align: "center",
        labels: {
          boxWidth: 30,
          padding: 15,
        },
      },
    },
  };

  /* ================= ACTIONS ================= */

  const markIssueResolved = (orderId) => {
    setOrders((prev) =>
      prev.map((order) =>
        order.orderId === orderId
          ? { ...order, issue: { ...order.issue, status: "Resolved" } }
          : order
      )
    );
  };

  return (
    <div className="admin-page">

      {/* ================= STAT CARDS ================= */}

      <div className="stats-grid">
        {statsData.map((item, index) => (
          <StatCard
            key={index}
            title={item.title}
            value={item.value}
            subtitle={item.subtitle}
          />
        ))}
      </div>

      {/* ================= TABLE ================= */}
      <div className="admin-section">
        <h3 className="admin-section-heading">Orders Overview</h3>

        {/* ================= CONTROLS ================= */}

        <div className="admin-controls">
          <input
            type="text"
            placeholder="Search Order ID, Auction ID, Product, Buyer, Seller"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="delivered">Delivered</option>
            <option value="in-transit">In Transit</option>
            <option value="delayed">Delayed</option>
          </select>
        </div>


        <div className="table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Auction ID</th>
                <th>Date</th>
                <th>Product</th>
                <th>Buyer</th>
                <th>Seller</th>
                <th>Amount</th>
                <th>Payment</th>
                <th>Delivery</th>
                <th>Tracking</th>
                <th>Issue</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan="12" className="no-data">
                    No orders
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr key={order.orderId}>
                    <td>{order.orderId}</td>
                    <td>{order.auctionId}</td>
                    <td>{new Date(order.orderDate).toLocaleDateString()}</td>
                    <td>{order.product}</td>
                    <td>{order.buyer}</td>
                    <td>{order.seller}</td>
                    <td>{order.amount}</td>

                    <td>
                      <StatusBadge
                        label={order.paymentStatus}
                        type={order.paymentStatus.toLowerCase()}
                      />
                    </td>

                    <td>
                      <StatusBadge
                        label={order.deliveryStatus}
                        type={order.deliveryStatus
                          .toLowerCase()
                          .replace(" ", "-")}
                      />
                    </td>

                    <td>{order.trackingNo}</td>

                    <td>
                      {order.issue ? (
                        <StatusBadge
                          label={`${order.issue.type} (${order.issue.status})`}
                          type={
                            order.issue.status === "Open"
                              ? "danger"
                              : "approved"
                          }
                        />
                      ) : (
                        <StatusBadge label="No Issue" type="approved" />
                      )}
                    </td>

                    <td>
                      <div className="actions">
                        {order.issue &&
                          order.issue.status === "Open" && (
                            <ActionButton
                              label="Resolve"
                              variant="success"
                              onClick={() =>
                                markIssueResolved(order.orderId)
                              }
                            />
                          )}

                        <ActionButton
                          label="View"
                          variant="secondary"
                          onClick={() =>
                            alert(`Viewing ${order.orderId}`)
                          }
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================= ORDER ANALYTICS ================= */}



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