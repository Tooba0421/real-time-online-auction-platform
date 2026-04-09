import { useMemo } from "react";
import { Bar, Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

import StatCard from "../../common/components/StatCard";
import "../styles/home.css";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

const Home = () => {

  /* ================= CORE NUMBERS (Backend Ready) ================= */
  const totalUsers = 1245;
  const totalSellers = 320;
  const pendingRequests = 27;
  const totalRevenue = 3800000; // PKR
  const completedAuctions = 320;

  /* ================= CHART DATA ================= */

  const monthlyBidData = useMemo(() => ({
    labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    datasets: [
      {
        label: "Bids Placed",
        data: [1200, 1500, 1800, 1300, 2000, 2500, 2200, 2100, 1900, 2300, 2400, 2600],
        backgroundColor: "#4e73df",
      },
      {
        label: "New Auctions",
        data: [50, 60, 55, 40, 70, 80, 75, 65, 60, 85, 90, 95],
        backgroundColor: "#1cc88a",
      },
    ],
  }), []);

  const auctionCategoryData = useMemo(() => ({
    labels: ["Electronics", "Antiques", "Artwork", "Furniture", "Jewelry", 
      "Interiors", "Music,Movies & Cameras", "Coins & Stamps", "Fashion", "Toys & Models", "Luxury Watches"],
    datasets: [
      {
        data: [30, 12, 15, 8, 20, 5, 25, 31, 24, 13, 16],
        backgroundColor: ["#4e73df", "#1cc88a", "#36b9cc", "#f6c23e", "#e74a3b",
          "#19686d", "#1cc825", "#cc36b1", "#d6cef7", "#13492b", "#e18d06", ],
      },
    ],
  }), []);

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "0%",
    plugins: {
      legend: {
        position: "top",
        align: "center",
        labels: {
          boxWidth: 30,
          padding: 18,
        },
      },
    },
  };

  /* ================= LINE OPTIONS ================= */
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

  /* ================= DERIVED VALUES ================= */

  const totalBids = monthlyBidData.datasets[0].data.reduce((a, b) => a + b, 0);
  const totalAuctions = monthlyBidData.datasets[1].data.reduce((a, b) => a + b, 0);

  const mostPopularCategoryIndex = auctionCategoryData.datasets[0].data.indexOf(
    Math.max(...auctionCategoryData.datasets[0].data)
  );
  const mostPopularCategory =
    auctionCategoryData.labels[mostPopularCategoryIndex];

  const auctionSuccessRate =
    totalAuctions > 0
      ? ((completedAuctions / totalAuctions) * 100).toFixed(1)
      : 0;




  /* ================= STAT CARDS ================= */

  const statsData = [
    {
      title: "Total Registered Users",
      value: totalUsers.toLocaleString(),
      subtitle: "All platform users",
    },
    {
      title: "Total Sellers",
      value: totalSellers.toLocaleString(),
      subtitle: "Verified sellers",
    },
    {
      title: "Total Auctions",
      value: totalAuctions.toLocaleString(),
      subtitle: "Created this year",
    },
    {
      title: "Completed Auctions",
      value: completedAuctions.toLocaleString(),
      subtitle: "Successfully closed",
    },
    {
      title: "Total Bids Placed",
      value: totalBids.toLocaleString(),
      subtitle: "Yearly bidding activity",
    },
    {
      title: "Auction Success Rate",
      value: `${auctionSuccessRate}%`,
      subtitle: "Completed vs total auctions",
    },
    {
      title: "Total Revenue",
      value: `PKR ${totalRevenue.toLocaleString()}`,
      subtitle: "Platform earnings",
    },
    {
      title: "Pending Requests",
      value: pendingRequests.toLocaleString(),
      subtitle: "Awaiting approval",
    },
  ];

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

      {/* ================= CHARTS ================= */}
      
        <div className="overview-grid">
          <div className="chart-box">
            <h3 className="admin-section-heading">Monthly Bidding Activity</h3>
            <div className="chart-container">
              <Bar data={monthlyBidData} options={lineOptions} />
            </div>
          </div>

          <div className="chart-box">
            <h3 className="admin-section-heading">Auction Categories</h3>
            <div className="chart-container">
              <Doughnut data={auctionCategoryData} options={doughnutOptions} />
            </div>
          </div>
        
      </div>
    </div>
  );
};

export default Home;
