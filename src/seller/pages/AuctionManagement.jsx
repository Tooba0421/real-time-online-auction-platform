import { useState, useEffect, useMemo } from "react";
import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { supabase } from "../../supabase/supabase";
import { useAuthContext } from "../../context/AuthContext";
import {
  pauseAuction,
  resumeAuction,
  closeAuction,
  cancelAuction
} from "../../utils/auctionHelper";
import toast from "react-hot-toast";
import StatCard from "../../common/components/StatCard";
import StatusBadge from "../../common/components/StatusBadge";
import ActionButton from "../../common/components/ActionButton";
import "../styles/sellerLayout.css";
import "../styles/auctionManagement.css";

ChartJS.register(ArcElement, Tooltip, Legend);

const AuctionManagement = ({ openCreateAuction }) => {

  const { user } = useAuthContext();

  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  // View Result modal
  const [selectedResult, setSelectedResult] = useState(null);

  // Edit modal
  const [editAuction, setEditAuction] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);

  // Rejection reason modal
  const [showReason, setShowReason] = useState(null);

  useEffect(() => {
    if (!user) return;
    fetchAuctions();
  }, [user]);

  const fetchAuctions = async () => {
    try {
      setLoading(true);

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
          products (
            id,
            title,
            category,
            base_price
          ),
          bids ( id, bid_amount )
        `)
        .eq('seller_id', sellerData.id)
        .order('created_at', { ascending: false });

      if (error) {
        toast.error("Error fetching auctions");
        console.error(error);
        return;
      }

      // Get rejection reasons from admin_actions
      const auctionIds = data?.map(a => a.id) || [];
      let reasonMap = {};

      if (auctionIds.length > 0) {
        const productIds = data?.map(a => a.products?.id).filter(Boolean) || [];

        if (productIds.length > 0) {
          const { data: actionData } = await supabase
            .from('admin_actions')
            .select('target_id, remarks')
            .in('target_id', productIds)
            .eq('action_type', 'reject');

          actionData?.forEach(a => {
            reasonMap[a.target_id] = a.remarks;
          });
        }
      }

      // Get winner info for ended auctions
      const endedAuctions = data?.filter(a => a.status === 'ended' && a.winner_id) || [];
      let winnerMap = {};

      if (endedAuctions.length > 0) {
        const winnerIds = endedAuctions.map(a => a.winner_id);
        const { data: winnerData } = await supabase
          .from('buyers')
          .select('id, profiles ( name )')
          .in('id', winnerIds);

        winnerData?.forEach(w => {
          winnerMap[w.id] = w.profiles?.name || '—';
        });
      }

      // Get order status for ended auctions
      const { data: orderData } = await supabase
        .from('orders')
        .select('auction_id, order_status, payments ( status )')
        .in('auction_id', auctionIds);

      let orderMap = {};
      orderData?.forEach(o => {
        orderMap[o.auction_id] = {
          orderStatus: o.order_status,
          paymentStatus: o.payments?.status
        };
      });

      const enriched = data?.map(a => ({
        ...a,
        rejectionReason: reasonMap[a.products?.id] || null,
        winnerName: winnerMap[a.winner_id] || null,
        orderInfo: orderMap[a.id] || null,
      })) || [];

      setAuctions(enriched);

    } catch (err) {
      console.error(err);
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handlePause = async (auction) => {
    try {
      setProcessing(auction.id);
      await pauseAuction(auction.id);
      toast.success("Auction paused");
      fetchAuctions();
    } catch (err) {
      toast.error(err.message || "Failed to pause");
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
      toast.error(err.message || "Failed to resume");
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

  const handleCancel = async (auction) => {
    if (!window.confirm(`Cancel auction for "${auction.products?.title}"? This cannot be undone.`)) return;
    try {
      setProcessing(auction.id);
      await cancelAuction(auction.id);
      toast.success("Auction cancelled");
      fetchAuctions();
    } catch (err) {
      toast.error("Failed to cancel auction");
    } finally {
      setProcessing(null);
    }
  };

  // Open edit modal — only for scheduled auctions
  const openEdit = (auction) => {
    setEditAuction(auction);
    setEditForm({
      start_time: auction.start_time
        ? new Date(auction.start_time).toISOString().slice(0, 16)
        : '',
      end_time: auction.end_time
        ? new Date(auction.end_time).toISOString().slice(0, 16)
        : '',
      min_increment: auction.min_increment || '',
      description: auction.products?.description || '',
    });
  };

  const handleSaveEdit = async () => {
    if (!editForm.start_time || !editForm.end_time) {
      toast.error("Start and end time are required");
      return;
    }

    if (new Date(editForm.end_time) <= new Date(editForm.start_time)) {
      toast.error("End time must be after start time");
      return;
    }

    try {
      setSaving(true);

      // Update auction timing and increment
      const { error: auctionError } = await supabase
        .from('auctions')
        .update({
          start_time: new Date(editForm.start_time).toISOString(),
          end_time: new Date(editForm.end_time).toISOString(),
          min_increment: parseFloat(editForm.min_increment) || 0,
        })
        .eq('id', editAuction.id);

      if (auctionError) {
        toast.error("Error updating auction");
        console.error(auctionError);
        return;
      }

      // Update product description
      if (editAuction.products?.id) {
        await supabase
          .from('products')
          .update({ description: editForm.description })
          .eq('id', editAuction.products.id);
      }

      toast.success("Auction updated successfully");
      setEditAuction(null);
      fetchAuctions();

    } catch (err) {
      console.error(err);
      toast.error("Something went wrong");
    } finally {
      setSaving(false);
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
  const stats = useMemo(() => ({
    total: auctions.length,
    live: auctions.filter(a => a.status === 'live').length,
    pending: auctions.filter(a => a.approval_status === 'pending').length,
    rejected: auctions.filter(a => a.approval_status === 'rejected').length,
  }), [auctions]);

  const statsData = [
    { title: "Total Auctions", value: loading ? "..." : stats.total, subtitle: "All created auctions" },
    { title: "Live Auctions", value: loading ? "..." : stats.live, subtitle: "Currently running" },
    { title: "Pending Approval", value: loading ? "..." : stats.pending, subtitle: "Awaiting admin review" },
    { title: "Rejected", value: loading ? "..." : stats.rejected, subtitle: "Declined by admin" },
  ];

  const statusChartData = useMemo(() => ({
    labels: ["Live", "Paused", "Scheduled", "Ended", "Cancelled"],
    datasets: [{
      data: [
        auctions.filter(a => a.status === 'live').length,
        auctions.filter(a => a.status === 'paused').length,
        auctions.filter(a => a.status === 'scheduled').length,
        auctions.filter(a => a.status === 'ended').length,
        auctions.filter(a => a.status === 'cancelled').length,
      ],
      backgroundColor: ["#22c55e", "#facc15", "#3b82f6", "#6b7280", "#ef4444"],
    }],
  }), [auctions]);

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "0%",
    layout: { padding: { top: 10, bottom: 30 } },
    plugins: {
      legend: {
        position: "top", align: "center",
        labels: { boxWidth: 30, padding: 15 },
      },
    },
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-PK', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div className="seller-page">

      {/* STAT CARDS */}
      <div className="stats-grid">
        {statsData.map((item, index) => (
          <StatCard key={index} title={item.title} value={item.value} subtitle={item.subtitle} />
        ))}
      </div>

      {/* CREATE BUTTON */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "1rem" }}>
        <button className="create-btn" onClick={openCreateAuction}>
          + Create Auction
        </button>
      </div>

      {/* TABLE */}
      <div className="seller-section">
        <h3 className="seller-section-heading">All Auctions</h3>

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
            <option value="scheduled">Scheduled</option>
            <option value="paused">Paused</option>
            <option value="ended">Ended</option>
            <option value="cancelled">Cancelled</option>
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
                  <th>Base Price</th>
                  <th>Highest Bid</th>
                  <th>Total Bids</th>
                  <th>Start Time</th>
                  <th>End Time</th>
                  <th>Status</th>
                  <th>Approval</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAuctions.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="no-data">No auctions found</td>
                  </tr>
                ) : (
                  filteredAuctions.map(a => (
                    <tr key={a.id}>
                      <td>{a.products?.title || '—'}</td>
                      <td>{a.products?.category || '—'}</td>
                      <td>PKR {a.products?.base_price?.toLocaleString() || '—'}</td>
                      <td>PKR {a.highest_bid?.toLocaleString() || 0}</td>
                      <td>{a.bids?.length || 0}</td>
                      <td>{formatDate(a.start_time)}</td>
                      <td>{formatDate(a.end_time)}</td>
                      <td>
                        <StatusBadge
                          label={a.status.charAt(0).toUpperCase() + a.status.slice(1)}
                          type={a.status}
                        />
                      </td>
                      <td>
                        <StatusBadge
                          label={a.approval_status.charAt(0).toUpperCase() + a.approval_status.slice(1)}
                          type={a.approval_status}
                        />
                      </td>
                      <td className="actions">
                        {/* Live auction */}
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

                        {/* Paused auction */}
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
                            <ActionButton
                              label="Close"
                              variant="danger"
                              onClick={() => handleClose(a)}
                              disabled={processing === a.id}
                            />
                          </>
                        )}

                        {/* Scheduled auction */}
                        {a.status === 'scheduled' && (
                          <>
                            <ActionButton
                              label="Edit"
                              variant="secondary"
                              onClick={() => openEdit(a)}
                              disabled={processing === a.id}
                            />
                            <ActionButton
                              label="Cancel"
                              variant="danger"
                              onClick={() => handleCancel(a)}
                              disabled={processing === a.id}
                            />
                          </>
                        )}

                        {/* Ended auction */}
                        {a.status === 'ended' && (
                          <ActionButton
                            label="View Result"
                            variant="secondary"
                            onClick={() => setSelectedResult(a)}
                          />
                        )}

                        {/* Rejected auction */}
                        {a.approval_status === 'rejected' && (
                          <ActionButton
                            label="View Reason"
                            variant="danger"
                            onClick={() => setShowReason(a.rejectionReason || 'No reason provided')}
                          />
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

      {/* CHART */}
      <div className="overview-grid chart-space">
        <div className="chart-box">
          <h3 className="admin-section-heading">Auction Status Overview</h3>
          <div className="chart-container">
            <Doughnut data={statusChartData} options={doughnutOptions} />
          </div>
        </div>
      </div>

      {/* VIEW RESULT MODAL */}
      {selectedResult && (
        <div className="modal-overlay" onClick={() => setSelectedResult(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3>Auction Result</h3>
            <div className="result-info">
              <div className="result-row">
                <span className="result-label">Product</span>
                <span className="result-value">{selectedResult.products?.title || '—'}</span>
              </div>
              <div className="result-row">
                <span className="result-label">Winner</span>
                <span className="result-value">{selectedResult.winnerName || 'No winner'}</span>
              </div>
              <div className="result-row">
                <span className="result-label">Final Bid</span>
                <span className="result-value">
                  PKR {selectedResult.highest_bid?.toLocaleString() || 0}
                </span>
              </div>
              <div className="result-row">
                <span className="result-label">Total Bids</span>
                <span className="result-value">{selectedResult.bids?.length || 0}</span>
              </div>
              <div className="result-row">
                <span className="result-label">Ended At</span>
                <span className="result-value">{formatDate(selectedResult.end_time)}</span>
              </div>
              <div className="result-row">
                <span className="result-label">Order Status</span>
                <span className="result-value">
                  {selectedResult.orderInfo?.orderStatus || 'No order yet'}
                </span>
              </div>
              <div className="result-row">
                <span className="result-label">Payment Status</span>
                <span className="result-value">
                  {selectedResult.orderInfo?.paymentStatus || 'No payment yet'}
                </span>
              </div>
            </div>
            <button className="create-btn" onClick={() => setSelectedResult(null)}>
              Close
            </button>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editAuction && (
        <div className="modal-overlay" onClick={() => setEditAuction(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3>Edit Auction — {editAuction.products?.title}</h3>
            <p className="modal-subtitle">
              Only timing, increment and description can be edited for scheduled auctions.
            </p>

            <div className="edit-form">
              <div className="edit-field">
                <label>Start Time</label>
                <input
                  type="datetime-local"
                  className="form-input"
                  value={editForm.start_time}
                  onChange={e => setEditForm(prev => ({ ...prev, start_time: e.target.value }))}
                />
              </div>
              <div className="edit-field">
                <label>End Time</label>
                <input
                  type="datetime-local"
                  className="form-input"
                  value={editForm.end_time}
                  onChange={e => setEditForm(prev => ({ ...prev, end_time: e.target.value }))}
                />
              </div>
              <div className="edit-field">
                <label>Min Bid Increment (PKR)</label>
                <input
                  type="number"
                  className="form-input"
                  value={editForm.min_increment}
                  onChange={e => setEditForm(prev => ({ ...prev, min_increment: e.target.value }))}
                />
              </div>
              <div className="edit-field">
                <label>Description</label>
                <textarea
                  className="form-textarea"
                  value={editForm.description}
                  onChange={e => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={4}
                />
              </div>
            </div>

            <div className="modal-actions">
              <button
                className="btn-secondary"
                onClick={() => setEditAuction(null)}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                className="create-btn"
                onClick={handleSaveEdit}
                disabled={saving}
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REJECTION REASON MODAL */}
      {showReason && (
        <div className="modal-overlay" onClick={() => setShowReason(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3>Rejection Reason</h3>
            <p>{showReason}</p>
            <button className="create-btn" onClick={() => setShowReason(null)}>
              Close
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default AuctionManagement;