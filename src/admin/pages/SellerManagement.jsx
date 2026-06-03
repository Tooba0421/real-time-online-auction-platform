import { useState, useMemo } from "react";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { Doughnut } from "react-chartjs-2";
import { supabase } from "../../supabase/supabase";
import { useAuthContext } from "../../context/AuthContext";
import { useAdminContext } from "../../context/AdminContext";
import toast from "react-hot-toast";
import StatCard from "../../common/components/StatCard";
import StatusBadge from "../../common/components/StatusBadge";
import ActionButton from "../../common/components/ActionButton";
import "../styles/adminLayout.css";
import "../styles/sellerManagement.css";

ChartJS.register(ArcElement, Tooltip, Legend);

const logAdminAction = async (adminId, actionType, targetId, targetTable, remarks) => {
  try {
    await supabase.from("admin_actions").insert({
      admin_id: adminId, action_type: actionType,
      target_id: targetId, target_table: targetTable, remarks,
    });
  } catch (err) { console.error("Admin action log error:", err); }
};

const SellerManagement = () => {
  const { user } = useAuthContext();
  const {
    sellers, sellersLoading,
    pendingSellerEdits, sellerEditsLoading,
    refetchSellers, refetchSellerEdits,
  } = useAdminContext();

  const pendingSellers  = sellers?.pending  || [];
  const approvedSellers = sellers?.approved || [];
  const rejectedSellers = sellers?.rejected || [];

  const [selectedCnicSeller, setSelectedCnicSeller] = useState(null);
  const [sellerCnicUrls,     setSellerCnicUrls]     = useState({ front: null, back: null });
  const [sellerCnicLoading,  setSellerCnicLoading]  = useState(false);

  const [selectedEdit,     setSelectedEdit]     = useState(null);
  const [editCnicUrls,     setEditCnicUrls]     = useState({ front: null, back: null });
  const [editCnicLoading,  setEditCnicLoading]  = useState(false);
  const [editRejectModal,  setEditRejectModal]  = useState(null);
  const [editRejectReason, setEditRejectReason] = useState("");

  const [selectedSeller, setSelectedSeller] = useState(null);
  const [reasonText,     setReasonText]     = useState("");
  const [actionType,     setActionType]     = useState("");

  // FIX: processing stores seller ID, not boolean
  // This prevents all buttons from being disabled when one action runs
  const [processing, setProcessing] = useState(null);

  // ── View CNIC images ──────────────────────────────────────────────
  const handleViewSellerCnic = async (seller) => {
    try {
      setSellerCnicLoading(true);
      setSelectedCnicSeller(seller);

      let frontUrl = null;
      let backUrl  = null;

      try {
        const { data } = await supabase.storage
          .from("cnic-images")
          .createSignedUrl(`sellers/${seller.user_id}/front`, 60);
        frontUrl = data?.signedUrl || null;
      } catch { /* file may not exist */ }

      try {
        const { data } = await supabase.storage
          .from("cnic-images")
          .createSignedUrl(`sellers/${seller.user_id}/back`, 60);
        backUrl = data?.signedUrl || null;
      } catch { /* file may not exist */ }

      setSellerCnicUrls({ front: frontUrl, back: backUrl });
      if (!frontUrl && !backUrl) toast.error("No CNIC images found for this seller");

    } catch (err) {
      console.error(err);
      toast.error("Could not load CNIC images");
    } finally {
      setSellerCnicLoading(false);
    }
  };

  // ── View edit request ─────────────────────────────────────────────
  const handleViewEditRequest = async (editRequest) => {
    setSelectedEdit(editRequest);
    setEditCnicUrls({ front: null, back: null });
    if (!editRequest.pending_cnic_front && !editRequest.pending_cnic_back) return;
    try {
      setEditCnicLoading(true);

      let frontUrl = null;
      let backUrl  = null;

      if (editRequest.pending_cnic_front) {
        const { data } = await supabase.storage
          .from("cnic-images")
          .createSignedUrl(editRequest.pending_cnic_front, 60);
        frontUrl = data?.signedUrl || null;
      }
      if (editRequest.pending_cnic_back) {
        const { data } = await supabase.storage
          .from("cnic-images")
          .createSignedUrl(editRequest.pending_cnic_back, 60);
        backUrl = data?.signedUrl || null;
      }

      setEditCnicUrls({ front: frontUrl, back: backUrl });
    } catch (err) {
      console.error(err);
      toast.error("Could not load CNIC images");
    } finally {
      setEditCnicLoading(false);
    }
  };

  // ── Approve edit ──────────────────────────────────────────────────
  const handleApproveEdit = async (editRequest) => {
    try {
      setProcessing(editRequest.id);

      const payload = {};
      if (editRequest.pending_phone_no)     payload.phone_no     = editRequest.pending_phone_no;
      if (editRequest.pending_city)         payload.city         = editRequest.pending_city;
      if (editRequest.pending_postal_code)  payload.postal_code  = editRequest.pending_postal_code;
      if (editRequest.pending_address)      payload.address      = editRequest.pending_address;
      if (editRequest.pending_cnic_number)  payload.cnic_number  = editRequest.pending_cnic_number;
      if (editRequest.pending_cnic_front)   payload.cnic_front   = editRequest.pending_cnic_front;
      if (editRequest.pending_cnic_back)    payload.cnic_back    = editRequest.pending_cnic_back;

      const { error } = await supabase
        .from("sellers")
        .update(payload)
        .eq("user_id", editRequest.user_id);

      if (error) { toast.error("Error applying seller changes"); return; }

      await supabase
        .from("pending_changes")
        .update({ status: "approved" })
        .eq("id", editRequest.id);

      await logAdminAction(user.id, "approve", editRequest.id, "sellers", "Seller profile update approved");

      await supabase.from("notifications").insert({
        user_id: editRequest.user_id,
        title:   "Profile Update Approved ✅",
        message: "Your profile update request has been approved.",
        type: "approval", notification_for: "seller", is_read: false,
      });

      toast.success(`Profile update approved for ${editRequest.userName}`);
      setSelectedEdit(null);
      await refetchSellerEdits();
      await refetchSellers();
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong");
    } finally {
      setProcessing(null);
    }
  };

  // ── Reject edit ───────────────────────────────────────────────────
  const handleRejectEdit = async () => {
    if (!editRejectReason.trim()) { toast.error("Please write a reason"); return; }
    try {
      setProcessing(editRejectModal.id);

      const { error } = await supabase
        .from("pending_changes")
        .update({ status: "rejected", reason: editRejectReason.trim() })
        .eq("id", editRejectModal.id);

      if (error) { toast.error("Error rejecting edit request"); return; }

      await logAdminAction(user.id, "reject", editRejectModal.id, "sellers", editRejectReason.trim());

      await supabase.from("notifications").insert({
        user_id: editRejectModal.user_id,
        title:   "Profile Update Rejected",
        message: `Your profile update was rejected. Reason: ${editRejectReason.trim()}`,
        type: "approval", notification_for: "seller", is_read: false,
      });

      toast.success(`Edit request rejected for ${editRejectModal.userName}`);
      setEditRejectModal(null);
      setEditRejectReason("");
      setSelectedEdit(null);
      await refetchSellerEdits();
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong");
    } finally {
      setProcessing(null);
    }
  };

  // ── Approve seller registration ───────────────────────────────────
  const handleApprove = async (seller) => {
    try {
      setProcessing(seller.id);

      const { error: sErr } = await supabase
        .from("sellers")
        .update({ is_verified: "approved" })
        .eq("id", seller.id);

      if (sErr) { toast.error("Error approving seller"); return; }

      const { error: pErr } = await supabase
        .from("profiles")
        .update({ role: "seller", id_verified: "approved" })
        .eq("id", seller.user_id);

      if (pErr) { toast.error("Error updating seller role"); return; }

      await logAdminAction(user.id, "approve", seller.id, "sellers", "Seller approved by admin");

      await supabase.from("notifications").insert({
        user_id: seller.user_id,
        title:   "Seller Application Approved! 🎉",
        message: "Your seller application has been approved. You can now list products and create auctions.",
        type: "approval", notification_for: "seller", is_read: false,
      });

      toast.success(`${seller.name} approved as seller!`);
      await refetchSellers();
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong");
    } finally {
      setProcessing(null);
    }
  };

  const openReasonModal = (seller, type) => {
    setSelectedSeller(seller);
    setActionType(type);
    setReasonText("");
  };

  // ── Reject seller ─────────────────────────────────────────────────
  const handleConfirmReject = async () => {
    if (!reasonText.trim()) { toast.error("Please write a reason"); return; }

    try {
      setProcessing(selectedSeller.id);

      // FIX: Update is_verified AND also update profiles.id_verified
      const { error: sErr } = await supabase
        .from("sellers")
        .update({ is_verified: "rejected" })
        .eq("id", selectedSeller.id);

      if (sErr) { toast.error("Error rejecting seller"); return; }

      // FIX: Also update profile id_verified so profile page shows correct state
      const { error: pErr } = await supabase
        .from("profiles")
        .update({ id_verified: "rejected" })
        .eq("id", selectedSeller.user_id);

      if (pErr) console.error("Profile id_verified update error (non-critical):", pErr);

      // Store reason in admin_actions — AdminContext.fetchSellers reads it from here
      await logAdminAction(user.id, "reject", selectedSeller.id, "sellers", reasonText.trim());

      await supabase.from("notifications").insert({
        user_id: selectedSeller.user_id,
        title:   "Seller Application Rejected",
        message: `Your seller application was rejected. Reason: ${reasonText.trim()}`,
        type: "approval", notification_for: "seller", is_read: false,
      });

      toast.success(`${selectedSeller.name} rejected`);
      setSelectedSeller(null);
      setReasonText("");
      await refetchSellers();
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong");
    } finally {
      setProcessing(null);
    }
  };

  const renderEmptyRow = (colSpan, msg) => (
    <tr><td colSpan={colSpan} className="empty-row">{msg}</td></tr>
  );

  const formatDate = (d) => !d ? "—" : new Date(d).toLocaleDateString("en-PK", {
    year: "numeric", month: "short", day: "numeric",
  });

  const totalApproved = approvedSellers.length;
  const totalPending  = pendingSellers.length;
  const totalRejected = rejectedSellers.length;
  const totalListings = approvedSellers.reduce((s, x) => s + (x.listings || 0), 0);

  const statsData = [
    { title: "Approved Sellers", value: sellersLoading ? "..." : totalApproved, subtitle: "Currently active sellers" },
    { title: "Pending Requests", value: sellersLoading ? "..." : totalPending,  subtitle: "Awaiting verification" },
    { title: "Rejected",         value: sellersLoading ? "..." : totalRejected, subtitle: "Rejected sellers" },
    { title: "Total Listings",   value: sellersLoading ? "..." : totalListings, subtitle: "From approved sellers" },
  ];

  const sellerStatusData = useMemo(() => ({
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

      {/* PENDING SELLERS */}
      <div className="admin-section">
        <h3 className="admin-section-heading">Pending Sellers</h3>
        {sellersLoading ? <div className="loading-state">Loading sellers...</div> : (
          <div className="table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Seller</th><th>Email</th><th>Business</th><th>City</th>
                  <th>Address</th><th>CNIC No</th><th>View CNIC</th>
                  <th>Request Date</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingSellers.length === 0
                  ? renderEmptyRow(9, "No pending sellers.")
                  : pendingSellers.map((s) => (
                    <tr key={s.id}>
                      <td>{s.name}</td>
                      <td>{s.email}</td>
                      <td>{s.business_name}</td>
                      <td>{s.city}</td>
                      <td title={s.address}>
                        {s.address?.length > 30 ? s.address.substring(0, 30) + "..." : s.address || "—"}
                      </td>
                      <td>{s.cnic_number || "—"}</td>
                      <td>
                        <span className="view-image-link" onClick={() => handleViewSellerCnic(s)}>
                          View CNIC
                        </span>
                      </td>
                      <td>{formatDate(s.created_at)}</td>
                      <td className="actions">
                        <ActionButton
                          label="Approve" variant="success"
                          onClick={() => handleApprove(s)}
                          disabled={processing === s.id}
                        />
                        <ActionButton
                          label="Reject" variant="danger"
                          onClick={() => openReasonModal(s, "reject")}
                          disabled={processing === s.id}
                        />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* PENDING PROFILE EDITS */}
      <div className="admin-section">
        <h3 className="admin-section-heading">Pending Profile Updates</h3>
        {sellerEditsLoading ? <div className="loading-state">Loading edit requests...</div> : (
          <div className="table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Seller Name</th><th>Email</th><th>Change Type</th>
                  <th>Pending Phone</th><th>Pending City</th><th>Pending Address</th>
                  <th>Pending CNIC No</th><th>Has CNIC Images</th><th>Submitted</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingSellerEdits.length === 0
                  ? renderEmptyRow(10, "No pending profile edit requests.")
                  : pendingSellerEdits.map((edit) => (
                    <tr key={edit.id}>
                      <td>{edit.userName}</td>
                      <td>{edit.userEmail}</td>
                      <td>{edit.change_type || "all"}</td>
                      <td>{edit.pending_phone_no || "—"}</td>
                      <td>{edit.pending_city || "—"}</td>
                      <td title={edit.pending_address}>
                        {edit.pending_address?.length > 25
                          ? edit.pending_address.substring(0, 25) + "..."
                          : edit.pending_address || "—"}
                      </td>
                      <td>{edit.pending_cnic_number || "—"}</td>
                      <td>
                        {edit.pending_cnic_front || edit.pending_cnic_back
                          ? <span style={{ color: "#10b981", fontWeight: "600" }}>Yes</span>
                          : <span style={{ color: "#999" }}>No</span>}
                      </td>
                      <td>{formatDate(edit.created_at)}</td>
                      <td className="actions">
                        <ActionButton
                          label="Review" variant="secondary"
                          onClick={() => handleViewEditRequest(edit)}
                          disabled={processing === edit.id}
                        />
                        <ActionButton
                          label="Reject" variant="danger"
                          onClick={() => { setEditRejectModal(edit); setEditRejectReason(""); }}
                          disabled={processing === edit.id}
                        />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* APPROVED SELLERS */}
      <div className="admin-section">
        <h3 className="admin-section-heading">Approved Sellers</h3>
        {sellersLoading ? <div className="loading-state">Loading sellers...</div> : (
          <div className="table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Seller</th><th>Email</th><th>Business</th><th>Listings</th>
                  <th>Success Rate</th><th>Earnings</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {/* FIX: colSpan was 8, table has 7 columns */}
                {approvedSellers.length === 0
                  ? renderEmptyRow(7, "No approved sellers.")
                  : approvedSellers.map((s) => (
                    <tr key={s.id}>
                      <td>{s.name}</td>
                      <td>{s.email}</td>
                      <td>{s.business_name}</td>
                      <td>{s.listings}</td>
                      <td>{s.successRate}</td>
                      <td>{s.earnings}</td>
                      <td><StatusBadge label="Approved" type="approved" /></td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* REJECTED SELLERS */}
      <div className="admin-section">
        <h3 className="admin-section-heading">Rejected Sellers</h3>
        {sellersLoading ? <div className="loading-state">Loading sellers...</div> : (
          <div className="table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Seller</th><th>Email</th><th>Business</th>
                  <th>Status</th><th>Rejection Reason</th>
                </tr>
              </thead>
              <tbody>
                {rejectedSellers.length === 0
                  ? renderEmptyRow(5, "No rejected sellers.")
                  : rejectedSellers.map((s) => (
                    <tr key={s.id}>
                      <td>{s.name}</td>
                      <td>{s.email}</td>
                      <td>{s.business_name}</td>
                      <td>
                        <StatusBadge
                          label={s.is_verified === "suspended" ? "Suspended" : "Rejected"}
                          type="rejected"
                        />
                      </td>
                      {/* FIX: AdminContext stores reason in s.reason not s.rejection_reason */}
                      <td title={s.reason}>
                        {s.reason
                          ? s.reason.length > 50 ? s.reason.substring(0, 50) + "..." : s.reason
                          : "—"}
                      </td>
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
          <h3 className="admin-section-heading">Seller Status Overview</h3>
          <div className="chart-container">
            <Doughnut data={sellerStatusData} options={doughnutOptions} />
          </div>
        </div>
      </div>

      {/* CNIC VIEW MODAL */}
      {selectedCnicSeller && (
        <div className="cnic-modal-overlay" onClick={() => setSelectedCnicSeller(null)}>
          <div className="cnic-modal" onClick={(e) => e.stopPropagation()}>
            <h3>CNIC Details — {selectedCnicSeller.name}</h3>
            {sellerCnicLoading ? (
              <div className="loading-state">Loading images...</div>
            ) : (
              <div className="cnic-images">
                <div>
                  <p>Front Side</p>
                  {sellerCnicUrls.front
                    ? <img src={sellerCnicUrls.front} alt="CNIC Front" />
                    : <p style={{ color: "#999" }}>Image not available</p>}
                </div>
                <div>
                  <p>Back Side</p>
                  {sellerCnicUrls.back
                    ? <img src={sellerCnicUrls.back} alt="CNIC Back" />
                    : <p style={{ color: "#999" }}>Image not available</p>}
                </div>
              </div>
            )}
            <button className="close-btn" onClick={() => {
              setSelectedCnicSeller(null);
              setSellerCnicUrls({ front: null, back: null });
            }}>
              Close
            </button>
          </div>
        </div>
      )}

      {/* EDIT REVIEW MODAL */}
      {selectedEdit && (
        <div className="cnic-modal-overlay" onClick={() => setSelectedEdit(null)}>
          <div className="cnic-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Profile Update Request — {selectedEdit.userName}</h3>
            <p className="modal-subtitle">{selectedEdit.userEmail}</p>

            <div className="edit-details">
              {selectedEdit.pending_phone_no && (
                <div className="result-row">
                  <span className="result-label">New Phone:</span>
                  <span className="result-value">{selectedEdit.pending_phone_no}</span>
                </div>
              )}
              {selectedEdit.pending_city && (
                <div className="result-row">
                  <span className="result-label">New City:</span>
                  <span className="result-value">{selectedEdit.pending_city}</span>
                </div>
              )}
              {selectedEdit.pending_postal_code && (
                <div className="result-row">
                  <span className="result-label">New Postal Code:</span>
                  <span className="result-value">{selectedEdit.pending_postal_code}</span>
                </div>
              )}
              {selectedEdit.pending_address && (
                <div className="result-row">
                  <span className="result-label">New Address:</span>
                  <span className="result-value">{selectedEdit.pending_address}</span>
                </div>
              )}
              {selectedEdit.pending_cnic_number && (
                <div className="result-row">
                  <span className="result-label">New CNIC No:</span>
                  <span className="result-value">{selectedEdit.pending_cnic_number}</span>
                </div>
              )}
            </div>

            {(selectedEdit.pending_cnic_front || selectedEdit.pending_cnic_back) && (
              <>
                <p className="section-subtitle" style={{ marginTop: "16px", fontWeight: "600" }}>
                  New CNIC Images
                </p>
                {editCnicLoading ? (
                  <div className="loading-state">Loading CNIC images...</div>
                ) : (
                  <div className="cnic-images">
                    <div>
                      <p>Front Side</p>
                      {editCnicUrls.front
                        ? <img src={editCnicUrls.front} alt="New CNIC Front" />
                        : <p style={{ color: "#999" }}>Not available</p>}
                    </div>
                    <div>
                      <p>Back Side</p>
                      {editCnicUrls.back
                        ? <img src={editCnicUrls.back} alt="New CNIC Back" />
                        : <p style={{ color: "#999" }}>Not available</p>}
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="modal-actions" style={{ marginTop: "20px" }}>
              <button className="cancel-btn" onClick={() => setSelectedEdit(null)}>
                Close
              </button>
              <button
                className="reject-btn"
                onClick={() => { setEditRejectModal(selectedEdit); setEditRejectReason(""); setSelectedEdit(null); }}
                disabled={processing === selectedEdit.id}
              >
                Reject
              </button>
              <button
                className="approve-btn"
                onClick={() => handleApproveEdit(selectedEdit)}
                disabled={processing === selectedEdit.id}
              >
                {processing === selectedEdit.id ? "Approving..." : "Approve"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT REJECT REASON MODAL */}
      {editRejectModal && (
        <div className="reason-modal-overlay" onClick={() => setEditRejectModal(null)}>
          <div className="reason-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Reject Profile Update</h3>
            <p className="modal-subtitle">
              Rejecting update for: <strong>{editRejectModal.userName}</strong>
            </p>
            <textarea
              placeholder="Write reason here..."
              value={editRejectReason}
              onChange={(e) => setEditRejectReason(e.target.value)}
              rows="4"
            />
            <div className="modal-actions">
              <button
                className="cancel-btn"
                onClick={() => { setEditRejectModal(null); setEditRejectReason(""); }}
                disabled={processing === editRejectModal.id}
              >
                Cancel
              </button>
              <button
                className="confirm-btn"
                onClick={handleRejectEdit}
                disabled={processing === editRejectModal.id}
              >
                {processing === editRejectModal.id ? "Processing..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SELLER REJECT REASON MODAL */}
      {selectedSeller && actionType === "reject" && (
        <div className="reason-modal-overlay" onClick={() => setSelectedSeller(null)}>
          <div className="reason-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Reject Seller</h3>
            <p className="modal-subtitle">
              Rejecting: <strong>{selectedSeller.name}</strong>
            </p>
            <textarea
              placeholder="Write reason for rejection..."
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              rows="4"
            />
            <div className="modal-actions">
              <button
                className="cancel-btn"
                onClick={() => setSelectedSeller(null)}
                disabled={processing === selectedSeller.id}
              >
                Cancel
              </button>
              <button
                className="confirm-btn"
                onClick={handleConfirmReject}
                disabled={processing === selectedSeller.id}
              >
                {processing === selectedSeller.id ? "Processing..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default SellerManagement;