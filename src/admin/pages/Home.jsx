import { useMemo } from "react";
import { Bar, Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  BarElement, ArcElement, Title, Tooltip, Legend,
} from "chart.js";
import StatCard from "../../common/components/StatCard";
import { useAdminContext } from "../../context/AdminContext";
import "../styles/home.css";

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

const CATEGORIES = [
  "Electronics","Antiques","Artwork","Furniture","Jewelry","Interiors",
  "Music,Movies & Cameras","Coins & Stamps","Fashion","Toys & Models","Luxury Watches",
];

const Home = () => {
  const { homeStats, homeLoading } = useAdminContext();

  const {
    totalUsers, totalSellers, pendingRequests, totalRevenue,
    completedAuctions, totalBids, totalAuctions,
    monthlyBids, monthlyAuctions, categoryData,
  } = homeStats;

  const auctionSuccessRate = totalAuctions > 0
    ? ((completedAuctions / totalAuctions) * 100).toFixed(1) : 0;

  const statsData = [
    { title: "Total Registered Users",  value: homeLoading ? "..." : totalUsers.toLocaleString(),       subtitle: "All platform users" },
    { title: "Total Sellers",           value: homeLoading ? "..." : totalSellers.toLocaleString(),      subtitle: "Verified sellers" },
    { title: "Total Auctions",          value: homeLoading ? "..." : totalAuctions.toLocaleString(),     subtitle: "All time" },
    { title: "Completed Auctions",      value: homeLoading ? "..." : completedAuctions.toLocaleString(), subtitle: "Successfully closed" },
    { title: "Total Bids Placed",       value: homeLoading ? "..." : totalBids.toLocaleString(),         subtitle: "Yearly bidding activity" },
    { title: "Auction Success Rate",    value: homeLoading ? "..." : `${auctionSuccessRate}%`,           subtitle: "Completed vs total" },
    { title: "Total Revenue",           value: homeLoading ? "..." : `PKR ${totalRevenue.toLocaleString()}`, subtitle: "Platform earnings" },
    { title: "Pending Requests",        value: homeLoading ? "..." : pendingRequests.toLocaleString(),   subtitle: "Awaiting approval" },
  ];

  const monthlyBidData = useMemo(() => ({
    labels: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    datasets: [
      { label: "Bids Placed",    data: monthlyBids,    backgroundColor: "#4e73df" },
      { label: "New Auctions",   data: monthlyAuctions, backgroundColor: "#1cc88a" },
    ],
  }), [monthlyBids, monthlyAuctions]);

  const auctionCategoryData = useMemo(() => ({
    labels: CATEGORIES,
    datasets: [{
      data: CATEGORIES.map((c) => categoryData[c] || 0),
      backgroundColor: [
        "#4e73df","#1cc88a","#36b9cc","#f6c23e","#e74a3b",
        "#19686d","#1cc825","#cc36b1","#d6cef7","#13492b","#e18d06",
      ],
    }],
  }), [categoryData]);

  const chartOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { position: "top", align: "center", labels: { boxWidth: 30, padding: 15 } } },
  };

  return (
    <div className="admin-page">
      <div className="stats-grid">
        {statsData.map((item, i) => (
          <StatCard key={i} title={item.title} value={item.value} subtitle={item.subtitle} />
        ))}
      </div>
      <div className="overview-grid">
        <div className="chart-box">
          <h3 className="admin-section-heading">Monthly Bidding Activity</h3>
          <div className="chart-container">
            <Bar data={monthlyBidData} options={chartOpts} />
          </div>
        </div>
        <div className="chart-box">
          <h3 className="admin-section-heading">Auction Categories</h3>
          <div className="chart-container">
            <Doughnut data={auctionCategoryData} options={{ ...chartOpts, cutout: "0%", layout: { padding: { top: 10, bottom: 30 } } }} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;