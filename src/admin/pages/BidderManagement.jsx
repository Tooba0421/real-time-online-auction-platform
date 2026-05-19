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

  const [cnicUrls, setCnicUrls] = useState({ front: null, back: null });
  const [cnicLoading, setCnicLoading] = useState(false);

  useEffect(() => {
    fetchBidders();
  }, []);

  const fetchBidders = async () => {
    try {
      setLoading(true);

      // Fetch pending CNIC submissions (not yet buyers)
      const { data: pendingData, error: pendingError } = await supabase
        .from("pending_cnic_submissions")
        .select(`
        *,
        profiles (
          id,
          name,
          role,
          status
        )
      `)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (pendingError) {
        toast.error("Error fetching pending bidders");
        console.error(pendingError);
        return;
      }

      // Fetch approved buyers
      const { data: buyerData, error: buyerError } = await supabase
        .from("buyers")
        .select(`
        *,
        profiles (
          id,
          name,
          role,
          status
        )
      `)
        .eq("is_verified", "approved")
        .order("created_at", { ascending: false });

      if (buyerError) {
        console.error(buyerError);
        return;
      }

      // Fetch rejected submissions
      const { data: rejectedData } = await supabase
        .from("pending_cnic_submissions")
        .select(`
        *,
        profiles (
          id,
          name,
          role,
          status
        )
      `)
        .eq("status", "rejected")
        .order("created_at", { ascending: false });

      // Map pending
      const pending = (pendingData || []).map(s => ({
        ...s,
        name: s.profiles?.name || "—",
        submissionId: s.id,
      }));

      // Map approved buyers with bid stats
      const approved = [];
      for (const buyer of buyerData || []) {
        const { count: totalBids } = await supabase
          .from("bids")
          .select("*", { count: "exact", head: true })
          .eq("bidder_id", buyer.id);

        const { count: auctionsWon } = await supabase
          .from("auctions")
          .select("*", { count: "exact", head: true })
          .eq("winner_id", buyer.id);

        approved.push({
          ...buyer,
          name: buyer.profiles?.name || "—",
          totalBids: totalBids || 0,
          auctionsWon: auctionsWon || 0,
        });
      }

      // Map rejected
      const rejected = (rejectedData || []).map(s => ({
        ...s,
        name: s.profiles?.name || "—",
      }));

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

  const handleViewCnic = async (submission) => {
    try {
      setCnicLoading(true);
      setSelectedCnic(submission);

      const { data: frontSigned } = await supabase.storage
        .from("cnic-images")
        .createSignedUrl(`buyers/${submission.user_id}/front`, 60);

      const { data: backSigned } = await supabase.storage
        .from("cnic-images")
        .createSignedUrl(`buyers/${submission.user_id}/back`, 60);

      setCnicUrls({
        front: frontSigned?.signedUrl || null,
        back: backSigned?.signedUrl || null,
      });

    } catch (err) {
      console.error(err);
      toast.error("Could not load CNIC images");
    } finally {
      setCnicLoading(false);
    }
  };

  // Approve bidder
  const handleApprove = async (submission) => {
    try {
      setProcessing(true);

      // Get signed URLs to copy to buyers table
      const { data: frontSigned } = await supabase.storage
        .from("cnic-images")
        .createSignedUrl(`buyers/${submission.user_id}/front`, 3600);

      const { data: backSigned } = await supabase.storage
        .from("cnic-images")
        .createSignedUrl(`buyers/${submission.user_id}/back`, 3600);

      // Step 1: Create buyer record NOW (only on approval)
      const { error: buyerError } = await supabase
        .from("buyers")
        .insert({
          user_id: submission.user_id,
          cnic_number: submission.cnic_number,
          cnic_front: `buyers/${submission.user_id}/front`,
          cnic_back: `buyers/${submission.user_id}/back`,
          is_verified: "approved",
        });

      if (buyerError) {
        toast.error("Error creating buyer record");
        console.error(buyerError);
        return;
      }

      // Step 2: Update profile role and id_verified
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          role: "buyer",
          id_verified: "approved",
        })
        .eq("id", submission.user_id);

      if (profileError) {
        toast.error("Error updating profile");
        console.error(profileError);
        return;
      }

      // Step 3: Mark submission as approved
      await supabase
        .from("pending_cnic_submissions")
        .update({ status: "approved" })
        .eq("id", submission.submissionId);

      // Step 4: Notify user
      await supabase.from("notifications").insert({
        user_id: submission.user_id,
        title: "CNIC Verified — You Can Now Bid! 🎉",
        message: "Your identity has been verified. You can now place bids on auctions.",
        type: "approval",
        notification_for: "buyer",
        is_read: false,
      });

      toast.success(`${submission.name} approved as bidder!`);

      setPendingBidders(prev => prev.filter(b => b.id !== submission.id));
      setApprovedBidders(prev => [...prev, { ...submission, is_verified: "approved" }]);

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

      // Step 1: Mark submission as rejected
      await supabase
        .from("pending_cnic_submissions")
        .update({ status: "rejected" })
        .eq("id", selectedBidder.submissionId);

      // Step 2: Update profile id_verified
      await supabase
        .from("profiles")
        .update({ id_verified: "rejected" })
        .eq("id", selectedBidder.user_id);

      // Step 3: Notify user
      await supabase.from("notifications").insert({
        user_id: selectedBidder.user_id,
        title: "CNIC Verification Rejected",
        message: `Your CNIC verification was rejected. Reason: ${reasonText}`,
        type: "approval",
        notification_for: "buyer",
        is_read: false,
      });

      toast.success(`${selectedBidder.name} rejected`);

      setPendingBidders(prev =>
        prev.filter(b => b.id !== selectedBidder.id)
      );
      setRejectedBidders(prev => [
        ...prev,
        { ...selectedBidder, status: "rejected", reason: reasonText }
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
                  <th>Email</th>
                  <th>CNIC No</th>
                  <th>View CNIC</th>
                  <th>Request Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingBidders.length === 0
                  ? renderEmptyRow(6, "No pending bidders.")
                  : pendingBidders.map(buyer => (
                    <tr key={buyer.id}>
                      <td>{buyer.name}</td>
                      <td>{buyer.profiles?.email || user?.email || '—'}</td>
                      <td>{buyer.cnic_number}</td>
                      <td>
                        <span className="view-image-link" onClick={() => handleViewCnic(buyer)}>
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
                  <th>Total Bids</th>
                  <th>Auctions Won</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {approvedBidders.length === 0
                  ? renderEmptyRow(5, "No approved bidders.")
                  : approvedBidders.map(buyer => (
                    <tr key={buyer.id}>
                      <td>{buyer.name}</td>
                      <td>{buyer.cnic_number}</td>
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
                  <th>Status</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {rejectedBidders.length === 0
                  ? renderEmptyRow(4, "No rejected bidders.")
                  : rejectedBidders.map(buyer => (
                    <tr key={buyer.id}>
                      <td>{buyer.name}</td>
                      <td>{buyer.cnic_number}</td>
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

            {cnicLoading ? (
              <div style={{ textAlign: "center", padding: "30px" }}>
                Loading images...
              </div>
            ) : (
              <div className="cnic-images">
                <div>
                  <p>Front Side</p>
                  {cnicUrls.front ? (
                    <img src={cnicUrls.front} alt="CNIC Front" />
                  ) : (
                    <p style={{ color: "#999" }}>Image not available</p>
                  )}
                </div>
                <div>
                  <p>Back Side</p>
                  {cnicUrls.back ? (
                    <img src={cnicUrls.back} alt="CNIC Back" />
                  ) : (
                    <p style={{ color: "#999" }}>Image not available</p>
                  )}
                </div>
              </div>
            )}

            <button
              className="close-btn"
              onClick={() => {
                setSelectedCnic(null);
                setCnicUrls({ front: null, back: null });
              }}
            >
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