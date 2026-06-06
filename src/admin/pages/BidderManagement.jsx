import { useState, useMemo, useEffect } from "react";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { Doughnut } from "react-chartjs-2";
import { supabase } from "../../supabase/supabase";
import { useAuthContext } from "../../context/AuthContext";
import { useAdminContext } from "../../context/AdminContext";
import toast from "react-hot-toast";
import "../styles/adminLayout.css";
import "../styles/sellerManagement.css";
import StatusBadge from "../../common/components/StatusBadge";
import StatCard from "../../common/components/StatCard";
import ActionButton from "../../common/components/ActionButton";

ChartJS.register(ArcElement, Tooltip, Legend);

const logAdminAction = async (adminId, actionType, targetId, targetTable, remarks) => {
  try {
    await supabase.from("admin_actions").insert({
      admin_id: adminId, action_type: actionType,
      target_id: targetId, target_table: targetTable, remarks,
    });
  } catch (_) {}
};

const BidderManagement = () => {
  const { user } = useAuthContext();
  const {
    pendingSubmissions,
    rejectedSubmissions,
    approvedBuyers,
    biddersLoading,
    pendingBuyerEdits,
    buyerEditsLoading,
    refetchBidders,
    refetchBuyerEdits,
  } = useAdminContext();

  // ── CNIC view modal (shared for both registration and edit requests) ──
  const [cnicModal,       setCnicModal]       = useState(null);
  const [cnicUrls,        setCnicUrls]        = useState({ front: null, back: null });
  const [cnicLoading,     setCnicLoading]     = useState(false);

  // ── Reject modals ─────────────────────────────────────────────────
  const [selectedBidder,  setSelectedBidder]  = useState(null);
  const [reasonText,      setReasonText]      = useState("");
  const [editRejectModal, setEditRejectModal] = useState(null);
  const [editRejectReason,setEditRejectReason]= useState("");

  const [processing,      setProcessing]      = useState(false);

  // ── Rejection reasons for rejected submissions ────────────────────
  const [rejectionReasons, setRejectionReasons] = useState({});

  // Fetch rejection reasons from admin_actions for all rejected submissions
  useEffect(() => {
    if (rejectedSubmissions.length === 0) return;
    const fetchReasons = async () => {
      const ids = rejectedSubmissions.map((s) => s.submissionId || s.id).filter(Boolean);
      if (!ids.length) return;
      const { data } = await supabase
        .from("admin_actions")
        .select("target_id, remarks")
        .in("target_id", ids)
        .eq("action_type", "reject")
        .order("action_date", { ascending: false });
      if (!data) return;
      const map = {};
      data.forEach((a) => {
        if (!map[a.target_id]) map[a.target_id] = a.remarks;
      });
      setRejectionReasons(map);
    };
    fetchReasons();
  }, [rejectedSubmissions]);

  // ── View CNIC images — shared handler ────────────────────────────
  // Works for both new registration (frontPath = buyers/uid/front)
  // and edit requests (frontPath = pending_cnic_front path from DB)
  const handleViewCnic = async ({ name, frontPath, backPath }) => {
    try {
      setCnicLoading(true);
      setCnicModal({ name, frontPath, backPath });
      setCnicUrls({ front: null, back: null });

      const [frontRes, backRes] = await Promise.all([
        frontPath
          ? supabase.storage.from("cnic-images").createSignedUrl(frontPath, 60)
          : { data: null },
        backPath
          ? supabase.storage.from("cnic-images").createSignedUrl(backPath, 60)
          : { data: null },
      ]);

      setCnicUrls({
        front: frontRes.data?.signedUrl || null,
        back:  backRes.data?.signedUrl  || null,
      });

      if (!frontRes.data?.signedUrl && !backRes.data?.signedUrl) {
        toast.error("No CNIC images found");
      }
    } catch (_) {
      toast.error("Could not load CNIC images");
    } finally {
      setCnicLoading(false);
    }
  };

  // ── Approve new CNIC registration ─────────────────────────────────
  const handleApprove = async (submission) => {
    try {
      setProcessing(true);

      const { data: newBuyer, error: buyerErr } = await supabase
        .from("buyers")
        .insert({
          user_id:     submission.user_id,
          cnic_number: submission.cnic_number,
          cnic_front:  `buyers/${submission.user_id}/front`,
          cnic_back:   `buyers/${submission.user_id}/back`,
          is_verified: "approved",
        })
        .select()
        .single();

      if (buyerErr) { toast.error("Error creating buyer record"); return; }

      const { error: profileErr } = await supabase
        .from("profiles")
        .update({ role: "buyer", id_verified: "approved" })
        .eq("id", submission.user_id);

      if (profileErr) {
        await supabase.from("buyers").delete().eq("id", newBuyer.id);
        toast.error("Error updating user profile");
        return;
      }

      await supabase
        .from("pending_cnic_submissions")
        .update({ status: "approved" })
        .eq("id", submission.submissionId);

      await Promise.all([
        logAdminAction(user.id, "approve", newBuyer.id, "buyers", "Bidder CNIC approved by admin"),
        supabase.from("notifications").insert({
          user_id:          submission.user_id,
          title:            "CNIC Verified — You Can Now Bid! 🎉",
          message:          "Your identity has been verified. You can now place bids on auctions.",
          type:             "approval",
          notification_for: "buyer",
          is_read:          false,
        }),
      ]);

      toast.success(`${submission.name} approved as bidder!`);
      await refetchBidders();
    } catch (_) {
      toast.error("Something went wrong");
    } finally {
      setProcessing(false);
    }
  };

  // ── Reject new CNIC registration ──────────────────────────────────
  const handleConfirmReject = async () => {
    if (!reasonText.trim()) { toast.error("Please write a reason"); return; }
    try {
      setProcessing(true);

      await supabase
        .from("pending_cnic_submissions")
        .update({ status: "rejected" })
        .eq("id", selectedBidder.submissionId);

      await supabase
        .from("profiles")
        .update({ id_verified: "rejected" })
        .eq("id", selectedBidder.user_id);

      await logAdminAction(
        user.id, "reject",
        selectedBidder.submissionId,
        "pending_cnic_submissions",
        reasonText
      );

      await supabase.from("notifications").insert({
        user_id:          selectedBidder.user_id,
        title:            "CNIC Verification Rejected",
        message:          `Your CNIC verification was rejected. Reason: ${reasonText}`,
        type:             "approval",
        notification_for: "buyer",
        is_read:          false,
      });

      toast.success(`${selectedBidder.name} rejected`);
      setSelectedBidder(null);
      setReasonText("");
      await refetchBidders();
    } catch (_) {
      toast.error("Something went wrong");
    } finally {
      setProcessing(false);
    }
  };

  // ── Approve CNIC edit request ─────────────────────────────────────
  const handleApproveEdit = async (editRequest) => {
    try {
      setProcessing(true);

      const payload = {};
      if (editRequest.pending_cnic_number) payload.cnic_number = editRequest.pending_cnic_number;
      if (editRequest.pending_cnic_front)  payload.cnic_front  = editRequest.pending_cnic_front;
      if (editRequest.pending_cnic_back)   payload.cnic_back   = editRequest.pending_cnic_back;

      const [{ error: buyerErr }, { error: changeErr }] = await Promise.all([
        supabase.from("buyers").update(payload).eq("user_id", editRequest.user_id),
        supabase.from("pending_changes").update({ status: "approved" }).eq("id", editRequest.id),
      ]);

      if (buyerErr) { toast.error("Error applying CNIC changes"); return; }
      if (changeErr) toast.error("Error updating change status");

      await Promise.all([
        logAdminAction(user.id, "approve", editRequest.id, "buyers", "Buyer CNIC update approved"),
        supabase.from("notifications").insert({
          user_id:          editRequest.user_id,
          title:            "CNIC Update Approved ✅",
          message:          "Your CNIC update request has been approved and your information has been updated.",
          type:             "approval",
          notification_for: "buyer",
          is_read:          false,
        }),
      ]);

      toast.success(`CNIC update approved for ${editRequest.userName}`);
      await Promise.all([refetchBuyerEdits(), refetchBidders()]);
    } catch (_) {
      toast.error("Something went wrong");
    } finally {
      setProcessing(false);
    }
  };

  // ── Reject CNIC edit request ──────────────────────────────────────
  const handleRejectEdit = async () => {
    if (!editRejectReason.trim()) { toast.error("Please write a reason"); return; }
    try {
      setProcessing(true);

      const { error } = await supabase
        .from("pending_changes")
        .update({ status: "rejected", reason: editRejectReason })
        .eq("id", editRejectModal.id);

      if (error) { toast.error("Error rejecting edit request"); return; }

      await Promise.all([
        logAdminAction(user.id, "reject", editRejectModal.id, "buyers", editRejectReason),
        supabase.from("notifications").insert({
          user_id:          editRejectModal.user_id,
          title:            "CNIC Update Rejected",
          message:          `Your CNIC update request was rejected. Reason: ${editRejectReason}`,
          type:             "approval",
          notification_for: "buyer",
          is_read:          false,
        }),
      ]);

      toast.success(`Edit request rejected for ${editRejectModal.userName}`);
      setEditRejectModal(null);
      setEditRejectReason("");
      await refetchBuyerEdits();
    } catch (_) {
      toast.error("Something went wrong");
    } finally {
      setProcessing(false);
    }
  };

  const formatDate = (d) => !d ? "—" : new Date(d).toLocaleDateString("en-PK", {
    year: "numeric", month: "short", day: "numeric",
  });

  const renderEmptyRow = (colSpan, msg) => (
    <tr><td colSpan={colSpan} className="empty-row">{msg}</td></tr>
  );

  const totalPending  = pendingSubmissions.length;
  const totalApproved = approvedBuyers.length;
  const totalRejected = rejectedSubmissions.length;

  const statsData = [
    { title: "Pending Registrations",  value: biddersLoading    ? "..." : totalPending,              subtitle: "Awaiting CNIC verification" },
    { title: "Approved Bidders",       value: biddersLoading    ? "..." : totalApproved,             subtitle: "Allowed to place bids"      },
    { title: "Rejected Registrations", value: biddersLoading    ? "..." : totalRejected,             subtitle: "CNIC not approved"          },
    { title: "Pending CNIC Edits",     value: buyerEditsLoading ? "..." : pendingBuyerEdits.length,  subtitle: "Edit requests from buyers"  },
  ];

  const bidderStatusData = useMemo(() => ({
    labels: ["Approved", "Pending", "Rejected"],
    datasets: [{
      data: [totalApproved, totalPending, totalRejected],
      backgroundColor: ["#10B981", "#F59E0B", "#EF4444"],
    }],
  }), [totalApproved, totalPending, totalRejected]);

  const doughnutOptions = {
    responsive: true, maintainAspectRatio: false, cutout: "0%",
    layout: { padding: { top: 10, bottom: 30 } },
    plugins: { legend: { position: "top", align: "center", labels: { boxWidth: 30, padding: 15 } } },
  };

  return (
    <div className="admin-page">

      {/* STAT CARDS */}
      <div className="stats-grid">
        {statsData.map((item, i) => (
          <StatCard key={i} title={item.title} value={item.value} subtitle={item.subtitle} />
        ))}
      </div>

      {/* ── PENDING REGISTRATIONS ─────────────────────────────────── */}
      <div className="admin-section">
        <h3 className="admin-section-heading">Pending Bidder Registrations</h3>
        {biddersLoading ? (
          <div className="loading-state">Loading bidders...</div>
        ) : (
          <div className="table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th><th>Email</th><th>CNIC No</th>
                  <th>View CNIC</th><th>Submitted</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingSubmissions.length === 0
                  ? renderEmptyRow(6, "No pending bidder registrations.")
                  : pendingSubmissions.map((s) => (
                    <tr key={s.id}>
                      <td>{s.name}</td>
                      <td>{s.email}</td>
                      <td>{s.cnic_number}</td>
                      <td>
                        <span
                          className="view-image-link"
                          onClick={() => handleViewCnic({
                            name:      s.name,
                            frontPath: `buyers/${s.user_id}/front`,
                            backPath:  `buyers/${s.user_id}/back`,
                          })}
                        >
                          View CNIC
                        </span>
                      </td>
                      <td>{formatDate(s.created_at)}</td>
                      <td className="actions">
                        <ActionButton label="Approve" variant="success" onClick={() => handleApprove(s)} disabled={processing} />
                        <ActionButton label="Reject"  variant="danger"  onClick={() => { setSelectedBidder(s); setReasonText(""); }} disabled={processing} />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── PENDING CNIC EDIT REQUESTS — all info inline ──────────── */}
      <div className="admin-section">
        <h3 className="admin-section-heading">Pending CNIC Update Requests</h3>
        {buyerEditsLoading ? (
          <div className="loading-state">Loading edit requests...</div>
        ) : (
          <div className="table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  {/* ✅ All info inline — same pattern as SellerManagement pending profile updates */}
                  <th>Buyer Name</th>
                  <th>Email</th>
                  <th>New CNIC No</th>
                  <th>View New CNIC</th>
                  <th>Submitted</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingBuyerEdits.length === 0
                  ? renderEmptyRow(6, "No pending CNIC update requests.")
                  : pendingBuyerEdits.map((edit) => (
                    <tr key={edit.id}>
                      <td>{edit.userName}</td>
                      <td>{edit.userEmail}</td>
                      <td>{edit.pending_cnic_number || "—"}</td>
                      <td>
                        {/* ✅ View CNIC link — same as SellerManagement, no review modal */}
                        {edit.pending_cnic_front || edit.pending_cnic_back ? (
                          <span
                            className="view-image-link"
                            onClick={() => handleViewCnic({
                              name:      edit.userName,
                              frontPath: edit.pending_cnic_front || `buyers/${edit.user_id}/front_pending`,
                              backPath:  edit.pending_cnic_back  || `buyers/${edit.user_id}/back_pending`,
                            })}
                          >
                            View CNIC
                          </span>
                        ) : (
                          <span style={{ color: "#999", fontSize: "12px" }}>Not updated</span>
                        )}
                      </td>
                      <td>{formatDate(edit.created_at)}</td>
                      {/* ✅ Approve + Reject directly in table — no review modal needed */}
                      <td className="actions">
                        <ActionButton
                          label="Approve" variant="success"
                          onClick={() => handleApproveEdit(edit)}
                          disabled={processing}
                        />
                        <ActionButton
                          label="Reject" variant="danger"
                          onClick={() => { setEditRejectModal(edit); setEditRejectReason(""); }}
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

      {/* ── APPROVED BIDDERS ──────────────────────────────────────── */}
      <div className="admin-section">
        <h3 className="admin-section-heading">Approved Bidders</h3>
        {biddersLoading ? (
          <div className="loading-state">Loading bidders...</div>
        ) : (
          <div className="table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th><th>Email</th><th>CNIC No</th>
                  <th>Total Bids</th><th>Auctions Won</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {approvedBuyers.length === 0
                  ? renderEmptyRow(6, "No approved bidders.")
                  : approvedBuyers.map((buyer) => (
                    <tr key={buyer.id}>
                      <td>{buyer.name}</td>
                      <td>{buyer.email}</td>
                      <td>{buyer.cnic_number}</td>
                      <td>{buyer.totalBids}</td>
                      <td>{buyer.auctionsWon}</td>
                      <td>
                        {buyer.profiles?.status === "banned" ? (
                          <StatusBadge label="Suspended" type="rejected" />
                        ) : (
                          <StatusBadge label="Approved" type="approved" />
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── REJECTED REGISTRATIONS — with reason column ───────────── */}
      <div className="admin-section">
        <h3 className="admin-section-heading">Rejected Registrations</h3>
        {biddersLoading ? (
          <div className="loading-state">Loading...</div>
        ) : (
          <div className="table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  {/* ✅ Added Rejection Reason column */}
                  <th>Name</th><th>Email</th><th>CNIC No</th>
                  <th>Status</th><th>Submitted</th><th>Rejection Reason</th>
                </tr>
              </thead>
              <tbody>
                {rejectedSubmissions.length === 0
                  ? renderEmptyRow(6, "No rejected registrations.")
                  : rejectedSubmissions.map((s) => {
                    const submissionId = s.submissionId || s.id;
                    return (
                      <tr key={s.id}>
                        <td>{s.name}</td>
                        <td>{s.email}</td>
                        <td>{s.cnic_number}</td>
                        <td><StatusBadge label="Rejected" type="rejected" /></td>
                        <td>{formatDate(s.created_at)}</td>
                        {/* ✅ Shows reason fetched from admin_actions */}
                        <td className="long-text" title={rejectionReasons[submissionId] || "—"}>
                          {rejectionReasons[submissionId] || "—"}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CHART */}
      <div className="overview-grid chart-space">
        <div className="chart-box">
          <h3 className="admin-section-heading">Bidder Status Overview</h3>
          <div className="chart-container">
            <Doughnut data={bidderStatusData} options={doughnutOptions} />
          </div>
        </div>
      </div>

      {/* ── CNIC VIEW MODAL (shared for registration + edit requests) ── */}
      {cnicModal && (
        <div className="cnic-modal-overlay" onClick={() => { setCnicModal(null); setCnicUrls({ front: null, back: null }); }}>
          <div className="cnic-modal" onClick={(e) => e.stopPropagation()}>
            <h3>CNIC Details — {cnicModal.name}</h3>
            {cnicLoading ? (
              <div style={{ padding: "30px", textAlign: "center", color: "#888" }}>
                Loading images...
              </div>
            ) : (
              <div className="cnic-images">
                <div>
                  <p>Front Side</p>
                  {cnicUrls.front
                    ? <img src={cnicUrls.front} alt="CNIC Front" />
                    : <p style={{ color: "#999" }}>Image not available</p>}
                </div>
                <div>
                  <p>Back Side</p>
                  {cnicUrls.back
                    ? <img src={cnicUrls.back} alt="CNIC Back" />
                    : <p style={{ color: "#999" }}>Image not available</p>}
                </div>
              </div>
            )}
            <button className="close-btn" onClick={() => { setCnicModal(null); setCnicUrls({ front: null, back: null }); }}>
              Close
            </button>
          </div>
        </div>
      )}

      {/* ── REGISTRATION REJECT MODAL ─────────────────────────────── */}
      {selectedBidder && (
        <div className="reason-modal-overlay">
          <div className="reason-modal">
            <h3>Reject Bidder Registration</h3>
            <p style={{ fontSize: "13px", color: "#666", marginBottom: "8px" }}>
              Rejecting: <strong>{selectedBidder.name}</strong>
            </p>
            <textarea
              placeholder="Write reason here..."
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
            />
            <div className="modal-actions">
              <button className="cancel" onClick={() => setSelectedBidder(null)} disabled={processing}>
                Cancel
              </button>
              <button className="confirm" onClick={handleConfirmReject} disabled={processing}>
                {processing ? "Processing..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT REJECT REASON MODAL ──────────────────────────────── */}
      {editRejectModal && (
        <div className="reason-modal-overlay">
          <div className="reason-modal">
            <h3>Reject CNIC Update</h3>
            <p style={{ fontSize: "13px", color: "#666", marginBottom: "8px" }}>
              Rejecting update for: <strong>{editRejectModal.userName}</strong>
            </p>
            <textarea
              placeholder="Write reason here..."
              value={editRejectReason}
              onChange={(e) => setEditRejectReason(e.target.value)}
            />
            <div className="modal-actions">
              <button className="cancel" onClick={() => { setEditRejectModal(null); setEditRejectReason(""); }} disabled={processing}>
                Cancel
              </button>
              <button className="confirm" onClick={handleRejectEdit} disabled={processing}>
                {processing ? "Processing..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default BidderManagement;