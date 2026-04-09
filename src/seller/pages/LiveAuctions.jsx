import { useState, useEffect, useRef, useMemo } from "react";
import StatCard from "../../common/components/StatCard";

import "../styles/sellerLayout.css";
import "../styles/liveAuctions.css";

import StatusBadge from "../../common/components/StatusBadge";
import ActionButton from "../../common/components/ActionButton";

// ===== Sample Auctions =====
const initialAuctions = [
  { id: "LA-1", name: "Antique Vase", highestBid: 120, bids: 8, timeRemaining: 750, status: "live" },
  { id: "LA-2", name: "Vintage Clock", highestBid: 450, bids: 15, timeRemaining: 310, status: "live" },
  { id: "LA-3", name: "Luxury Watch", highestBid: 2800, bids: 20, timeRemaining: 2700, status: "live" },
  { id: "LA-4", name: "Classic Painting", highestBid: 1500, bids: 12, timeRemaining: 1800, status: "paused" },
];

// ===== Helper =====
const formatTime = (seconds) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, "0")}:${m
    .toString()
    .padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};

const LiveAuctions = () => {
  const [auctions, setAuctions] = useState(initialAuctions);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  const intervals = useRef({});

  /* ================= FIXED TIMER (Single Interval System) ================= */
  useEffect(() => {
  const timer = setInterval(() => {
    setAuctions(prev =>
      prev
        .map(a => {
          if (a.status !== "live") return a;

          if (a.timeRemaining <= 1) {
            return null; // mark for removal
          }

          return { ...a, timeRemaining: a.timeRemaining - 1 };
        })
        .filter(Boolean) // remove ended auctions
    );
  }, 1000);

  return () => clearInterval(timer);
}, []);

  /* ================= Derived Stats (MOVED INSIDE COMPONENT) ================= */
  const stats = useMemo(() => {
  const liveCount = auctions.filter(a => a.status === "live").length;
  const pausedCount = auctions.filter(a => a.status === "paused").length;

  const totalBids = auctions.reduce((sum, a) => sum + a.bids, 0);

  const highestLiveBid = Math.max(
    ...auctions.filter(a => a.status === "live").map(a => a.highestBid),
    0
  );

  return { liveCount, pausedCount, totalBids, highestLiveBid };
}, [auctions]);

  /* ================= Search + Filter ================= */
  const filteredAuctions = auctions.filter(a => {
    const matchesSearch =
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.id.toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      filterStatus === "all" || a.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  /* ================= Actions ================= */
  const toggleAuctionStatus = (id) => {
    setAuctions(prev =>
      prev.map(a =>
        a.id === id
          ? { ...a, status: a.status === "live" ? "paused" : "live" }
          : a
      )
    );
  };

  const forceCloseAuction = (id) => {
  setAuctions(prev => prev.filter(a => a.id !== id));
};

  /* ================= Charts ================= */
  const statusChartData = {
    labels: ["Live", "Paused", "Ended"],
    datasets: [
      {
        data: [
          stats.liveCount,
          stats.pausedCount,
          stats.endedCount,
        ],
        backgroundColor: ["#22c55e", "#facc15", "#ef4444"],
      },
    ],
  };

  const bidsChartData = {
    labels: auctions.map(a => a.name),
    datasets: [
      {
        label: "Total Bids",
        data: auctions.map(a => a.bids),
        backgroundColor: "#2563EB",
        borderRadius: 6,
      },
    ],
  };

  const statsData = [
    {
      title: "Live Auctions",
      value: stats.liveCount,
      subtitle: "Currently running",
    },
    {
      title: "Paused Auctions",
      value: stats.pausedCount,
      subtitle: "Temporarily stopped",
    },
    {
      title: "Total Bids",
      value: stats.totalBids,
      subtitle: "Across all auctions",
    },
    {
      title: "Highest Live Bid",
      value: `PKR ${stats.highestLiveBid.toLocaleString()}`,
      subtitle: "Top performing auction",
    },
  ];

  return (
    <div className="seller-page">

      {/* ===== Stats ===== */}
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

      <div className="seller-section">
        <h3 className="seller-section-heading">Live Auctions</h3>

        <div className="page-controls">
          <input
            type="text"
            placeholder="Search by Auction ID or Item Name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="live">Live</option>
            <option value="paused">Paused</option>
          </select>
        </div>

        <div className="table-wrapper">
          <table className="seller-table">
            <thead>
              <tr>
                <th>Auction ID</th>
                <th>Item Name</th>
                <th>Highest Bid ($)</th>
                <th>Bids</th>
                <th>Time Remaining</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredAuctions.length === 0 ? (
                <tr>
                  <td colSpan="7" className="no-data">
                    No auctions found
                  </td>
                </tr>
              ) : (
                filteredAuctions.map(a => (
                  <tr key={a.id}>
                    <td>{a.id}</td>
                    <td>{a.name}</td>
                    <td>{a.highestBid.toLocaleString()}</td>
                    <td>{a.bids}</td>
                    <td>{formatTime(a.timeRemaining)}</td>
                    <td>
                      <StatusBadge label={a.status} type={a.status} />
                    </td>
                    <td className="actions">
                      {a.status !== "ended" && (
                        <>
                          <ActionButton
                            label={a.status === "live" ? "Pause" : "Resume"}
                            variant="secondary"
                            onClick={() => toggleAuctionStatus(a.id)}
                          />
                          <ActionButton
                            label="Close"
                            variant="danger"
                            onClick={() => forceCloseAuction(a.id)}
                          />
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default LiveAuctions;