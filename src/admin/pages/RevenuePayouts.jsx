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
import { useMemo, useState } from "react";

import StatCard from "../../common/components/StatCard";
import StatusBadge from "../../common/components/StatusBadge";
import ActionButton from "../../common/components/ActionButton";

import "../styles/adminLayout.css";
import "../styles/home.css";
import "../styles/revenuePayouts.css";

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

const RevenuePayouts = () => {
  /* ================= STATE ================= */

  const commissionRate = 10;

  const [pendingData, setPendingData] = useState([
    {
      id: 1,
      seller: "Sara Antiques",
      orderId: "#ORD321",
      product: "Vintage Vase",
      deliveryDate: "2026-01-15",
      holdUntil: "2026-01-20",
      amount: 12000,
      fee: 1200,
      status: "holding",
    },
  ]);

  const [releasedData, setReleasedData] = useState([
    {
      id: 2,
      seller: "Classic Furnishings",
      orderId: "#ORD111",
      product: "Antique Chair",
      releaseDate: "2026-01-10",
      amount: 18000,
      fee: 1800,
      status: "released",
    },
  ]);

  /* ================= RELEASE LOGIC ================= */

  const handleRelease = (item) => {
    // Remove from pending
    setPendingData((prev) => prev.filter((p) => p.id !== item.id));

    // Add to released
    const releasedItem = {
      ...item,
      releaseDate: new Date().toISOString().split("T")[0],
      status: "released",
    };

    setReleasedData((prev) => [releasedItem, ...prev]);
  };

  /* ================= DERIVED STATS ================= */

  const totalRevenue =
    [...pendingData, ...releasedData].reduce(
      (sum, item) => sum + item.amount,
      0
    );

  const pendingPayouts = pendingData.reduce(
    (sum, item) => sum + item.amount,
    0
  );

  const releasedPayouts = releasedData.reduce(
    (sum, item) => sum + item.amount,
    0
  );

  const platformEarnings = (totalRevenue * commissionRate) / 100;

  /* ================= CHART DATA ================= */

  const revenueTrend = useMemo(() => {
    const monthly = totalRevenue / 12 || 0;

    return {
      labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
      datasets: [
        {
          label: "Revenue",
          data: [
            monthly * 0.8,
            monthly,
            monthly * 1.1,
            monthly * 1.2,
            monthly * 0.8,
            monthly,
            monthly * 1.1,
            monthly * 1.2,
            monthly * 0.95,
            monthly * 1.3,
            monthly * 0.95,
            monthly * 1.3,
          ],
          borderColor: "#2563EB",
          backgroundColor: "rgba(37,99,235,0.15)",
          fill: true,
          tension: 0.4,
        },
      ],
    };
  }, [totalRevenue]);

  const commissionData = {
    labels: ["Platform Earnings", "Seller Earnings"],
    datasets: [
      {
        data: [platformEarnings, totalRevenue - platformEarnings],
        backgroundColor: ["#10B981", "#3B82F6"],
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
    cutout: "0%",
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

  const statsData = [
    {
      title: "Total Revenue",
      value: `Rs. ${totalRevenue.toLocaleString()}`,
      subtitle: "All transactions",
    },
    {
      title: "Pending Payouts",
      value: `Rs. ${pendingPayouts.toLocaleString()}`,
      subtitle: "On hold",
    },
    {
      title: "Released to Sellers",
      value: `Rs. ${releasedPayouts.toLocaleString()}`,
      subtitle: "Successfully paid",
    },
    {
      title: "Platform Earnings",
      value: `Rs. ${platformEarnings.toLocaleString()}`,
      subtitle: `${commissionRate}% commission`,
    },
  ];

  /* ================= UI ================= */

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

      {/* ================= PENDING TABLE ================= */}

      <div className="admin-section">
        <h3 className="admin-section-heading">Pending Payouts</h3>

        <div className="table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Seller</th>
                <th>Order ID</th>
                <th>Product</th>
                <th>Delivery Date</th>
                <th>Hold Until</th>
                <th>Amount</th>
                <th>Service Fee</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {pendingData.length === 0 ? (
                <tr>
                  <td colSpan="9" className="no-data">
                    No pending payouts
                  </td>
                </tr>
              ) : (
                pendingData.map((item) => (
                  <tr key={item.id}>
                    <td>{item.seller}</td>
                    <td>{item.orderId}</td>
                    <td>{item.product}</td>
                    <td>{item.deliveryDate}</td>
                    <td>{item.holdUntil}</td>
                    <td>Rs. {item.amount}</td>
                    <td>Rs. {item.fee}</td>
                    <td>
                      <StatusBadge label="On Hold" type="holding" />
                    </td>
                    <td className="actions">
                      <ActionButton
                        label="Release"
                        variant="secondary"
                        onClick={() => handleRelease(item)}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================= RELEASED TABLE ================= */}

      <div className="admin-section">
        <h3 className="admin-section-heading">Released Payouts</h3>

        <div className="table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Seller</th>
                <th>Order ID</th>
                <th>Product</th>
                <th>Release Date</th>
                <th>Amount</th>
                <th>Service Fee</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {releasedData.map((item) => (
                <tr key={item.id}>
                  <td>{item.seller}</td>
                  <td>{item.orderId}</td>
                  <td>{item.product}</td>
                  <td>{item.releaseDate}</td>
                  <td>Rs. {item.amount}</td>
                  <td>Rs. {item.fee}</td>
                  <td>
                    <StatusBadge label="Released" type="released" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================= REVENUE OVERVIEW ================= */}

      <div className="overview-grid">
        <div className="chart-box">
          <h3 className="admin-section-heading">Revenue Growth</h3>
          <div className="chart-container">
            <Line data={revenueTrend} options={lineOptions} />
          </div>
        </div>

        <div className="chart-box">
          <h4>Commission Breakdown</h4>
          <div className="chart-container">
            <Doughnut data={commissionData} options={doughnutOptions} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default RevenuePayouts;