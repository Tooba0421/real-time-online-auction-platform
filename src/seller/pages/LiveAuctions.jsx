import { useState, useEffect, useMemo } from "react";
import { useSellerContext } from "../../context/SellerContext";
import {
  pauseAuction, resumeAuction, closeAuction, getTimeRemaining,
} from "../../utils/auctionHelper";
import toast from "react-hot-toast";
import StatCard from "../../common/components/StatCard";
import StatusBadge from "../../common/components/StatusBadge";
import ActionButton from "../../common/components/ActionButton";
import "../styles/sellerLayout.css";
import "../styles/liveAuctions.css";

const LiveAuctions = () => {
  // ✅ Read from shared context — data already loaded, no extra fetch
  const { auctions, auctionsLoading, updateAuctionLocally, refetchAuctions } =
    useSellerContext();

  const [processing, setProcessing] = useState(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [timers, setTimers] = useState({});

  // Only live + paused auctions for this page
  const liveAndPaused = useMemo(
    () => auctions.filter((a) => ["live", "paused"].includes(a.status)),
    [auctions]
  );

  // ── Countdown timer (client-side, no network) ──────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      setTimers(() => {
        const updated = {};
        liveAndPaused.forEach((a) => {
          if (a.status === "live") {
            updated[a.id] = getTimeRemaining(a.end_time);
          }
        });
        return updated;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [liveAndPaused]);

  // ── Actions — optimistic local update first, then Supabase ────────
  const handlePause = async (auction) => {
    try {
      setProcessing(auction.id);
      // Optimistic update — UI changes instantly
      updateAuctionLocally(auction.id, { status: "paused", paused_by: "seller" });
      await pauseAuction(auction.id, auction.products?.title);
      toast.success("Auction paused");
    } catch (err) {
      // Rollback on failure
      updateAuctionLocally(auction.id, { status: "live", paused_by: null });
      toast.error(err.message || "Failed to pause auction");
    } finally {
      setProcessing(null);
    }
  };

  const handleResume = async (auction) => {
    try {
      setProcessing(auction.id);
      updateAuctionLocally(auction.id, { status: "live", paused_by: null });
      await resumeAuction(auction.id, auction.paused_by);
      toast.success("Auction resumed");
    } catch (err) {
      updateAuctionLocally(auction.id, {
        status: "paused", paused_by: auction.paused_by,
      });
      toast.error(err.message || "Failed to resume auction");
    } finally {
      setProcessing(null);
    }
  };

  const handleClose = async (auction) => {
    if (!window.confirm(`Close auction for "${auction.products?.title}"?`)) return;
    try {
      setProcessing(auction.id);
      updateAuctionLocally(auction.id, { status: "ended" });
      await closeAuction(auction.id);
      toast.success("Auction closed");
    } catch (err) {
      updateAuctionLocally(auction.id, { status: auction.status });
      toast.error("Failed to close auction");
    } finally {
      setProcessing(null);
    }
  };

  const filteredAuctions = liveAndPaused.filter((a) => {
    const title = a.products?.title?.toLowerCase() || "";
    const matchesSearch =
      title.includes(search.toLowerCase()) ||
      a.id.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === "all" || a.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const stats = useMemo(() => ({
    liveCount: liveAndPaused.filter((a) => a.status === "live").length,
    pausedCount: liveAndPaused.filter((a) => a.status === "paused").length,
    totalBids: liveAndPaused.reduce((sum, a) => sum + (a.bids?.length || 0), 0),
    highestLiveBid: Math.max(
      ...liveAndPaused.filter((a) => a.status === "live").map((a) => a.highest_bid || 0),
      0
    ),
  }), [liveAndPaused]);

  const statsData = [
    { title: "Live Auctions",    value: auctionsLoading ? "..." : stats.liveCount,   subtitle: "Currently running" },
    { title: "Paused Auctions",  value: auctionsLoading ? "..." : stats.pausedCount, subtitle: "Temporarily stopped" },
    { title: "Total Bids",       value: auctionsLoading ? "..." : stats.totalBids,   subtitle: "Across live auctions" },
    {
      title: "Highest Live Bid",
      value: auctionsLoading
        ? "..."
        : stats.highestLiveBid > 0
          ? `PKR ${stats.highestLiveBid.toLocaleString()}`
          : "No bids yet",
      subtitle: "Top performing auction",
    },
  ];

  return (
    <div className="seller-page">

      <div className="stats-grid">
        {statsData.map((item, index) => (
          <StatCard key={index} title={item.title} value={item.value} subtitle={item.subtitle} />
        ))}
      </div>

      <div className="seller-section">
        <h3 className="seller-section-heading">Live & Paused Auctions</h3>

        <div className="page-controls">
          <input
            type="text"
            placeholder="Search by product name or auction ID"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="all">All Status</option>
            <option value="live">Live</option>
            <option value="paused">Paused</option>
          </select>
        </div>

        {auctionsLoading ? (
          <div className="loading-state">Loading auctions...</div>
        ) : (
          <div className="table-wrapper">
            <table className="seller-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Current Highest Bid</th>
                  <th>Total Bids</th>
                  <th>Time Remaining</th>
                  <th>Paused By</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAuctions.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="no-data">No live or paused auctions found</td>
                  </tr>
                ) : (
                  filteredAuctions.map((a) => (
                    <tr key={a.id}>
                      <td>{a.products?.title || "—"}</td>
                      <td>{a.products?.category || "—"}</td>
                      <td>
                        {a.highest_bid && a.highest_bid > 0
                          ? `PKR ${a.highest_bid.toLocaleString()}`
                          : <span style={{ color: "#999", fontSize: "13px" }}>No bids yet</span>
                        }
                      </td>
                      <td>{a.bids?.length || 0}</td>
                      <td>
                        {a.status === "live"
                          ? (timers[a.id]?.formatted || "calculating...")
                          : "—"
                        }
                      </td>
                      <td>{a.paused_by || "—"}</td>
                      <td>
                        <StatusBadge
                          label={a.status.charAt(0).toUpperCase() + a.status.slice(1)}
                          type={a.status}
                        />
                      </td>
                      <td className="actions">
                        {a.status === "live" && (
                          <>
                            <ActionButton label="Pause" variant="secondary"
                              onClick={() => handlePause(a)} disabled={processing === a.id} />
                            <ActionButton label="Close" variant="danger"
                              onClick={() => handleClose(a)} disabled={processing === a.id} />
                          </>
                        )}
                        {a.status === "paused" && (
                          <>
                            {a.paused_by !== "admin" && (
                              <ActionButton label="Resume" variant="success"
                                onClick={() => handleResume(a)} disabled={processing === a.id} />
                            )}
                            {a.paused_by === "admin" && (
                              <span className="admin-paused-note">Paused by admin</span>
                            )}
                            <ActionButton label="Close" variant="danger"
                              onClick={() => handleClose(a)} disabled={processing === a.id} />
                          </>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveAuctions;