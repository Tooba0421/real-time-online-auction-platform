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

  const pendingSellers = sellers?.pending || [];
  const approvedSellers = sellers?.approved || [];
  const rejectedSellers = sellers?.rejected || [];

  // CNIC view modal — used by both pending sellers and edit requests
  const [cnicModal, setCnicModal] = useState(null); // { name, user_id, frontPath, backPath }
  const [cnicUrls, setCnicUrls] = useState({ front: null, back: null });
  const [cnicLoading, setCnicLoading] = useState(false);

  // Reject modals
  const [rejectModal, setRejectModal] = useState(null); // { seller, type: 'seller' | 'edit' }
  const [rejectReason, setRejectReason] = useState("");
  const [processing, setProcessing] = useState(null);

  // ── View CNIC images ──────────────────────────────────────────────
  const handleViewCnic = async ({ name, user_id, frontPath, backPath }) => {
    try {
      setCnicLoading(true);
      setCnicModal({ name, user_id, frontPath, backPath });

      let frontUrl = null, backUrl = null;

      try {
        const { data } = await supabase.storage
          .from("cnic-images").createSignedUrl(frontPath, 60);
        frontUrl = data?.signedUrl || null;
      } catch { /* file may not exist */ }

      try {
        const { data } = await supabase.storage
          .from("cnic-images").createSignedUrl(backPath, 60);
        backUrl = data?.signedUrl || null;
      } catch { /* file may not exist */ }

      setCnicUrls({ front: frontUrl, back: backUrl });
      if (!frontUrl && !backUrl) toast.error("No CNIC images found");

    } catch (err) {
      console.error(err);
      toast.error("Could not load CNIC images");
    } finally {
      setCnicLoading(false);
    }
  };

  // ── Approve seller registration ───────────────────────────────────
  const handleApprove = async (seller) => {
    try {
      setProcessing(seller.id);

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
      await refetchSellers();
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong");
    } finally {
      setProcessing(null);
    }
  };

  // ── Reject seller registration ────────────────────────────────────
  const handleRejectSeller = async () => {
    if (!rejectReason.trim()) { toast.error("Please write a reason"); return; }
    const seller = rejectModal.data;
    try {
      setProcessing(seller.id);

      await supabase.from("sellers")
        .update({ is_verified: "rejected" }).eq("id", seller.id);
      await supabase.from("profiles")
        .update({ id_verified: "rejected" }).eq("id", seller.user_id);
      await logAdminAction(user.id, "reject", seller.id, "sellers", rejectReason.trim());
      await supabase.from("notifications").insert({
        user_id: seller.user_id,
        title: "Seller Application Rejected",
        message: `Your seller application was rejected. Reason: ${rejectReason.trim()}`,
        type: "approval", notification_for: "seller", is_read: false,
      });

      toast.success(`${seller.name} rejected`);
      setRejectModal(null);
      setRejectReason("");
      await refetchSellers();
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong");
    } finally {
      setProcessing(null);
    }
  };

  // ── Approve profile edit request ──────────────────────────────────
  const handleApproveEdit = async (edit) => {
    try {
      setProcessing(edit.id);

      const payload = {};
      if (edit.pending_phone_no) payload.phone_no = edit.pending_phone_no;
      if (edit.pending_city) payload.city = edit.pending_city;
      if (edit.pending_postal_code) payload.postal_code = edit.pending_postal_code;
      if (edit.pending_address) payload.address = edit.pending_address;
      if (edit.pending_cnic_number) payload.cnic_number = edit.pending_cnic_number;
      if (edit.pending_cnic_front) payload.cnic_front = edit.pending_cnic_front;
      if (edit.pending_cnic_back) payload.cnic_back = edit.pending_cnic_back;
      if (edit.pending_jazzcash_number) payload.jazzcash_number = edit.pending_jazzcash_number;

      const { error } = await supabase.from("sellers")
        .update(payload).eq("user_id", edit.user_id);
      if (error) { toast.error("Error applying changes"); return; }

      await supabase.from("pending_changes")
        .update({ status: "approved" }).eq("id", edit.id);
      await logAdminAction(user.id, "approve", edit.id, "sellers", "Seller profile update approved");
      await supabase.from("notifications").insert({
        user_id: edit.user_id,
        title: "Profile Update Approved ✅",
        message: "Your profile update request has been approved and your information has been updated.",
        type: "approval", notification_for: "seller", is_read: false,
      });

      toast.success(`Profile update approved for ${edit.userName}`);
      await refetchSellerEdits();
      await refetchSellers();
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong");
    } finally {
      setProcessing(null);
    }
  };

  // ── Reject profile edit request ───────────────────────────────────
  const handleRejectEdit = async () => {
    if (!rejectReason.trim()) { toast.error("Please write a reason"); return; }
    const edit = rejectModal.data;
    try {
      setProcessing(edit.id);

      await supabase.from("pending_changes")
        .update({ status: "rejected", reason: rejectReason.trim() }).eq("id", edit.id);
      await logAdminAction(user.id, "reject", edit.id, "sellers", rejectReason.trim());
      await supabase.from("notifications").insert({
        user_id: edit.user_id,
        title: "Profile Update Rejected",
        message: `Your profile update was rejected. Reason: ${rejectReason.trim()}`,
        type: "approval", notification_for: "seller", is_read: false,
      });

      toast.success(`Edit request rejected for ${edit.userName}`);
      setRejectModal(null);
      setRejectReason("");
      await refetchSellerEdits();
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong");
    } finally {
      setProcessing(null);
    }
  };

  // ── Confirm reject (routes to correct handler) ────────────────────
  const handleConfirmReject = () => {
    if (rejectModal?.type === "seller") handleRejectSeller();
    else if (rejectModal?.type === "edit") handleRejectEdit();
  };

  const renderEmptyRow = (colSpan, msg) => (
    <tr><td colSpan={colSpan} className="empty-row">{msg}</td></tr>
  );

  const formatDate = (d) => !d ? "—" : new Date(d).toLocaleDateString("en-PK", {
    year: "numeric", month: "short", day: "numeric",
  });

  const totalApproved = approvedSellers.length;
  const totalPending = pendingSellers.length;
  const totalRejected = rejectedSellers.length;
  const totalListings = approvedSellers.reduce((s, x) => s + (x.listings || 0), 0);

  const statsData = [
    { title: "Approved Sellers", value: sellersLoading ? "..." : totalApproved, subtitle: "Currently active sellers" },
    { title: "Pending Requests", value: sellersLoading ? "..." : totalPending, subtitle: "Awaiting verification" },
    { title: "Rejected", value: sellersLoading ? "..." : totalRejected, subtitle: "Rejected sellers" },
    { title: "Total Listings", value: sellersLoading ? "..." : totalListings, subtitle: "From approved sellers" },
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

      {/* STAT CARDS */}
      <div className="stats-grid">
        {statsData.map((item, i) => (
          <StatCard key={i} title={item.title} value={item.value} subtitle={item.subtitle} />
        ))}
      </div>

      {/* ── PENDING SELLERS ───────────────────────────────────────── */}
      <div className="admin-section">
        <h3 className="admin-section-heading">Pending Sellers</h3>
        {sellersLoading ? <div className="loading-state">Loading sellers...</div> : (
          <div className="table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Seller</th>
                  <th>Email</th>
                  <th>Business</th>
                  <th>City</th>
                  <th>Address</th>
                  <th>CNIC No</th>
                  <th>View CNIC</th>
                  <th>JazzCash No.</th>
                  <th>Request Date</th>
                  <th>Actions</th>
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
                      <td className="long-text" title={s.address}>{s.address || "—"}</td>
                      <td>{s.cnic_number || "—"}</td>
                      <td>
                        <span
                          className="view-image-link"
                          onClick={() => handleViewCnic({
                            name: s.name,
                            user_id: s.user_id,
                            frontPath: `sellers/${s.user_id}/front`,
                            backPath: `sellers/${s.user_id}/back`,
                          })}
                        >
                          View CNIC
                        </span>
                      </td>
                      <td>{s.jazzcash_number || "—"}</td>

                      <td>{formatDate(s.created_at)}</td>
                      <td className="actions">
                        <ActionButton label="Approve" variant="success"
                          onClick={() => handleApprove(s)}
                          disabled={processing === s.id} />
                        <ActionButton label="Reject" variant="danger"
                          onClick={() => { setRejectModal({ type: "seller", data: s }); setRejectReason(""); }}
                          disabled={processing === s.id} />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── PENDING PROFILE UPDATES — all columns in table ────────── */}
      <div className="admin-section">
        <h3 className="admin-section-heading">Pending Profile Updates</h3>
        {sellerEditsLoading ? <div className="loading-state">Loading edit requests...</div> : (
          <div className="table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Seller</th>
                  <th>Email</th>
                  <th>New Phone</th>
                  <th>New City</th>
                  <th>New Address</th>
                  <th>New CNIC No</th>
                  <th>View New CNIC</th>
                  <th>New JazzCash No.</th>
                  <th>Submitted</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingSellerEdits.length === 0
                  ? renderEmptyRow(9, "No pending profile update requests.")
                  : pendingSellerEdits.map((edit) => (
                    <tr key={edit.id}>
                      <td>{edit.userName}</td>
                      <td>{edit.userEmail}</td>
                      <td>{edit.pending_phone_no || "—"}</td>
                      <td>{edit.pending_city || "—"}</td>
                      <td className="long-text" title={edit.pending_address}>
                        {edit.pending_address || "—"}
                      </td>
                      <td>{edit.pending_cnic_number || "—"}</td>
                      <td>
                        {/* Only show link if new CNIC images were submitted */}
                        {edit.pending_cnic_front || edit.pending_cnic_back ? (
                          <span
                            className="view-image-link"
                            onClick={() => handleViewCnic({
                              name: edit.userName,
                              user_id: edit.user_id,
                              frontPath: edit.pending_cnic_front || `sellers/${edit.user_id}/front_pending`,
                              backPath: edit.pending_cnic_back || `sellers/${edit.user_id}/back_pending`,
                            })}
                          >
                            View CNIC
                          </span>
                        ) : (
                          <span style={{ color: "#999", fontSize: "12px" }}>Not updated</span>
                        )}
                      </td>
                      <td>{edit.pending_jazzcash_number || "—"}</td>
                      <td>{formatDate(edit.created_at)}</td>
                      <td className="actions">
                        <ActionButton label="Approve" variant="success"
                          onClick={() => handleApproveEdit(edit)}
                          disabled={processing === edit.id} />
                        <ActionButton label="Reject" variant="danger"
                          onClick={() => { setRejectModal({ type: "edit", data: edit }); setRejectReason(""); }}
                          disabled={processing === edit.id} />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── APPROVED SELLERS ──────────────────────────────────────── */}
      <div className="admin-section">
        <h3 className="admin-section-heading">Approved Sellers</h3>
        {sellersLoading ? <div className="loading-state">Loading sellers...</div> : (
          <div className="table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Seller</th>
                  <th>Email</th>
                  <th>Business</th>
                  <th>JazzCash No.</th>
                  <th>Listings</th>
                  <th>Success Rate</th>
                  <th>Earnings</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {approvedSellers.length === 0
                  ? renderEmptyRow(7, "No approved sellers.")
                  : approvedSellers.map((s) => (
                    <tr key={s.id}>
                      <td>{s.name}</td>
                      <td>{s.email}</td>
                      <td>{s.business_name}</td>
                      <td>{s.jazzcash_number || "—"}</td>
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

      {/* ── REJECTED SELLERS ──────────────────────────────────────── */}
      <div className="admin-section">
        <h3 className="admin-section-heading">Rejected Sellers</h3>
        {sellersLoading ? <div className="loading-state">Loading sellers...</div> : (
          <div className="table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Seller</th>
                  <th>Email</th>
                  <th>Business</th>
                  <th>Status</th>
                  <th>Rejection Reason</th>
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
                      <td className="long-text" title={s.reason}>{s.reason || "—"}</td>
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

      {/* ── CNIC VIEW MODAL ───────────────────────────────────────── */}
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
            <button
              className="close-btn"
              onClick={() => { setCnicModal(null); setCnicUrls({ front: null, back: null }); }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* ── REJECT REASON MODAL ───────────────────────────────────── */}
      {rejectModal && (
        <div className="reason-modal-overlay">
          <div className="reason-modal">
            <h3>
              {rejectModal.type === "seller" ? "Reject Seller" : "Reject Profile Update"}
            </h3>
            <p style={{ fontSize: "13px", color: "#666", marginBottom: "8px" }}>
              {rejectModal.type === "seller"
                ? <>Rejecting: <strong>{rejectModal.data.name}</strong></>
                : <>Rejecting update for: <strong>{rejectModal.data.userName}</strong></>
              }
            </p>
            <textarea
              placeholder="Write reason here..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div className="modal-actions">
              <button
                className="cancel"
                onClick={() => { setRejectModal(null); setRejectReason(""); }}
                disabled={processing === rejectModal.data?.id}
              >
                Cancel
              </button>
              <button
                className="confirm"
                onClick={handleConfirmReject}
                disabled={processing === rejectModal.data?.id}
              >
                {processing === rejectModal.data?.id ? "Processing..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default SellerManagement;