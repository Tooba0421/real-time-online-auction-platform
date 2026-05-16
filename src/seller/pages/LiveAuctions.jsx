import { useState, useEffect, useMemo } from "react";
import { supabase } from "../../supabase/supabase";
import { useAuthContext } from "../../context/AuthContext";
import {
  pauseAuction,
  resumeAuction,
  closeAuction,
  getTimeRemaining
} from "../../utils/auctionHelper";
import toast from "react-hot-toast";
import StatCard from "../../common/components/StatCard";
import StatusBadge from "../../common/components/StatusBadge";
import ActionButton from "../../common/components/ActionButton";
import "../styles/sellerLayout.css";
import "../styles/liveAuctions.css";

const LiveAuctions = () => {

  const { user } = useAuthContext();

  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [timers, setTimers] = useState({});

  useEffect(() => {
    if (!user) return;
    fetchAuctions();
  }, [user]);

  // Countdown timer — updates every second
  useEffect(() => {
    const interval = setInterval(() => {
      setTimers(prev => {
        const updated = {};
        auctions.forEach(a => {
          if (a.status === 'live') {
            updated[a.id] = getTimeRemaining(a.end_time);
          }
        });
        return updated;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [auctions]);

  // Realtime subscription for bid updates
  useEffect(() => {
    if (!user) return;

    const subscription = supabase
      .channel('seller-live-auctions')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'auctions'
      }, () => {
        fetchAuctions();
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'bids'
      }, () => {
        fetchAuctions();
      })
      .subscribe();

    return () => subscription.unsubscribe();
  }, [user]);

  const fetchAuctions = async () => {
    try {
      // Get seller id
      const { data: sellerData } = await supabase
        .from('sellers')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!sellerData) return;

      const { data, error } = await supabase
        .from('auctions')
        .select(`
          *,
          products ( title, category ),
          bids ( id )
        `)
        .eq('seller_id', sellerData.id)
        .in('status', ['live', 'paused'])
        .order('created_at', { ascending: false });

      if (error) {
        toast.error("Error fetching auctions");
        console.error(error);
        return;
      }

      // Initialize timers
      const initialTimers = {};
      data?.forEach(a => {
        if (a.status === 'live') {
          initialTimers[a.id] = getTimeRemaining(a.end_time);
        }
      });
      setTimers(initialTimers);
      setAuctions(data || []);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePause = async (auction) => {
    try {
      setProcessing(auction.id);
      await pauseAuction(auction.id, auction.products?.title);
      toast.success("Auction paused");
      fetchAuctions();
    } catch (err) {
      toast.error(err.message || "Failed to pause auction");
    } finally {
      setProcessing(null);
    }
  };

  const handleResume = async (auction) => {
    try {
      setProcessing(auction.id);
      await resumeAuction(auction.id, auction.paused_by);
      toast.success("Auction resumed");
      fetchAuctions();
    } catch (err) {
      toast.error(err.message || "Failed to resume auction");
    } finally {
      setProcessing(null);
    }
  };

  const handleClose = async (auction) => {
    if (!window.confirm(`Close auction for "${auction.products?.title}"?`)) return;
    try {
      setProcessing(auction.id);
      await closeAuction(auction.id);
      toast.success("Auction closed");
      fetchAuctions();
    } catch (err) {
      toast.error("Failed to close auction");
    } finally {
      setProcessing(null);
    }
  };

  const filteredAuctions = auctions.filter(a => {
    const title = a.products?.title?.toLowerCase() || '';
    const matchesSearch =
      title.includes(search.toLowerCase()) ||
      a.id.toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      filterStatus === "all" || a.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  // Stats
  const stats = useMemo(() => {
    const liveCount = auctions.filter(a => a.status === 'live').length;
    const pausedCount = auctions.filter(a => a.status === 'paused').length;
    const totalBids = auctions.reduce((sum, a) => sum + (a.bids?.length || 0), 0);
    const highestLiveBid = Math.max(
      ...auctions.filter(a => a.status === 'live').map(a => a.highest_bid || 0),
      0
    );
    return { liveCount, pausedCount, totalBids, highestLiveBid };
  }, [auctions]);

  const statsData = [
    { title: "Live Auctions", value: loading ? "..." : stats.liveCount, subtitle: "Currently running" },
    { title: "Paused Auctions", value: loading ? "..." : stats.pausedCount, subtitle: "Temporarily stopped" },
    { title: "Total Bids", value: loading ? "..." : stats.totalBids, subtitle: "Across live auctions" },
    { title: "Highest Live Bid", value: loading ? "..." : `PKR ${stats.highestLiveBid.toLocaleString()}`, subtitle: "Top performing auction" },
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

        {loading ? (
          <div className="loading-state">Loading auctions...</div>
        ) : (
          <div className="table-wrapper">
            <table className="seller-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Highest Bid</th>
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
                    <td colSpan="8" className="no-data">No auctions found</td>
                  </tr>
                ) : (
                  filteredAuctions.map(a => (
                    <tr key={a.id}>
                      <td>{a.products?.title || '—'}</td>
                      <td>{a.products?.category || '—'}</td>
                      <td>PKR {a.highest_bid?.toLocaleString() || 0}</td>
                      <td>{a.bids?.length || 0}</td>
                      <td>
                        {a.status === 'live'
                          ? (timers[a.id]?.formatted || '—')
                          : '—'
                        }
                      </td>
                      <td>{a.paused_by || '—'}</td>
                      <td>
                        <StatusBadge
                          label={a.status.charAt(0).toUpperCase() + a.status.slice(1)}
                          type={a.status}
                        />
                      </td>
                      <td className="actions">
                        {a.status === 'live' && (
                          <>
                            <ActionButton
                              label="Pause"
                              variant="secondary"
                              onClick={() => handlePause(a)}
                              disabled={processing === a.id}
                            />
                            <ActionButton
                              label="Close"
                              variant="danger"
                              onClick={() => handleClose(a)}
                              disabled={processing === a.id}
                            />
                          </>
                        )}
                        {a.status === 'paused' && (
                          <>
                            {a.paused_by !== 'admin' && (
                              <ActionButton
                                label="Resume"
                                variant="success"
                                onClick={() => handleResume(a)}
                                disabled={processing === a.id}
                              />
                            )}
                            {a.paused_by === 'admin' && (
                              <span className="admin-paused-note">
                                Paused by admin
                              </span>
                            )}
                            <ActionButton
                              label="Close"
                              variant="danger"
                              onClick={() => handleClose(a)}
                              disabled={processing === a.id}
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
        )}
      </div>
    </div>
  );
};

export default LiveAuctions;