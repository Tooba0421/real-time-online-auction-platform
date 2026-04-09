import React, { useMemo, useState } from "react";
import "../styles/sellerLayout.css";
import "../styles/sellerHome.css";

import StatCard from "../../common/components/StatCard";
import { Bar, Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend
);

/* ================= Auction Data ================= */

const initialAuctions = [
  { id: 1, name: "Antique Vase", highestBid: 120, bids: 8, status: "live" },
  { id: 2, name: "Vintage Clock", highestBid: 450, bids: 15, status: "paused" },
  { id: 3, name: "Luxury Watch", highestBid: 2800, bids: 20, status: "live" },

  // Ended Auctions (latest first)
  { id: 4, name: "Rare Painting", highestBid: 5200, bids: 32, status: "ended", endedAt: "2026-02-18" },
  { id: 5, name: "Classic Car Model", highestBid: 3400, bids: 21, status: "ended", endedAt: "2026-02-12" },
  { id: 6, name: "Watch", highestBid: 4500, bids: 23, status: "ended", endedAt: "2026-05-12" },
  { id: 7, name: "Necklace", highestBid: 9700, bids: 43, status: "ended", endedAt: "2026-08-12" },
  { id: 8, name: "Diamond Ring", highestBid: 6100, bids: 28, status: "ended", endedAt: "2026-02-05" },
];

/* ================= Mock Bids Per Day ================= */
const bidsPerDayData = [20, 35, 55, 40, 25, 50, 30];

const SellerHome = () => {
  const [auctions] = useState(initialAuctions);

  /* ================= Derived Stats ================= */
  const stats = useMemo(() => {
    const activeListings = auctions.filter(a => a.status === "live").length;
    const totalBids = auctions.reduce((sum, a) => sum + a.bids, 0);

    const endedAuctions = auctions.filter(a => a.status === "ended");
    const totalRevenue = endedAuctions.reduce((sum, a) => sum + a.highestBid, 0);
    const pendingPayout = totalRevenue * 0.1;

    return { activeListings, totalBids, totalRevenue, pendingPayout };
  }, [auctions]);

  /* ================= Latest 3 Ended Auctions ================= */
  const latestEnded = useMemo(() => {
    return auctions
      .filter(a => a.status === "ended")
      .sort((a, b) => new Date(b.endedAt) - new Date(a.endedAt))
      .slice(0, 5);
  }, [auctions]);

  /* ================= Charts ================= */

  const bidsChartData = {
    labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    datasets: [
      {
        label: "Bids Per Day",
        data: bidsPerDayData,
        backgroundColor: "#4e73df",
        borderRadius: 6,
      },
    ],
  };

  const revenueChartData = {
    labels: latestEnded.map(a => a.name),
    datasets: [
      {
        label: "Revenue ($)",
        data: latestEnded.map(a => a.highestBid),
        borderColor: "#1cc88a",
        backgroundColor: "rgba(28,200,138,0.2)",
        fill: true,
        tension: 0.4,
        pointRadius: 4,
      },
    ],
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

  /* ================= STAT CARDS DATA ================= */
  const statsData = [
    {
      title: "Active Listings",
      value: stats.activeListings,
      subtitle: "Currently live auctions",
    },
    {
      title: "Total Bids",
      value: stats.totalBids,
      subtitle: "Across all auctions",
    },
    {
      title: "Total Revenue",
      value: `PKR ${stats.totalRevenue.toLocaleString()}`,
      subtitle: "From ended auctions",
    },
    {
      title: "Pending Payout",
      value: `PKR ${stats.pendingPayout.toLocaleString()}`,
      subtitle: "10% platform commission",
    },
  ];

  /* ================= Top Performing Live Auction ================= */
  const topAuction = [...auctions]
    .filter(a => a.status === "live")
    .sort((a, b) => b.highestBid - a.highestBid)[0];

  return (
    <div className="seller-page">

      {/* ===== Stat Cards ===== */}
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

      {/* ===== Top Live Auction ===== */}
      {topAuction && (
        <div className="top-auction-card">
          <h3>🏆 Top Live Auction</h3>
          <p><strong>{topAuction.name}</strong></p>
          <p>Highest Bid: ${topAuction.highestBid}</p>
          <p>Total Bids: {topAuction.bids}</p>
        </div>
      )}

      {/* ===== Charts ===== */}
      <div className="overview-grid">
        <div className="chart-box">
          <h3 className="admin-section-heading">Bids Per Day</h3>
          <div className="chart-container">
            <Bar data={bidsChartData} options={lineOptions} />
          </div>
        </div>

        <div className="chart-box">
          <h3 className="admin-section-heading">Completed Auctions Revenue</h3>
          <div className="chart-container">
            <Line data={revenueChartData} options={lineOptions} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SellerHome;