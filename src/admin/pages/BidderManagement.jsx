import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { Doughnut } from "react-chartjs-2";
import { useState, useMemo } from "react";
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
  } catch (err) { console.error("Admin action log error:", err); }
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

  // ── UI-only local state ───────────────────────────────────────────
  const [selectedCnic, setSelectedCnic] = useState(null);
  const [cnicUrls, setCnicUrls] = useState({ front: null, back: null });
  const [cnicLoading, setCnicLoading] = useState(false);

  const [selectedEdit, setSelectedEdit] = useState(null);
  const [editCnicUrls, setEditCnicUrls] = useState({ front: null, back: null });
  const [editCnicLoading, setEditCnicLoading] = useState(false);
  const [editRejectModal, setEditRejectModal] = useState(null);
  const [editRejectReason, setEditRejectReason] = useState("");

  const [selectedBidder, setSelectedBidder] = useState(null);
  const [reasonText, setReasonText] = useState("");
  const [processing, setProcessing] = useState(false);

  const [suspendModal, setSuspendModal] = useState(null);
  const [suspendReason, setSuspendReason] = useState("");
  const [suspending, setSuspending] = useState(null);

  // ── View CNIC images for new registration ─────────────────────────
  const handleViewCnic = async (submission) => {
    try {
      setCnicLoading(true);
      setSelectedCnic(submission);
      const [{ data: front }, { data: back }] = await Promise.all([
        supabase.storage.from("cnic-images").createSignedUrl(`buyers/${submission.user_id}/front`, 60),
        supabase.storage.from("cnic-images").createSignedUrl(`buyers/${submission.user_id}/back`, 60),
      ]);
      setCnicUrls({ front: front?.signedUrl || null, back: back?.signedUrl || null });
    } catch (err) {
      console.error(err);
      toast.error("Could not load CNIC images");
    } finally {
      setCnicLoading(false);
    }
  };

  // ── View CNIC edit request ────────────────────────────────────────
  const handleViewEditRequest = async (editRequest) => {
    setSelectedEdit(editRequest);
    setEditCnicUrls({ front: null, back: null });
    if (!editRequest.pending_cnic_front && !editRequest.pending_cnic_back) return;
    try {
      setEditCnicLoading(true);
      const [frontRes, backRes] = await Promise.all([
        editRequest.pending_cnic_front
          ? supabase.storage.from("cnic-images").createSignedUrl(editRequest.pending_cnic_front, 60)
          : { data: null },
        editRequest.pending_cnic_back
          ? supabase.storage.from("cnic-images").createSignedUrl(editRequest.pending_cnic_back, 60)
          : { data: null },
      ]);
      setEditCnicUrls({
        front: frontRes.data?.signedUrl || null,
        back:  backRes.data?.signedUrl  || null,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setEditCnicLoading(false);
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

      const [{ error: profileErr }, { error: subErr }] = await Promise.all([
        supabase.from("profiles").update({ role: "buyer", id_verified: "approved" }).eq("id", submission.user_id),
        supabase.from("pending_cnic_submissions").update({ status: "approved" }).eq("id", submission.submissionId),
      ]);
      if (profileErr) console.error("Profile update error:", profileErr);
      if (subErr)     console.error("Submission update error:", subErr);

      await Promise.all([
        logAdminAction(user.id, "approve", newBuyer.id, "buyers", "Bidder CNIC approved by admin"),
        supabase.from("notifications").insert({
          user_id: submission.user_id,
          title: "CNIC Verified — You Can Now Bid! 🎉",
          message: "Your identity has been verified. You can now place bids on auctions.",
          type: "approval", notification_for: "buyer", is_read: false,
        }),
      ]);

      toast.success(`${submission.name} approved as bidder!`);
      refetchBidders(); // ✅ context refresh — realtime will also update
    } catch (err) {
      console.error(err);
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

      await Promise.all([
        supabase.from("pending_cnic_submissions")
          .update({ status: "rejected", rejection_reason: reasonText })
          .eq("id", selectedBidder.submissionId),
        supabase.from("profiles")
          .update({ id_verified: "rejected" })
          .eq("id", selectedBidder.user_id),
      ]);

      await Promise.all([
        logAdminAction(user.id, "reject", selectedBidder.submissionId, "buyers", reasonText),
        supabase.from("notifications").insert({
          user_id: selectedBidder.user_id,
          title: "CNIC Verification Rejected",
          message: `Your CNIC verification was rejected. Reason: ${reasonText}`,
          type: "approval", notification_for: "buyer", is_read: false,
        }),
      ]);

      toast.success(`${selectedBidder.name} rejected`);
      setSelectedBidder(null);
      refetchBidders(); // ✅
    } catch (err) {
      console.error(err);
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
      if (buyerErr)  { toast.error("Error applying CNIC changes"); return; }
      if (changeErr) console.error("pending_changes update error:", changeErr);

      await Promise.all([
        logAdminAction(user.id, "approve", editRequest.id, "buyers", "Buyer CNIC update approved by admin"),
        supabase.from("notifications").insert({
          user_id: editRequest.user_id,
          title: "CNIC Update Approved ✅",
          message: "Your CNIC update request has been approved.",
          type: "approval", notification_for: "buyer", is_read: false,
        }),
      ]);

      toast.success(`CNIC update approved for ${editRequest.userName}`);
      setSelectedEdit(null);
      refetchBuyerEdits(); // ✅
    } catch (err) {
      console.error(err);
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
          user_id: editRejectModal.user_id,
          title: "CNIC Update Rejected",
          message: `Your CNIC update request was rejected. Reason: ${editRejectReason}`,
          type: "approval", notification_for: "buyer", is_read: false,
        }),
      ]);

      toast.success(`Edit request rejected for ${editRejectModal.userName}`);
      setEditRejectModal(null); setEditRejectReason(""); setSelectedEdit(null);
      refetchBuyerEdits(); // ✅
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong");
    } finally {
      setProcessing(false);
    }
  };

  // ── Suspend / reactivate buyer ────────────────────────────────────
  const handleSuspendToggle = async () => {
    if (!suspendReason.trim()) { toast.error("Please write a reason"); return; }
    try {
      setSuspending(suspendModal.id);

      const currentStatus = suspendModal.profiles?.status;
      const newStatus = currentStatus === "suspended" ? "active" : "suspended";

      const { error } = await supabase
        .from("profiles")
        .update({ status: newStatus })
        .eq("id", suspendModal.user_id);

      if (error) { toast.error(`Error updating buyer status`); return; }

      await Promise.all([
        logAdminAction(
          user.id,
          newStatus === "suspended" ? "suspend" : "approve",
          suspendModal.id, "buyers", suspendReason
        ),
        supabase.from("notifications").insert({
          user_id: suspendModal.user_id,
          title: newStatus === "suspended" ? "Account Suspended" : "Account Reactivated",
          message: newStatus === "suspended"
            ? `Your bidder account has been suspended. Reason: ${suspendReason}`
            : `Your bidder account has been reactivated. Reason: ${suspendReason}`,
          type: "approval", notification_for: "buyer", is_read: false,
        }),
      ]);

      toast.success(newStatus === "suspended" ? `${suspendModal.name} suspended` : `${suspendModal.name} reactivated`);
      setSuspendModal(null); setSuspendReason("");
      refetchBidders(); // ✅
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong");
    } finally {
      setSuspending(null);
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
    { title: "Pending Registrations", value: biddersLoading  ? "..." : totalPending,         subtitle: "Awaiting CNIC verification" },
    { title: "Approved Bidders",      value: biddersLoading  ? "..." : totalApproved,        subtitle: "Allowed to place bids" },
    { title: "Rejected Registrations",value: biddersLoading  ? "..." : totalRejected,        subtitle: "CNIC not approved" },
    { title: "Pending CNIC Edits",    value: buyerEditsLoading ? "..." : pendingBuyerEdits.length, subtitle: "Edit requests from buyers" },
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

      <div className="stats-grid">
        {statsData.map((item, i) => (
          <StatCard key={i} title={item.title} value={item.value} subtitle={item.subtitle} />
        ))}
      </div>

      {/* PENDING REGISTRATIONS */}
      <div className="admin-section">
        <h3 className="admin-section-heading">Pending Bidder Registrations</h3>
        {biddersLoading ? <div className="loading-state">Loading bidders...</div> : (
          <div className="table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th><th>Email</th><th>CNIC No</th>
                  <th>View CNIC</th><th>Submitted</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingSubmissions.length === 0 ? renderEmptyRow(6, "No pending bidder registrations.") :
                  pendingSubmissions.map((s) => (
                    <tr key={s.id}>
                      <td>{s.name}</td>
                      <td>{s.email}</td>
                      <td>{s.cnic_number}</td>
                      <td>
                        <span className="view-image-link" onClick={() => handleViewCnic(s)}>
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

      {/* PENDING CNIC EDIT REQUESTS */}
      <div className="admin-section">
        <h3 className="admin-section-heading">Pending CNIC Update Requests</h3>
        {buyerEditsLoading ? <div className="loading-state">Loading edit requests...</div> : (
          <div className="table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Buyer Name</th><th>Email</th><th>New CNIC No</th>
                  <th>Has New Images</th><th>Submitted</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingBuyerEdits.length === 0 ? renderEmptyRow(6, "No pending CNIC update requests.") :
                  pendingBuyerEdits.map((edit) => (
                    <tr key={edit.id}>
                      <td>{edit.userName}</td>
                      <td>{edit.userEmail}</td>
                      <td>{edit.pending_cnic_number || "—"}</td>
                      <td>
                        {edit.pending_cnic_front || edit.pending_cnic_back
                          ? <span style={{ color: "#10b981", fontWeight: "600" }}>Yes</span>
                          : <span style={{ color: "#999" }}>No</span>}
                      </td>
                      <td>{formatDate(edit.created_at)}</td>
                      <td className="actions">
                        <ActionButton label="Review" variant="secondary" onClick={() => handleViewEditRequest(edit)} disabled={processing} />
                        <ActionButton label="Reject" variant="danger"
                          onClick={() => { setEditRejectModal(edit); setEditRejectReason(""); }} disabled={processing} />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* APPROVED BIDDERS */}
      <div className="admin-section">
        <h3 className="admin-section-heading">Approved Bidders</h3>
        {biddersLoading ? <div className="loading-state">Loading bidders...</div> : (
          <div className="table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th><th>Email</th><th>CNIC No</th>
                  <th>Total Bids</th><th>Auctions Won</th><th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {approvedBuyers.length === 0 ? renderEmptyRow(7, "No approved bidders.") :
                  approvedBuyers.map((buyer) => (
                    <tr key={buyer.id}>
                      <td>{buyer.name}</td>
                      <td>{buyer.email}</td>
                      <td>{buyer.cnic_number}</td>
                      <td>{buyer.totalBids}</td>
                      <td>{buyer.auctionsWon}</td>
                      <td><StatusBadge label="Approved" type="approved" /></td>
                      <td className="actions">
                        <ActionButton
                          label={buyer.profiles?.status === "suspended" ? "Activate" : "Suspend"}
                          variant={buyer.profiles?.status === "suspended" ? "success" : "danger"}
                          onClick={() => { setSuspendModal(buyer); setSuspendReason(""); }}
                          disabled={suspending === buyer.id}
                        />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* REJECTED REGISTRATIONS */}
      <div className="admin-section">
        <h3 className="admin-section-heading">Rejected Registrations</h3>
        {biddersLoading ? <div className="loading-state">Loading...</div> : (
          <div className="table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th><th>Email</th><th>CNIC No</th><th>Status</th><th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {rejectedSubmissions.length === 0 ? renderEmptyRow(5, "No rejected registrations.") :
                  rejectedSubmissions.map((s) => (
                    <tr key={s.id}>
                      <td>{s.name}</td>
                      <td>{s.email}</td>
                      <td>{s.cnic_number}</td>
                      <td><StatusBadge label="Rejected" type="rejected" /></td>
                      <td><span className="long-text" title={s.rejection_reason}>{s.rejection_reason || "—"}</span></td>
                    </tr>
                  ))}
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

      {/* CNIC VIEW MODAL */}
      {selectedCnic && (
        <div className="cnic-modal-overlay">
          <div className="cnic-modal">
            <h3>CNIC Details — {selectedCnic.name}</h3>
            {cnicLoading ? (
              <div style={{ textAlign: "center", padding: "30px" }}>Loading images...</div>
            ) : (
              <div className="cnic-images">
                <div>
                  <p>Front Side</p>
                  {cnicUrls.front ? <img src={cnicUrls.front} alt="CNIC Front" /> : <p style={{ color: "#999" }}>Image not available</p>}
                </div>
                <div>
                  <p>Back Side</p>
                  {cnicUrls.back ? <img src={cnicUrls.back} alt="CNIC Back" /> : <p style={{ color: "#999" }}>Image not available</p>}
                </div>
              </div>
            )}
            <button className="close-btn" onClick={() => { setSelectedCnic(null); setCnicUrls({ front: null, back: null }); }}>
              Close
            </button>
          </div>
        </div>
      )}

      {/* EDIT REVIEW MODAL */}
      {selectedEdit && (
        <div className="cnic-modal-overlay">
          <div className="cnic-modal" style={{ maxWidth: "560px", width: "90%" }}>
            <h3>CNIC Update Request — {selectedEdit.userName}</h3>
            <p style={{ color: "#666", fontSize: "13px", marginBottom: "16px" }}>{selectedEdit.userEmail}</p>
            {selectedEdit.pending_cnic_number && (
              <div className="result-row" style={{ marginBottom: "16px" }}>
                <span className="result-label">New CNIC No</span>
                <span className="result-value">{selectedEdit.pending_cnic_number}</span>
              </div>
            )}
            {(selectedEdit.pending_cnic_front || selectedEdit.pending_cnic_back) && (
              <>
                <p style={{ fontWeight: "600", marginBottom: "10px", fontSize: "14px" }}>New CNIC Images</p>
                {editCnicLoading ? (
                  <div style={{ textAlign: "center", padding: "20px", color: "#999" }}>Loading CNIC images...</div>
                ) : (
                  <div className="cnic-images" style={{ marginBottom: "16px" }}>
                    <div>
                      <p>Front Side</p>
                      {editCnicUrls.front ? <img src={editCnicUrls.front} alt="New CNIC Front" /> : <p style={{ color: "#999" }}>Not available</p>}
                    </div>
                    <div>
                      <p>Back Side</p>
                      {editCnicUrls.back ? <img src={editCnicUrls.back} alt="New CNIC Back" /> : <p style={{ color: "#999" }}>Not available</p>}
                    </div>
                  </div>
                )}
              </>
            )}
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button className="close-btn" onClick={() => setSelectedEdit(null)}>Close</button>
              <button className="close-btn"
                style={{ background: "#ef4444", color: "#fff", border: "none" }}
                onClick={() => { setEditRejectModal(selectedEdit); setEditRejectReason(""); setSelectedEdit(null); }}
                disabled={processing}>Reject</button>
              <button className="create-btn" onClick={() => handleApproveEdit(selectedEdit)} disabled={processing}>
                {processing ? "Approving..." : "Approve"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT REJECT REASON MODAL */}
      {editRejectModal && (
        <div className="reason-modal-overlay">
          <div className="reason-modal">
            <h3>Reject CNIC Update</h3>
            <p style={{ fontSize: "13px", color: "#666", marginBottom: "8px" }}>
              Rejecting update for: <strong>{editRejectModal.userName}</strong>
            </p>
            <textarea placeholder="Write reason here..." value={editRejectReason}
              onChange={(e) => setEditRejectReason(e.target.value)} />
            <div className="modal-actions">
              <button className="cancel" onClick={() => { setEditRejectModal(null); setEditRejectReason(""); }} disabled={processing}>Cancel</button>
              <button className="confirm" onClick={handleRejectEdit} disabled={processing}>
                {processing ? "Processing..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REGISTRATION REJECT MODAL */}
      {selectedBidder && (
        <div className="reason-modal-overlay">
          <div className="reason-modal">
            <h3>Reject Bidder Registration</h3>
            <p style={{ fontSize: "13px", color: "#666", marginBottom: "8px" }}>
              Rejecting: <strong>{selectedBidder.name}</strong>
            </p>
            <textarea placeholder="Write reason here..." value={reasonText}
              onChange={(e) => setReasonText(e.target.value)} />
            <div className="modal-actions">
              <button className="cancel" onClick={() => setSelectedBidder(null)} disabled={processing}>Cancel</button>
              <button className="confirm" onClick={handleConfirmReject} disabled={processing}>
                {processing ? "Processing..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUSPEND MODAL */}
      {suspendModal && (
        <div className="reason-modal-overlay">
          <div className="reason-modal">
            <h3>{suspendModal.profiles?.status === "suspended" ? "Activate Buyer" : "Suspend Buyer"}</h3>
            <p style={{ fontSize: "13px", color: "#666", marginBottom: "8px" }}>
              {suspendModal.profiles?.status === "suspended" ? "Activating" : "Suspending"}: <strong>{suspendModal.name}</strong>
            </p>
            <textarea placeholder="Write reason here..." value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)} />
            <div className="modal-actions">
              <button className="cancel" onClick={() => { setSuspendModal(null); setSuspendReason(""); }} disabled={suspending}>Cancel</button>
              <button className="confirm" onClick={handleSuspendToggle} disabled={suspending}>
                {suspending ? "Processing..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default BidderManagement;