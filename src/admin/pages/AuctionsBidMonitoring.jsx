import { useState, useEffect } from "react";
import { supabase } from "../../supabase/supabase";
import { useAuthContext } from "../../context/AuthContext";
import toast from "react-hot-toast";
import StatusBadge from "../../common/components/StatusBadge";
import ActionButton from "../../common/components/ActionButton";
import StatCard from "../../common/components/StatCard";
import "../styles/adminLayout.css";
import "../styles/auctionsBidMonitoring.css";

const AuctionBidMonitoring = () => {

  const { user } = useAuthContext();

  const [auctions, setAuctions] = useState([]);
  const [suspiciousBids, setSuspiciousBids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  useEffect(() => {
    fetchData();

    // Realtime subscription for bids
    const subscription = supabase
      .channel('admin-bids-monitor')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'bids'
      }, () => {
        fetchSuspiciousBids();
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'auctions'
      }, () => {
        fetchAuctions();
      })
      .subscribe();

    return () => subscription.unsubscribe();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      await Promise.all([fetchAuctions(), fetchSuspiciousBids()]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAuctions = async () => {
    const { data, error } = await supabase
      .from('auctions')
      .select(`
        *,
        products (
          title,
          reserved_price
        ),
        sellers (
          business_name,
          profiles ( name )
        )
      `)
      .in('status', ['live', 'scheduled', 'paused'])
      .order('created_at', { ascending: false });

    if (error) {
      console.error(error);
      toast.error("Error fetching auctions");
      return;
    }

    setAuctions(data || []);
  };

  const fetchSuspiciousBids = async () => {
    const { data, error } = await supabase
      .from('bids')
      .select(`
        *,
        auctions (
          id,
          products ( title )
        ),
        buyers (
          id,
          profiles ( name )
        )
      `)
      .eq('is_suspicious', true)
      .eq('status', 'active')
      .order('bid_time', { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    setSuspiciousBids(data || []);
  };

  // Pause auction (admin)
  const handlePause = async (auction) => {
    try {
      setProcessing(auction.id);

      const { error } = await supabase
        .from('auctions')
        .update({
          status: 'paused',
          paused_by: 'admin'
        })
        .eq('id', auction.id);

      if (error) {
        toast.error("Error pausing auction");
        console.error(error);
        return;
      }

      // Notify seller
      await supabase
        .from('notifications')
        .insert({
          user_id: auction.sellers?.profiles?.id || auction.seller_id,
          title: 'Auction Paused by Admin',
          message: `Your auction for "${auction.products?.title}" has been paused by admin.`,
          type: 'auction_ended',
          notification_for: 'seller',
          is_read: false
        });

      toast.success("Auction paused");
      fetchAuctions();

    } catch (err) {
      console.error(err);
      toast.error("Something went wrong");
    } finally {
      setProcessing(null);
    }
  };

  // Resume auction (admin only)
  const handleResume = async (auction) => {
    try {
      setProcessing(auction.id);

      const { error } = await supabase
        .from('auctions')
        .update({
          status: 'live',
          paused_by: null
        })
        .eq('id', auction.id);

      if (error) {
        toast.error("Error resuming auction");
        console.error(error);
        return;
      }

      // Notify seller
      await supabase
        .from('notifications')
        .insert({
          user_id: auction.sellers?.profiles?.id || auction.seller_id,
          title: 'Auction Resumed by Admin',
          message: `Your auction for "${auction.products?.title}" has been resumed by admin.`,
          type: 'auction_ended',
          notification_for: 'seller',
          is_read: false
        });

      toast.success("Auction resumed");
      fetchAuctions();

    } catch (err) {
      console.error(err);
      toast.error("Something went wrong");
    } finally {
      setProcessing(null);
    }
  };

  // Force close auction
  const handleForceClose = async (auction) => {
    if (!window.confirm(`Force close auction for "${auction.products?.title}"?`)) return;

    try {
      setProcessing(auction.id);

      const { error } = await supabase
        .from('auctions')
        .update({ status: 'ended' })
        .eq('id', auction.id);

      if (error) {
        toast.error("Error closing auction");
        console.error(error);
        return;
      }

      // Notify seller
      await supabase
        .from('notifications')
        .insert({
          user_id: auction.sellers?.profiles?.id || auction.seller_id,
          title: 'Auction Force Closed by Admin',
          message: `Your auction for "${auction.products?.title}" has been closed by admin.`,
          type: 'auction_ended',
          notification_for: 'seller',
          is_read: false
        });

      toast.success("Auction force closed");
      fetchAuctions();

    } catch (err) {
      console.error(err);
      toast.error("Something went wrong");
    } finally {
      setProcessing(null);
    }
  };

  // Dismiss suspicious bid
  const handleDismissBid = async (bid) => {
    try {
      setProcessing(bid.id);

      const { error } = await supabase
        .from('bids')
        .update({ is_suspicious: false })
        .eq('id', bid.id);

      if (error) {
        toast.error("Error dismissing bid");
        return;
      }

      setSuspiciousBids(prev => prev.filter(b => b.id !== bid.id));
      toast.success("Bid dismissed as safe");

    } catch (err) {
      console.error(err);
      toast.error("Something went wrong");
    } finally {
      setProcessing(null);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('en-PK', {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const filteredAuctions = auctions.filter(auction => {
    const matchesSearch =
      auction.products?.title?.toLowerCase().includes(search.toLowerCase()) ||
      auction.sellers?.profiles?.name?.toLowerCase().includes(search.toLowerCase()) ||
      auction.sellers?.business_name?.toLowerCase().includes(search.toLowerCase()) ||
      auction.id?.toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      filterStatus === "all" || auction.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  // Stats
  const liveCount = auctions.filter(a => a.status === 'live').length;
  const pausedCount = auctions.filter(a => a.status === 'paused').length;
  const scheduledCount = auctions.filter(a => a.status === 'scheduled').length;

  const statsData = [
    { title: "Live Auctions", value: loading ? "..." : liveCount, subtitle: "Currently active" },
    { title: "Scheduled", value: loading ? "..." : scheduledCount, subtitle: "Upcoming auctions" },
    { title: "Paused", value: loading ? "..." : pausedCount, subtitle: "On hold" },
    { title: "Suspicious Bids", value: loading ? "..." : suspiciousBids.length, subtitle: "Flagged for review" },
  ];

  return (
    <div className="admin-page">

      {/* STAT CARDS */}
      <div className="stats-grid">
        {statsData.map((item, index) => (
          <StatCard key={index} title={item.title} value={item.value} subtitle={item.subtitle} />
        ))}
      </div>

      {/* AUCTIONS TABLE */}
      <div className="admin-section">
        <h3 className="admin-section-heading">Active Auctions</h3>

        <div className="admin-controls">
          <input
            type="text"
            placeholder="Search by product, seller, or auction ID"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="all">All Status</option>
            <option value="live">Live</option>
            <option value="scheduled">Scheduled</option>
            <option value="paused">Paused</option>
          </select>
        </div>

        {loading ? (
          <div className="loading-state">Loading auctions...</div>
        ) : (
          <div className="table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Seller</th>
                  <th>Current Bid</th>
                  <th>Min Increment</th>
                  <th>Reserve Met</th>
                  <th>Status</th>
                  <th>Start Time</th>
                  <th>End Time</th>
                  <th>Paused By</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAuctions.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="empty-row">No auctions found</td>
                  </tr>
                ) : (
                  filteredAuctions.map(auction => (
                    <tr key={auction.id}>
                      <td>{auction.products?.title || '—'}</td>
                      <td>{auction.sellers?.profiles?.name || '—'}</td>
                      <td>PKR {auction.highest_bid?.toLocaleString() || 0}</td>
                      <td>PKR {auction.min_increment?.toLocaleString()}</td>
                      <td>
                        <StatusBadge
                          label={
                            auction.products?.reserved_price &&
                            auction.highest_bid >= auction.products.reserved_price
                              ? "Met" : "Not Met"
                          }
                          type={
                            auction.products?.reserved_price &&
                            auction.highest_bid >= auction.products.reserved_price
                              ? "approved" : "pending"
                          }
                        />
                      </td>
                      <td>
                        <StatusBadge
                          label={auction.status.charAt(0).toUpperCase() + auction.status.slice(1)}
                          type={auction.status}
                        />
                      </td>
                      <td>{formatDate(auction.start_time)}</td>
                      <td>{formatDate(auction.end_time)}</td>
                      <td>{auction.paused_by || '—'}</td>
                      <td className="actions">
                        {auction.status === 'live' && (
                          <ActionButton
                            label="Pause"
                            variant="secondary"
                            onClick={() => handlePause(auction)}
                            disabled={processing === auction.id}
                          />
                        )}
                        {auction.status === 'paused' && (
                          <ActionButton
                            label="Resume"
                            variant="success"
                            onClick={() => handleResume(auction)}
                            disabled={processing === auction.id}
                          />
                        )}
                        <ActionButton
                          label="Force Close"
                          variant="danger"
                          onClick={() => handleForceClose(auction)}
                          disabled={processing === auction.id}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SUSPICIOUS BIDS TABLE */}
      <div className="admin-section">
        <h3 className="admin-section-heading">Suspicious Bids</h3>
        {loading ? (
          <div className="loading-state">Loading bids...</div>
        ) : (
          <div className="table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Bidder</th>
                  <th>Product</th>
                  <th>Bid Amount</th>
                  <th>Bid Time</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {suspiciousBids.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="empty-row">No suspicious bids found</td>
                  </tr>
                ) : (
                  suspiciousBids.map(bid => (
                    <tr key={bid.id}>
                      <td>{bid.buyers?.profiles?.name || '—'}</td>
                      <td>{bid.auctions?.products?.title || '—'}</td>
                      <td>PKR {bid.bid_amount?.toLocaleString()}</td>
                      <td>{formatDate(bid.bid_time)}</td>
                      <td className="actions">
                        <ActionButton
                          label="Dismiss"
                          variant="secondary"
                          onClick={() => handleDismissBid(bid)}
                          disabled={processing === bid.id}
                        />
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

export default AuctionBidMonitoring;