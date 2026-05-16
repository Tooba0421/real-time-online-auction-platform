import { useState, useMemo, useEffect } from "react";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Doughnut } from "react-chartjs-2";
import { supabase } from "../../supabase/supabase";
import { useAuthContext } from "../../context/AuthContext";
import toast from "react-hot-toast";
import StatCard from "../../common/components/StatCard";
import StatusBadge from "../../common/components/StatusBadge";
import ActionButton from "../../common/components/ActionButton";
import "../styles/adminLayout.css";
import "../styles/sellerManagement.css";

ChartJS.register(ArcElement, Tooltip, Legend);

const BidderManagement = () => {

  const { user } = useAuthContext();

  const [pendingBidders, setPendingBidders] = useState([]);
  const [approvedBidders, setApprovedBidders] = useState([]);
  const [rejectedBidders, setRejectedBidders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCnic, setSelectedCnic] = useState(null);
  const [selectedBidder, setSelectedBidder] = useState(null);
  const [reasonText, setReasonText] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchBidders();
  }, []);

  const fetchBidders = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('buyers')
        .select(`
          *,
          profiles (
            id,
            name,
            role,
            status
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        toast.error("Error fetching bidders");
        console.error(error);
        return;
      }

      const pending = [];
      const approved = [];
      const rejected = [];

      for (const buyer of data) {
        // Count total bids placed
        const { count: totalBids } = await supabase
          .from('bids')
          .select('*', { count: 'exact', head: true })
          .eq('bidder_id', buyer.id);

        // Count auctions won
        const { count: auctionsWon } = await supabase
          .from('auctions')
          .select('*', { count: 'exact', head: true })
          .eq('winner_id', buyer.id);

        const buyerWithStats = {
          ...buyer,
          name: buyer.profiles?.name || '—',
          totalBids: totalBids || 0,
          auctionsWon: auctionsWon || 0,
        };

        if (buyer.is_verified === 'pending') {
          pending.push(buyerWithStats);
        } else if (buyer.is_verified === 'approved') {
          approved.push(buyerWithStats);
        } else if (
          buyer.is_verified === 'rejected' ||
          buyer.is_verified === 'not_submitted'
        ) {
          if (buyer.is_verified === 'rejected') {
            rejected.push(buyerWithStats);
          }
        }
      }

      setPendingBidders(pending);
      setApprovedBidders(approved);
      setRejectedBidders(rejected);

    } catch (err) {
      console.error(err);
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  // Approve bidder
  const handleApprove = async (buyer) => {
    try {
      setProcessing(true);

      // Step 1: Update buyers.is_verified
      const { error: buyerError } = await supabase
        .from('buyers')
        .update({ is_verified: 'approved' })
        .eq('id', buyer.id);

      if (buyerError) {
        toast.error("Error approving bidder");
        console.error(buyerError);
        return;
      }

      // Step 2: Update profiles role and id_verified
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          role: 'buyer',
          id_verified: 'approved'
        })
        .eq('id', buyer.user_id);

      if (profileError) {
        toast.error("Error updating bidder profile");
        console.error(profileError);
        return;
      }

      // Step 3: Log admin action
      await supabase
        .from('admin_actions')
        .insert({
          admin_id: user.id,
          action_type: 'approve',
          target_id: buyer.id,
          target_table: 'buyers',
          remarks: 'Bidder CNIC approved by admin'
        });

      // Step 4: Notify user
      await supabase
        .from('notifications')
        .insert({
          user_id: buyer.user_id,
          title: 'CNIC Verified — You Can Now Bid! 🎉',
          message: 'Your identity has been verified. You can now place bids on auctions.',
          type: 'approval',
          notification_for: 'buyer',
          is_read: false
        });

      toast.success(`${buyer.name} approved as bidder!`);

      // Update local state
      setPendingBidders(prev => prev.filter(b => b.id !== buyer.id));
      setApprovedBidders(prev => [...prev, { ...buyer, is_verified: 'approved' }]);

    } catch (err) {
      console.error(err);
      toast.error("Something went wrong");
    } finally {
      setProcessing(false);
    }
  };

  const openRejectModal = (buyer) => {
    setSelectedBidder(buyer);
    setReasonText("");
  };

  // Reject bidder
  const handleConfirmReject = async () => {
    if (!reasonText.trim()) {
      toast.error("Please write a reason");
      return;
    }

    try {
      setProcessing(true);

      // Step 1: Update buyers.is_verified
      const { error: buyerError } = await supabase
        .from('buyers')
        .update({ is_verified: 'rejected' })
        .eq('id', selectedBidder.id);

      if (buyerError) {
        toast.error("Error rejecting bidder");
        console.error(buyerError);
        return;
      }

      // Step 2: Update profiles.id_verified
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ id_verified: 'rejected' })
        .eq('id', selectedBidder.user_id);

      if (profileError) {
        toast.error("Error updating profile");
        console.error(profileError);
        return;
      }

      // Step 3: Log admin action
      await supabase
        .from('admin_actions')
        .insert({
          admin_id: user.id,
          action_type: 'reject',
          target_id: selectedBidder.id,
          target_table: 'buyers',
          remarks: reasonText
        });

      // Step 4: Notify user
      await supabase
        .from('notifications')
        .insert({
          user_id: selectedBidder.user_id,
          title: 'CNIC Verification Rejected',
          message: `Your CNIC verification was rejected. Reason: ${reasonText}`,
          type: 'approval',
          notification_for: 'buyer',
          is_read: false
        });

      toast.success(`${selectedBidder.name} rejected`);

      // Update local state
      setPendingBidders(prev =>
        prev.filter(b => b.id !== selectedBidder.id)
      );
      setRejectedBidders(prev => [
        ...prev,
        { ...selectedBidder, is_verified: 'rejected', reason: reasonText }
      ]);

      setSelectedBidder(null);

    } catch (err) {
      console.error(err);
      toast.error("Something went wrong");
    } finally {
      setProcessing(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-PK', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  };

  const renderEmptyRow = (colSpan, message) => (
    <tr>
      <td colSpan={colSpan} className="empty-row">{message}</td>
    </tr>
  );

  // Stats
  const totalPending = pendingBidders.length;
  const totalApproved = approvedBidders.length;
  const totalRejected = rejectedBidders.length;

  const statsData = [
    {
      title: "Pending Requests",
      value: loading ? "..." : totalPending,
      subtitle: "Awaiting CNIC verification"
    },
    {
      title: "Approved Bidders",
      value: loading ? "..." : totalApproved,
      subtitle: "Allowed to place bids"
    },
    {
      title: "Rejected Bidders",
      value: loading ? "..." : totalRejected,
      subtitle: "CNIC not approved"
    },
  ];

  const bidderStatusData = useMemo(() => ({
    labels: ["Approved", "Pending", "Rejected"],
    datasets: [
      {
        data: [totalApproved, totalPending, totalRejected],
        backgroundColor: ["#10B981", "#F59E0B", "#EF4444"],
      },
    ],
  }), [totalApproved, totalPending, totalRejected]);

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "0%",
    layout: { padding: { top: 10, bottom: 30 } },
    plugins: {
      legend: {
        position: "top",
        align: "center",
        labels: { boxWidth: 30, padding: 15 },
      },
    },
  };

  return (
    <div className="admin-page">

      {/* STAT CARDS */}
      <div className="stats-grid">
        {statsData.map((item, index) => (
          <StatCard key={index} title={item.title} value={item.value} subtitle={item.subtitle} />
        ))}
      </div>

      {/* PENDING TABLE */}
      <div className="admin-section">
        <h3 className="admin-section-heading">Pending Bidders</h3>
        {loading ? (
          <div className="loading-state">Loading bidders...</div>
        ) : (
          <div className="table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>CNIC No</th>
                  <th>City</th>
                  <th>Phone</th>
                  <th>View CNIC</th>
                  <th>Request Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingBidders.length === 0
                  ? renderEmptyRow(7, "No pending bidders.")
                  : pendingBidders.map(buyer => (
                    <tr key={buyer.id}>
                      <td>{buyer.name}</td>
                      <td>{buyer.cnic_number}</td>
                      <td>{buyer.city || '—'}</td>
                      <td>{buyer.phone_no || '—'}</td>
                      <td>
                        <span
                          className="view-image-link"
                          onClick={() => setSelectedCnic(buyer)}
                        >
                          View CNIC
                        </span>
                      </td>
                      <td>{formatDate(buyer.created_at)}</td>
                      <td className="actions">
                        <ActionButton
                          label="Approve"
                          variant="success"
                          onClick={() => handleApprove(buyer)}
                          disabled={processing}
                        />
                        <ActionButton
                          label="Reject"
                          variant="danger"
                          onClick={() => openRejectModal(buyer)}
                          disabled={processing}
                        />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* APPROVED TABLE */}
      <div className="admin-section">
        <h3 className="admin-section-heading">Approved Bidders</h3>
        {loading ? (
          <div className="loading-state">Loading bidders...</div>
        ) : (
          <div className="table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>CNIC No</th>
                  <th>City</th>
                  <th>Total Bids</th>
                  <th>Auctions Won</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {approvedBidders.length === 0
                  ? renderEmptyRow(6, "No approved bidders.")
                  : approvedBidders.map(buyer => (
                    <tr key={buyer.id}>
                      <td>{buyer.name}</td>
                      <td>{buyer.cnic_number}</td>
                      <td>{buyer.city || '—'}</td>
                      <td>{buyer.totalBids}</td>
                      <td>{buyer.auctionsWon}</td>
                      <td>
                        <StatusBadge label="Approved" type="approved" />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* REJECTED TABLE */}
      <div className="admin-section">
        <h3 className="admin-section-heading">Rejected Bidders</h3>
        {loading ? (
          <div className="loading-state">Loading bidders...</div>
        ) : (
          <div className="table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>CNIC No</th>
                  <th>City</th>
                  <th>Status</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {rejectedBidders.length === 0
                  ? renderEmptyRow(5, "No rejected bidders.")
                  : rejectedBidders.map(buyer => (
                    <tr key={buyer.id}>
                      <td>{buyer.name}</td>
                      <td>{buyer.cnic_number}</td>
                      <td>{buyer.city || '—'}</td>
                      <td>
                        <StatusBadge label="Rejected" type="rejected" />
                      </td>
                      <td>
                        <span className="long-text" title={buyer.reason}>
                          {buyer.reason || '—'}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CNIC MODAL */}
      {selectedCnic && (
        <div className="cnic-modal-overlay">
          <div className="cnic-modal">
            <h3>CNIC Details — {selectedCnic.name}</h3>
            <div className="cnic-images">
              <div>
                <p>Front Side</p>
                <img src={selectedCnic.cnic_front} alt="CNIC Front" />
              </div>
              <div>
                <p>Back Side</p>
                <img src={selectedCnic.cnic_back} alt="CNIC Back" />
              </div>
            </div>
            <button className="close-btn" onClick={() => setSelectedCnic(null)}>
              Close
            </button>
          </div>
        </div>
      )}

      {/* REJECT REASON MODAL */}
      {selectedBidder && (
        <div className="reason-modal-overlay">
          <div className="reason-modal">
            <h3>Reject Bidder</h3>
            <textarea
              placeholder="Write reason here..."
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
            />
            <div className="modal-actions">
              <button
                className="cancel"
                onClick={() => setSelectedBidder(null)}
                disabled={processing}
              >
                Cancel
              </button>
              <button
                className="confirm"
                onClick={handleConfirmReject}
                disabled={processing}
              >
                {processing ? "Processing..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CHART */}
      <div className="overview-grid chart-space">
        <div className="chart-box">
          <h3 className="admin-section-heading">Bidder Status Overview</h3>
          <div className="chart-container">
            <Doughnut data={bidderStatusData} options={doughnutOptions} />
          </div>
        </div>
      </div>

    </div>
  );
};

export default BidderManagement;