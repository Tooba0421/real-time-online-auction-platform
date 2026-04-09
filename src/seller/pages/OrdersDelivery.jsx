import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";

import { useState, useMemo } from "react";
import StatCard from "../../common/components/StatCard";
import StatusBadge from "../../common/components/StatusBadge";
import ActionButton from "../../common/components/ActionButton";
import "../styles/sellerLayout.css";
import "../styles/orderDelivery.css";

ChartJS.register(ArcElement, Tooltip, Legend);

const initialOrders = [
  {
    id: "ORD-1001",
    auctionId: "AUC-500",
    item: "Luxury Watch",
    buyer: "Ali Khan",
    amount: 1200,
    paymentStatus: "holding",
    deliveryStatus: "pending",
    date: "2026-02-01",
  },
  {
    id: "ORD-1002",
    auctionId: "AUC-501",
    item: "Gaming Laptop",
    buyer: "Sara Ahmed",
    amount: 2400,
    paymentStatus: "released",
    deliveryStatus: "delivered",
    date: "2026-02-02",
  },
  {
    id: "ORD-1003",
    auctionId: "AUC-502",
    item: "Metal Chair",
    buyer: "Usman Ali",
    amount: 300,
    paymentStatus: "paid",
    deliveryStatus: "in-transit",
    date: "2026-02-05",
  },
];

const OrderDelivery = () => {
  const [orders, setOrders] = useState(initialOrders);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  /* ===== Filtering Logic ===== */
  const query = search.trim().toLowerCase();
  const filteredOrders = orders.filter((o) => {
    const matchesSearch =
      o.id.toLowerCase().includes(query) ||
      o.item.toLowerCase().includes(query) ||
      o.buyer.toLowerCase().includes(query);

    const matchesStatus =
      filterStatus === "all" || o.deliveryStatus === filterStatus;

    return matchesSearch && matchesStatus;
  });

  /* ===== Status Update ===== */
  const updateStatus = (id, status) => {
    setOrders((prev) =>
      prev.map((order) =>
        order.id === id ? { ...order, deliveryStatus: status } : order
      )
    );
  };

  /* ======= Stats Card ======= */
  const stats = useMemo(() => {
    const total = orders.length;

    const pending = orders.filter(
      (o) => o.deliveryStatus === "pending"
    ).length;

    const transit = orders.filter(
      (o) => o.deliveryStatus === "in-transit"
    ).length;

    const delivered = orders.filter(
      (o) => o.deliveryStatus === "delivered"
    ).length;

    return { total, pending, transit, delivered };
  }, [orders]);

  const statsData = [
    {
      title: "Total Orders",
      value: stats.total,
      subtitle: "All successful auction sales",
    },
    {
      title: "Pending Shipment",
      value: stats.pending,
      subtitle: "Orders you need to ship",
    },
    {
      title: "In Transit",
      value: stats.transit,
      subtitle: "Currently on the way to buyers",
    },
    {
      title: "Delivered",
      value: stats.delivered,
      subtitle: "Successfully completed orders",
    },
  ];

  const formatStatus = (status) =>
    status
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");

  /* ===== DELIVERY STATUS CHART ===== */

  const deliveryChartData = {
    labels: ["Pending", "In Transit", "Delivered"],
    datasets: [
      {
        data: [
          stats.pending || 0,
          stats.transit || 0,
          stats.delivered || 0,
        ],
        backgroundColor: [
          "#facc15", // Pending - yellow
          "#3b82f6", // In Transit - blue
          "#22c55e", // Delivered - green
        ],
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

  return (
    <div className="seller-page">

      {/* ===== Stats Section ===== */}
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

      {/* ===== Table ===== */}
      <div className="seller-section">
        <h3 className="seller-section-heading">Delivery Details</h3>

        {/* ===== Controls (Copied Structure) ===== */}
        <div className="page-controls">
          <input
            type="text"
            placeholder="Search by Order ID, Item or Buyer"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">Delivery Status</option>
            <option value="pending">Pending</option>
            <option value="in-transit">In Transit</option>
            <option value="delivered">Delivered</option>
          </select>
        </div>

        <div className="table-wrapper">
          <table className="seller-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Item</th>
                <th>Buyer</th>
                <th>Amount</th>
                <th>Delivery Status</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan="7" className="no-data">
                    No orders found
                  </td>
                </tr>
              ) : (
                filteredOrders.map((o) => (
                  <tr key={o.id}>
                    <td>{o.id}</td>
                    <td>{o.item}</td>
                    <td>{o.buyer}</td>
                    <td>{o.amount.toFixed(2).toLocaleString()}</td>

                    <td>
                      <StatusBadge
                        label={formatStatus(o.deliveryStatus)}
                        type={o.deliveryStatus}
                      />
                    </td>

                    <td>{new Date(o.date).toLocaleDateString()}</td>

                    <td className="actions">
                      {o.deliveryStatus === "pending" && (
                        <ActionButton
                          label="Mark as Shipped"
                          variant="secondary"
                          onClick={() => {
                            if (window.confirm("Mark this order as shipped?")) {
                              updateStatus(o.id, "in-transit");
                            }
                          }}
                        />
                      )}

                      {o.deliveryStatus === "in-transit" && (
                        <ActionButton
                          label="Confirm Delivery"
                          variant="secondary"
                          onClick={() =>
                            updateStatus(o.id, "delivered")
                          }
                        />
                      )}

                      {o.deliveryStatus === "delivered" && (
                        <ActionButton
                          label="View Details"
                          variant="secondary"
                        />
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===== DELIVERY STATUS CHART ===== */}
      <div className="overview-grid chart-space">
        <div className="chart-box">
          <h3 className="seller-section-heading">
            Delivery Status Overview
          </h3>

          <div className="chart-container">
            <Doughnut
              data={deliveryChartData}
              options={doughnutOptions}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderDelivery;