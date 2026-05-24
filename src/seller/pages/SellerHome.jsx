import { useMemo } from "react";
import { useSellerContext } from "../../context/SellerContext";
import StatCard from "../../common/components/StatCard";
import { Bar, Line } from "react-chartjs-2";
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  BarElement, LineElement, PointElement, Title, Tooltip, Legend,
} from "chart.js";
import "../styles/sellerLayout.css";
import "../styles/sellerHome.css";

ChartJS.register(
  CategoryScale, LinearScale, BarElement,
  LineElement, PointElement, Title, Tooltip, Legend
);

const SellerHome = () => {
  // ✅ No local fetching — read directly from shared context
  const { stats, statsLoading } = useSellerContext();

  const {
    activeListings, totalBids, totalRevenue,
    pendingPayout, bidsPerDay, latestEnded, topAuction,
  } = stats;

  const last7Days = useMemo(() => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const labels = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      labels.push(days[d.getDay()]);
    }
    return labels;
  }, []);

  const bidsChartData = {
    labels: last7Days,
    datasets: [{
      label: "Bids Per Day",
      data: bidsPerDay,
      backgroundColor: "#4e73df",
      borderRadius: 6,
    }],
  };

  const revenueChartData = {
    labels: latestEnded.map((a) => a.products?.title || "—"),
    datasets: [{
      label: "Final Bid (PKR)",
      data: latestEnded.map((a) => a.highest_bid || 0),
      borderColor: "#1cc88a",
      backgroundColor: "rgba(28,200,138,0.2)",
      fill: true,
      tension: 0.4,
      pointRadius: 4,
    }],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top", align: "center",
        labels: { boxWidth: 30, padding: 15 },
      },
    },
  };

  const statsData = [
    {
      title: "Active Listings",
      value: statsLoading ? "..." : activeListings,
      subtitle: "Currently live auctions",
    },
    {
      title: "Total Bids",
      value: statsLoading ? "..." : totalBids.toLocaleString(),
      subtitle: "Across all auctions",
    },
    {
      title: "Total Revenue",
      value: statsLoading ? "..." : `PKR ${totalRevenue.toLocaleString()}`,
      subtitle: "From released payouts",
    },
    {
      title: "Pending Payout",
      value: statsLoading ? "..." : `PKR ${pendingPayout.toLocaleString()}`,
      subtitle: "Currently on hold",
    },
  ];

  return (
    <div className="seller-page">

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

      {/* Top Live Auction — only shows when a live auction has bids */}
      {!statsLoading && topAuction && (
        <div className="top-auction-card">
          <h3>🏆 Top Live Auction</h3>
          <p className="top-auction-title">{topAuction.products?.title}</p>
          <p className="top-auction-bid">
            Current Highest Bid:{" "}
            <strong>PKR {topAuction.highest_bid?.toLocaleString()}</strong>
          </p>
        </div>
      )}

      <div className="overview-grid">
        <div className="chart-box">
          <h3 className="admin-section-heading">Bids Per Day (Last 7 Days)</h3>
          <div className="chart-container">
            <Bar data={bidsChartData} options={chartOptions} />
          </div>
        </div>

        <div className="chart-box">
          <h3 className="admin-section-heading">Completed Auctions — Final Bids</h3>
          <div className="chart-container">
            <Line data={revenueChartData} options={chartOptions} />
          </div>
        </div>
      </div>

    </div>
  );
};

export default SellerHome;