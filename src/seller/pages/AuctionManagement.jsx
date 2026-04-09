import React, { useState, useMemo } from "react";
import { Doughnut } from "react-chartjs-2";
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

import "../styles/sellerLayout.css";
import "../styles/auctionManagement.css";

import StatCard from "../../common/components/StatCard";
import StatusBadge from "../../common/components/StatusBadge";
import ActionButton from "../../common/components/ActionButton";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

/* ================= Sample Data ================= */

const initialAuctions = [
  {
    id: "AUC-101",
    name: "Vintage Wooden Chair",
    category: "Furniture",
    startPrice: 1000,
    highestBid: 260,
    bids: 12,
    status: "live",
    approval: "approved",
  },
  {
    id: "AUC-102",
    name: "Antique Table Lamp",
    category: "Home Decor",
    startPrice: 800,
    highestBid: 0,
    bids: 0,
    status: "scheduled",
    approval: "pending",
  },
  {
    id: "AUC-103",
    name: "Luxury Sofa Set",
    category: "Living Room",
    startPrice: 5000,
    highestBid: 980,
    bids: 30,
    status: "ended",
    approval: "approved",
  },
  {
    id: "AUC-104",
    name: "Metallic Side Table",
    category: "Metal Furniture",
    startPrice: 1500,
    highestBid: 0,
    bids: 0,
    status: "rejected",
    approval: "rejected",
    reason: "Low quality product images provided.",
  },
];

const AuctionManagement = ({ openCreateAuction }) => {
  const [auctions, setAuctions] = useState(initialAuctions);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showReason, setShowReason] = useState(null);

  /* ================= ACTION LOGIC ================= */

  const togglePause = (id) => {
    setAuctions(prev =>
      prev.map(a =>
        a.id === id
          ? { ...a, status: a.status === "live" ? "paused" : "live" }
          : a
      )
    );
  };

  const closeAuction = (id) => {
    setAuctions(prev =>
      prev.map(a =>
        a.id === id ? { ...a, status: "ended" } : a
      )
    );
  };

  const cancelAuction = (id) => {
    setAuctions(prev =>
      prev.map(a =>
        a.id === id ? { ...a, status: "cancelled" } : a
      )
    );
  };

  /* ================= FILTER ================= */

  const filteredAuctions = auctions.filter(a => {
    const matchesSearch =
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.id.toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      filterStatus === "all" || a.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  /* ================= UPDATED STATS ================= */

  const stats = useMemo(() => {
    return {
      total: auctions.length,
      live: auctions.filter(a => a.status === "live").length,
      pending: auctions.filter(a => a.approval === "pending").length,
      rejected: auctions.filter(a => a.approval === "rejected").length,
    };
  }, [auctions]);

  const statsData = [
    { title: "Total Auctions", value: stats.total, subtitle: "All created auctions" },
    { title: "Live Auctions", value: stats.live, subtitle: "Currently running" },
    { title: "Pending Approval", value: stats.pending, subtitle: "Awaiting admin review" },
    { title: "Rejected Auctions", value: stats.rejected, subtitle: "Declined by admin" },
  ];

  /* ================= CHART DATA ================= */

  const statusChartData = {
    labels: ["Live", "Paused", "Scheduled", "Ended", "Rejected"],
    datasets: [
      {
        data: [
          auctions.filter(a => a.status === "live").length,
          auctions.filter(a => a.status === "paused").length,
          auctions.filter(a => a.status === "scheduled").length,
          auctions.filter(a => a.status === "ended").length,
          auctions.filter(a => a.status === "rejected").length,
        ],
        backgroundColor: [
          "#22c55e",
          "#facc15",
          "#3b82f6",
          "#6b7280",
          "#ef4444",
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

      {/* ================= STATS ================= */}
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

      {/* ================= CREATE BUTTON (RIGHT) ================= */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "1rem" }}>
        <button className="create-btn" onClick={openCreateAuction}>
          + Create Auction
        </button>
      </div>

      {/* ================= TABLE ================= */}
      <div className="seller-section">
        <h3 className="seller-section-heading">All Auctions</h3>

        <div className="page-controls">
          <input
            type="text"
            placeholder="Search by name, email, ID or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="live">Live</option>
            <option value="scheduled">Scheduled</option>
            <option value="paused">Paused</option>
            <option value="ended">Ended</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div className="table-wrapper">
          <table className="seller-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Category</th>
                <th>Start Price</th>
                <th>Highest Bid</th>
                <th>Bids</th>
                <th>Status</th>
                <th>Approval</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredAuctions.map(a => (
                <tr key={a.id}>
                  <td>{a.id}</td>
                  <td>{a.name}</td>
                  <td>{a.category}</td>
                  <td>{a.startPrice.toLocaleString()}</td>
                  <td>{a.highestBid.toLocaleString()}</td>
                  <td>{a.bids}</td>

                  <td>
                    <StatusBadge label={a.status} type={a.status} />
                  </td>

                  <td>
                    <StatusBadge label={a.approval} type={a.approval} />
                  </td>

                  <td className="actions">

                    {(a.status === "live" || a.status === "paused") && (
                      <>
                        <ActionButton
                          label={a.status === "live" ? "Pause" : "Resume"}
                          variant="success"
                          onClick={() => togglePause(a.id)}
                        />
                        <ActionButton
                          label="Close"
                          variant="danger"
                          onClick={() => closeAuction(a.id)}
                        />
                        <ActionButton
                          label="Edit"
                          variant="secondary"
                        />
                      </>
                    )}

                    {a.status === "ended" && (
                      <ActionButton
                        label="View Result"
                        variant="secondary"
                      />
                    )}

                    {a.status === "scheduled" && (
                      <>
                        <ActionButton
                          label="Cancel"
                          variant="danger"
                          onClick={() => cancelAuction(a.id)}
                        />
                        <ActionButton
                          label="Edit"
                          variant="secondary"
                        />
                      </>
                    )}

                    {a.status === "rejected" && (
                      <ActionButton
                        label="View Reason"
                        variant="danger"
                        onClick={() => setShowReason(a.reason)}
                      />
                    )}

                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================= CHART ================= */}
      <div className="overview-grid chart-space">
        <div className="chart-box">
          <h3 className="admin-section-heading">Auction Status Overview</h3>
          <div className="chart-container">
            <Doughnut data={statusChartData} options={doughnutOptions} />
          </div>
        </div>
      </div>

      {/* ================= REASON MODAL ================= */}
      {showReason && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h3>Rejection Reason</h3>
            <p>{showReason}</p>
            <button
              className="create-btn"
              onClick={() => setShowReason(null)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuctionManagement;