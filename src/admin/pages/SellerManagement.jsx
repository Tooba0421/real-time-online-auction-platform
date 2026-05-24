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

  // ✅ Read from AdminContext — no local fetch, realtime handled by context
  const {
    sellers, sellersLoading,
    pendingSellerEdits, sellerEditsLoading,
    refetchSellers, refetchSellerEdits,
  } = useAdminContext();

  const pendingSellers  = sellers?.pending  || [];
  const approvedSellers = sellers?.approved || [];
  const rejectedSellers = sellers?.rejected || [];

  // ── UI-only local state (modals, forms) ───────────────────────────
  const [selectedCnicSeller, setSelectedCnicSeller] = useState(null);
  const [sellerCnicUrls, setSellerCnicUrls] = useState({ front: null, back: null });
  const [sellerCnicLoading, setSellerCnicLoading] = useState(false);

  const [selectedEdit, setSelectedEdit] = useState(null);
  const [editCnicUrls, setEditCnicUrls] = useState({ front: null, back: null });
  const [editCnicLoading, setEditCnicLoading] = useState(false);
  const [editRejectModal, setEditRejectModal] = useState(null);
  const [editRejectReason, setEditRejectReason] = useState("");

  const [selectedSeller, setSelectedSeller] = useState(null);
  const [reasonText, setReasonText] = useState("");
  const [actionType, setActionType] = useState("");
  const [processing, setProcessing] = useState(false);

  // ── View CNIC images ──────────────────────────────────────────────
  const handleViewSellerCnic = async (seller) => {
    try {
      setSellerCnicLoading(true);
      setSelectedCnicSeller(seller);
      const [{ data: front }, { data: back }] = await Promise.all([
        supabase.storage.from("cnic-images").createSignedUrl(`sellers/${seller.user_id}/front`, 60),
        supabase.storage.from("cnic-images").createSignedUrl(`sellers/${seller.user_id}/back`, 60),
      ]);
      setSellerCnicUrls({ front: front?.signedUrl || null, back: back?.signedUrl || null });
    } catch (err) {
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
      const results = await Promise.all([
        editRequest.pending_cnic_front
          ? supabase.storage.from("cnic-images").createSignedUrl(editRequest.pending_cnic_front, 60)
          : { data: null },
        editRequest.pending_cnic_back
          ? supabase.storage.from("cnic-images").createSignedUrl(editRequest.pending_cnic_back, 60)
          : { data: null },
      ]);
      setEditCnicUrls({
        front: results[0].data?.signedUrl || null,
        back:  results[1].data?.signedUrl || null,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setEditCnicLoading(false);
    }
  };

  // ── Approve edit ──────────────────────────────────────────────────
  const handleApproveEdit = async (editRequest) => {
    try {
      setProcessing(true);
      const payload = {};
      if (editRequest.pending_phone_no)     payload.phone_no     = editRequest.pending_phone_no;
      if (editRequest.pending_city)         payload.city         = editRequest.pending_city;
      if (editRequest.pending_postal_code)  payload.postal_code  = editRequest.pending_postal_code;
      if (editRequest.pending_address)      payload.address      = editRequest.pending_address;
      if (editRequest.pending_cnic_number)  payload.cnic_number  = editRequest.pending_cnic_number;
      if (editRequest.pending_cnic_front)   payload.cnic_front   = editRequest.pending_cnic_front;
      if (editRequest.pending_cnic_back)    payload.cnic_back    = editRequest.pending_cnic_back;

      const { error } = await supabase.from("sellers").update(payload).eq("user_id", editRequest.user_id);
      if (error) { toast.error("Error applying seller changes"); return; }

      await supabase.from("pending_changes").update({ status: "approved" }).eq("id", editRequest.id);
      await logAdminAction(user.id, "approve", editRequest.id, "sellers", "Seller profile update approved");
      await supabase.from("notifications").insert({
        user_id: editRequest.user_id,
        title: "Profile Update Approved ✅",
        message: "Your profile update request has been approved.",
        type: "approval", notification_for: "seller", is_read: false,
      });

      toast.success(`Profile update approved for ${editRequest.userName}`);
      setSelectedEdit(null);
      refetchSellerEdits(); // ✅ refresh context
    } catch (err) {
      console.error(err); toast.error("Something went wrong");
    } finally { setProcessing(false); }
  };

  // ── Reject edit ───────────────────────────────────────────────────
  const handleRejectEdit = async () => {
    if (!editRejectReason.trim()) { toast.error("Please write a reason"); return; }
    try {
      setProcessing(true);
      const { error } = await supabase.from("pending_changes")
        .update({ status: "rejected", reason: editRejectReason })
        .eq("id", editRejectModal.id);
      if (error) { toast.error("Error rejecting edit request"); return; }

      await logAdminAction(user.id, "reject", editRejectModal.id, "sellers", editRejectReason);
      await supabase.from("notifications").insert({
        user_id: editRejectModal.user_id,
        title: "Profile Update Rejected",
        message: `Your profile update was rejected. Reason: ${editRejectReason}`,
        type: "approval", notification_for: "seller", is_read: false,
      });

      toast.success(`Edit request rejected for ${editRejectModal.userName}`);
      setEditRejectModal(null); setEditRejectReason(""); setSelectedEdit(null);
      refetchSellerEdits(); // ✅ refresh context
    } catch (err) {
      console.error(err); toast.error("Something went wrong");
    } finally { setProcessing(false); }
  };

  // ── Approve seller registration ───────────────────────────────────
  const handleApprove = async (seller) => {
    try {
      setProcessing(true);
      const { error: sErr } = await supabase.from("sellers")
        .update({ is_verified: "approved" }).eq("id", seller.id);
      if (sErr) { toast.error("Error approving seller"); return; }

      const { error: pErr } = await supabase.from("profiles")
        .update({ role: "seller", id_verified: "approved" }).eq("id", seller.user_id);
      if (pErr) { toast.error("Error updating seller role"); return; }

      await logAdminAction(user.id, "approve", seller.id, "sellers", "Seller approved by admin");
      await supabase.from("notifications").insert({
        user_id: seller.user_id,
        title: "Seller Application Approved! 🎉",
        message: "Your seller application has been approved. You can now list products and create auctions.",
        type: "approval", notification_for: "seller", is_read: false,
      });

      toast.success(`${seller.name} approved as seller!`);
      refetchSellers(); // ✅ refresh context
    } catch (err) {
      console.error(err); toast.error("Something went wrong");
    } finally { setProcessing(false); }
  };

  const openReasonModal = (seller, type) => {
    setSelectedSeller(seller); setActionType(type); setReasonText("");
  };

  // ── Reject / Suspend seller ───────────────────────────────────────
  const handleConfirmAction = async () => {
    if (!reasonText.trim()) { toast.error("Please write a reason"); return; }
    try {
      setProcessing(true);
      const newStatus = actionType === "reject" ? "rejected" : "suspended";

      const { error: sErr } = await supabase.from("sellers")
        .update({ is_verified: newStatus }).eq("id", selectedSeller.id);
      if (sErr) { toast.error(`Error ${actionType}ing seller`); return; }

      if (actionType === "suspend") {
        await supabase.from("profiles").update({ role: "user" }).eq("id", selectedSeller.user_id);
      }

      await logAdminAction(
        user.id, actionType === "reject" ? "reject" : "suspend",
        selectedSeller.id, "sellers", reasonText
      );
      await supabase.from("notifications").insert({
        user_id: selectedSeller.user_id,
        title: actionType === "reject" ? "Seller Application Rejected" : "Seller Account Suspended",
        message: actionType === "reject"
          ? `Your application was rejected. Reason: ${reasonText}`
          : `Your account was suspended. Reason: ${reasonText}`,
        type: "approval", notification_for: "seller", is_read: false,
      });

      toast.success(actionType === "reject"
        ? `${selectedSeller.name} rejected`
        : `${selectedSeller.name} suspended`
      );
      setSelectedSeller(null);
      refetchSellers(); // ✅ refresh context
    } catch (err) {
      console.error(err); toast.error("Something went wrong");
    } finally { setProcessing(false); }
  };

  const renderEmptyRow = (colSpan, msg) => (
    <tr><td colSpan={colSpan} className="empty-row">{msg}</td></tr>
  );

  const formatDate = (d) => !d ? "—" : new Date(d).toLocaleDateString("en-PK", {
    year: "numeric", month: "short", day: "numeric",
  });

  // ── Stats ─────────────────────────────────────────────────────────
  const totalApproved  = approvedSellers.length;
  const totalPending   = pendingSellers.length;
  const totalRejected  = rejectedSellers.length;
  const totalListings  = approvedSellers.reduce((s, x) => s + (x.listings || 0), 0);

  const statsData = [
    { title: "Approved Sellers",      value: sellersLoading ? "..." : totalApproved,  subtitle: "Currently active sellers" },
    { title: "Pending Requests",      value: sellersLoading ? "..." : totalPending,   subtitle: "Awaiting verification" },
    { title: "Rejected / Suspended",  value: sellersLoading ? "..." : totalRejected,  subtitle: "Restricted sellers" },
    { title: "Total Listings",        value: sellersLoading ? "..." : totalListings,  subtitle: "From approved sellers" },
  ];

  const sellerStatusData = useMemo(() => ({
    labels: ["Approved", "Pending", "Rejected / Suspended"],
    datasets: [{ data: [totalApproved, totalPending, totalRejected],
      backgroundColor: ["#10B981", "#F59E0B", "#EF4444"] }],
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
                {pendingSellers.length === 0 ? renderEmptyRow(9, "No pending sellers.") :
                  pendingSellers.map((s) => (
                    <tr key={s.id}>
                      <td>{s.name}</td><td>{s.email}</td><td>{s.business_name}</td>
                      <td>{s.city}</td>
                      <td><span className="long-text" title={s.address}>{s.address}</span></td>
                      <td>{s.cnic_number}</td>
                      <td>
                        <span className="view-image-link" onClick={() => handleViewSellerCnic(s)}>
                          View CNIC
                        </span>
                      </td>
                      <td>{formatDate(s.created_at)}</td>
                      <td className="actions">
                        <ActionButton label="Approve" variant="success" onClick={() => handleApprove(s)} disabled={processing} />
                        <ActionButton label="Reject"  variant="danger"  onClick={() => openReasonModal(s, "reject")} disabled={processing} />
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
                {pendingSellerEdits.length === 0 ? renderEmptyRow(10, "No pending profile edit requests.") :
                  pendingSellerEdits.map((edit) => (
                    <tr key={edit.id}>
                      <td>{edit.userName}</td><td>{edit.userEmail}</td>
                      <td>
                        <span style={{ background: "#e0f2fe", color: "#0369a1", padding: "2px 8px", borderRadius: "4px", fontSize: "12px" }}>
                          {edit.change_type || "all"}
                        </span>
                      </td>
                      <td>{edit.pending_phone_no || "—"}</td>
                      <td>{edit.pending_city || "—"}</td>
                      <td><span className="long-text" title={edit.pending_address}>{edit.pending_address || "—"}</span></td>
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

      {/* APPROVED SELLERS */}
      <div className="admin-section">
        <h3 className="admin-section-heading">Approved Sellers</h3>
        {sellersLoading ? <div className="loading-state">Loading sellers...</div> : (
          <div className="table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Seller</th><th>Email</th><th>Business</th><th>Listings</th>
                  <th>Success Rate</th><th>Earnings</th><th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {approvedSellers.length === 0 ? renderEmptyRow(8, "No approved sellers.") :
                  approvedSellers.map((s) => (
                    <tr key={s.id}>
                      <td>{s.name}</td><td>{s.email}</td><td>{s.business_name}</td>
                      <td>{s.listings}</td><td>{s.successRate}</td><td>{s.earnings}</td>
                      <td><StatusBadge label="Approved" type="approved" /></td>
                      <td className="actions">
                        <ActionButton label="Suspend" variant="danger"
                          onClick={() => openReasonModal(s, "suspend")} disabled={processing} />
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
        <h3 className="admin-section-heading">Rejected / Suspended Sellers</h3>
        {sellersLoading ? <div className="loading-state">Loading sellers...</div> : (
          <div className="table-wrapper">
            <table className="admin-table">
              <thead>
                <tr><th>Seller</th><th>Email</th><th>Business</th><th>Status</th><th>Reason</th></tr>
              </thead>
              <tbody>
                {rejectedSellers.length === 0 ? renderEmptyRow(5, "No rejected sellers.") :
                  rejectedSellers.map((s) => (
                    <tr key={s.id}>
                      <td>{s.name}</td><td>{s.email}</td><td>{s.business_name}</td>
                      <td>
                        <StatusBadge
                          label={s.is_verified === "rejected" ? "Rejected" : "Suspended"}
                          type="rejected"
                        />
                      </td>
                      <td><span className="long-text" title={s.reason}>{s.reason || "—"}</span></td>
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

      {/* SELLER CNIC MODAL */}
      {selectedCnicSeller && (
        <div className="cnic-modal-overlay">
          <div className="cnic-modal">
            <h3>CNIC Details — {selectedCnicSeller.name}</h3>
            {sellerCnicLoading ? (
              <div style={{ textAlign: "center", padding: "30px" }}>Loading images...</div>
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
            }}>Close</button>
          </div>
        </div>
      )}

      {/* EDIT REVIEW MODAL */}
      {selectedEdit && (
        <div className="cnic-modal-overlay">
          <div className="cnic-modal" style={{ maxWidth: "600px", width: "90%" }}>
            <h3>Profile Update Request — {selectedEdit.userName}</h3>
            <p style={{ color: "#666", fontSize: "13px", marginBottom: "16px" }}>{selectedEdit.userEmail}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
              {[
                ["New Phone", selectedEdit.pending_phone_no],
                ["New City", selectedEdit.pending_city],
                ["New Postal Code", selectedEdit.pending_postal_code],
                ["New Address", selectedEdit.pending_address],
                ["New CNIC No", selectedEdit.pending_cnic_number],
              ].filter(([, v]) => v).map(([label, val]) => (
                <div key={label} className="result-row">
                  <span className="result-label">{label}</span>
                  <span className="result-value">{val}</span>
                </div>
              ))}
            </div>
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
            <h3>Reject Profile Update</h3>
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

      {/* SELLER APPROVE/REJECT REASON MODAL */}
      {selectedSeller && (
        <div className="reason-modal-overlay">
          <div className="reason-modal">
            <h3>{actionType === "reject" ? "Reject Seller" : "Suspend Seller"}</h3>
            <p style={{ fontSize: "13px", color: "#666", marginBottom: "8px" }}>
              {actionType === "reject" ? "Rejecting" : "Suspending"}: <strong>{selectedSeller.name}</strong>
            </p>
            <textarea placeholder="Write reason here..." value={reasonText}
              onChange={(e) => setReasonText(e.target.value)} />
            <div className="modal-actions">
              <button className="cancel" onClick={() => setSelectedSeller(null)} disabled={processing}>Cancel</button>
              <button className="confirm" onClick={handleConfirmAction} disabled={processing}>
                {processing ? "Processing..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default SellerManagement;