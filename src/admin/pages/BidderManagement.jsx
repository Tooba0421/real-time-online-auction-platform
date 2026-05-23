import { useState, useMemo, useEffect } from "react";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
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

const logAdminAction = async (adminId, actionType, targetId, targetTable, remarks) => {
  try {
    const { error } = await supabase.from("admin_actions").insert({
      admin_id: adminId,
      action_type: actionType,
      target_id: targetId,
      target_table: targetTable,
      remarks: remarks,
    });
    if (error) console.error("Admin action log error:", error);
  } catch (err) {
    console.error("Admin action log exception:", err);
  }
};

const BidderManagement = () => {
  const { user } = useAuthContext();

  // New CNIC registrations — from pending_cnic_submissions
  const [pendingBidders, setPendingBidders] = useState([]);
  // Approved buyers — from buyers table
  const [approvedBidders, setApprovedBidders] = useState([]);
  // Rejected — from pending_cnic_submissions
  const [rejectedBidders, setRejectedBidders] = useState([]);
  // CNIC edit requests — from pending_changes (existing buyers editing their CNIC)
  const [pendingEdits, setPendingEdits] = useState([]);

  const [loading, setLoading] = useState(true);
  const [editsLoading, setEditsLoading] = useState(true);

  // CNIC view modal (new registration)
  const [selectedCnic, setSelectedCnic] = useState(null);
  const [cnicUrls, setCnicUrls] = useState({ front: null, back: null });
  const [cnicLoading, setCnicLoading] = useState(false);

  // Edit review modal (CNIC update)
  const [selectedEdit, setSelectedEdit] = useState(null);
  const [editCnicUrls, setEditCnicUrls] = useState({ front: null, back: null });
  const [editCnicLoading, setEditCnicLoading] = useState(false);
  const [editRejectModal, setEditRejectModal] = useState(null);
  const [editRejectReason, setEditRejectReason] = useState("");

  // Reject modal (new registration)
  const [selectedBidder, setSelectedBidder] = useState(null);
  const [reasonText, setReasonText] = useState("");
  const [processing, setProcessing] = useState(false);

  const [suspendingBuyer, setSuspendingBuyer] = useState(null);
  const [suspendReason, setSuspendReason] = useState("");
  const [suspendModal, setSuspendModal] = useState(null);

  useEffect(() => {
    fetchBidders();
    fetchPendingEdits();
  }, []);

  // ── Fetch pending and rejected from pending_cnic_submissions ──────────────
  // ── Fetch approved from buyers table ─────────────────────────────────────
  const fetchBidders = async () => {
    try {
      setLoading(true);

      // Pending new CNIC registrations
      const { data: pendingData, error: pendingError } = await supabase
        .from("pending_cnic_submissions")
        .select(`
          *,
          profiles ( id, name, email, role, status )
        `)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (pendingError) {
        toast.error("Error fetching pending bidders");
        console.error(pendingError);
        return;
      }

      // Rejected CNIC registrations
      const { data: rejectedData } = await supabase
        .from("pending_cnic_submissions")
        .select(`
          *,
          profiles ( id, name, email, role, status )
        `)
        .eq("status", "rejected")
        .order("created_at", { ascending: false });

      // Approved buyers with stats
      const { data: buyerData, error: buyerError } = await supabase
        .from("buyers")
        .select(`
          *,
          profiles ( id, name, email, role, status )
        `)
        .eq("is_verified", "approved")
        .order("created_at", { ascending: false });

      if (buyerError) {
        console.error(buyerError);
        return;
      }

      // Map pending
      const pending = (pendingData || []).map((s) => ({
        ...s,
        name: s.profiles?.name || "—",
        email: s.email || s.profiles?.email || "—",
        submissionId: s.id,
      }));

      // Map rejected
      const rejected = (rejectedData || []).map((s) => ({
        ...s,
        name: s.profiles?.name || "—",
        email: s.email || s.profiles?.email || "—",
      }));

      // Map approved with bid/win stats
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
          email: buyer.profiles?.email || "—",
          totalBids: totalBids || 0,
          auctionsWon: auctionsWon || 0,
        });
      }

      setPendingBidders(pending);
      setRejectedBidders(rejected);
      setApprovedBidders(approved);

    } catch (err) {
      console.error(err);
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  // ── Fetch CNIC edit requests from pending_changes ─────────────────────────
  const fetchPendingEdits = async () => {
    try {
      setEditsLoading(true);

      const { data, error } = await supabase
        .from("pending_changes")
        .select(`
          *,
          profiles ( id, name, email, role )
        `)
        .eq("role", "buyer")
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching pending edits:", error);
        return;
      }

      setPendingEdits(
        (data || []).map((e) => ({
          ...e,
          userName: e.profiles?.name || "—",
          userEmail: e.profiles?.email || "—",
        }))
      );
    } catch (err) {
      console.error(err);
    } finally {
      setEditsLoading(false);
    }
  };

  // ── View CNIC images for new registration ─────────────────────────────────
  // Images are at buyers/{user_id}/front and buyers/{user_id}/back in storage
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

  // ── View CNIC images for edit request ─────────────────────────────────────
  // Images are at buyers/{user_id}/front_pending and buyers/{user_id}/back_pending
  const handleViewEditRequest = async (editRequest) => {
    setSelectedEdit(editRequest);
    setEditCnicUrls({ front: null, back: null });

    if (editRequest.pending_cnic_front || editRequest.pending_cnic_back) {
      try {
        setEditCnicLoading(true);

        if (editRequest.pending_cnic_front) {
          const { data: frontSigned } = await supabase.storage
            .from("cnic-images")
            .createSignedUrl(editRequest.pending_cnic_front, 60);
          setEditCnicUrls((prev) => ({
            ...prev,
            front: frontSigned?.signedUrl || null,
          }));
        }

        if (editRequest.pending_cnic_back) {
          const { data: backSigned } = await supabase.storage
            .from("cnic-images")
            .createSignedUrl(editRequest.pending_cnic_back, 60);
          setEditCnicUrls((prev) => ({
            ...prev,
            back: backSigned?.signedUrl || null,
          }));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setEditCnicLoading(false);
      }
    }
  };

  // ── Approve new CNIC registration ─────────────────────────────────────────
  // Creates buyer record, updates profile, marks submission approved
  const handleApprove = async (submission) => {
    try {
      setProcessing(true);

      // Step 1: Create buyer record in buyers table
      const { data: newBuyer, error: buyerInsertError } = await supabase
        .from("buyers")
        .insert({
          user_id: submission.user_id,
          cnic_number: submission.cnic_number,
          cnic_front: `buyers/${submission.user_id}/front`,
          cnic_back: `buyers/${submission.user_id}/back`,
          is_verified: "approved",
        })
        .select()
        .single();

      if (buyerInsertError) {
        toast.error("Error creating buyer record");
        console.error("Buyer insert error:", buyerInsertError);
        return;
      }

      // Step 2: Update profile role and id_verified
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ role: "buyer", id_verified: "approved" })
        .eq("id", submission.user_id);

      if (profileError) {
        toast.error("Error updating profile");
        console.error("Profile update error:", profileError);
        return;
      }

      // Step 3: Mark submission as approved
      const { error: submissionError } = await supabase
        .from("pending_cnic_submissions")
        .update({ status: "approved" })
        .eq("id", submission.submissionId);

      if (submissionError) {
        console.error("Submission update error:", submissionError);
      }

      // Step 4: Log admin action
      await logAdminAction(
        user.id, "approve", newBuyer.id, "buyers",
        "Bidder CNIC approved by admin"
      );

      // Step 5: Notify user
      await supabase.from("notifications").insert({
        user_id: submission.user_id,
        title: "CNIC Verified — You Can Now Bid! 🎉",
        message:
          "Your identity has been verified. You can now place bids on auctions.",
        type: "approval",
        notification_for: "buyer",
        is_read: false,
      });

      toast.success(`${submission.name} approved as bidder!`);
      setPendingBidders((prev) => prev.filter((b) => b.id !== submission.id));
      setApprovedBidders((prev) => [
        ...prev,
        {
          ...submission,
          id: newBuyer.id,
          is_verified: "approved",
          totalBids: 0,
          auctionsWon: 0,
        },
      ]);

    } catch (err) {
      console.error(err);
      toast.error("Something went wrong");
    } finally {
      setProcessing(false);
    }
  };

  // ── Reject new CNIC registration ──────────────────────────────────────────
  const openRejectModal = (submission) => {
    setSelectedBidder(submission);
    setReasonText("");
  };

  const handleConfirmReject = async () => {
    if (!reasonText.trim()) {
      toast.error("Please write a reason");
      return;
    }

    try {
      setProcessing(true);

      // Step 1: Mark submission as rejected with reason
      const { error: submissionError } = await supabase
        .from("pending_cnic_submissions")
        .update({ status: "rejected", rejection_reason: reasonText })
        .eq("id", selectedBidder.submissionId);

      if (submissionError) {
        toast.error("Error rejecting submission");
        console.error("Submission reject error:", submissionError);
        return;
      }

      // Step 2: Update profile id_verified to rejected
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ id_verified: "rejected" })
        .eq("id", selectedBidder.user_id);

      if (profileError) console.error("Profile update error:", profileError);

      // Step 3: Log admin action
      await logAdminAction(
        user.id, "reject", selectedBidder.submissionId, "buyers",
        reasonText
      );

      // Step 4: Notify user
      await supabase.from("notifications").insert({
        user_id: selectedBidder.user_id,
        title: "CNIC Verification Rejected",
        message: `Your CNIC verification was rejected. Reason: ${reasonText}`,
        type: "approval",
        notification_for: "buyer",
        is_read: false,
      });

      toast.success(`${selectedBidder.name} rejected`);
      setPendingBidders((prev) =>
        prev.filter((b) => b.id !== selectedBidder.id)
      );
      setRejectedBidders((prev) => [
        ...prev,
        {
          ...selectedBidder,
          status: "rejected",
          rejection_reason: reasonText,
        },
      ]);
      setSelectedBidder(null);

    } catch (err) {
      console.error(err);
      toast.error("Something went wrong");
    } finally {
      setProcessing(false);
    }
  };

  // ── Approve CNIC edit request ─────────────────────────────────────────────
  // Applies pending_changes fields to buyers table
  const handleApproveEdit = async (editRequest) => {
    try {
      setProcessing(true);

      const updatePayload = {};
      if (editRequest.pending_cnic_number)
        updatePayload.cnic_number = editRequest.pending_cnic_number;
      if (editRequest.pending_cnic_front)
        updatePayload.cnic_front = editRequest.pending_cnic_front;
      if (editRequest.pending_cnic_back)
        updatePayload.cnic_back = editRequest.pending_cnic_back;

      // Step 1: Apply changes to buyers table
      const { error: buyerError } = await supabase
        .from("buyers")
        .update(updatePayload)
        .eq("user_id", editRequest.user_id);

      if (buyerError) {
        toast.error("Error applying CNIC changes");
        console.error("Buyer update error:", buyerError);
        return;
      }

      // Step 2: Mark pending_changes as approved
      const { error: changeError } = await supabase
        .from("pending_changes")
        .update({ status: "approved" })
        .eq("id", editRequest.id);

      if (changeError) console.error("pending_changes update error:", changeError);

      // Step 3: Log admin action
      await logAdminAction(
        user.id, "approve", editRequest.id, "buyers",
        "Buyer CNIC update approved by admin"
      );

      // Step 4: Notify buyer
      await supabase.from("notifications").insert({
        user_id: editRequest.user_id,
        title: "CNIC Update Approved ✅",
        message:
          "Your CNIC update request has been approved. Your information has been updated.",
        type: "approval",
        notification_for: "buyer",
        is_read: false,
      });

      toast.success(`CNIC update approved for ${editRequest.userName}`);
      setSelectedEdit(null);
      fetchPendingEdits();

    } catch (err) {
      console.error(err);
      toast.error("Something went wrong");
    } finally {
      setProcessing(false);
    }
  };

  // ── Reject CNIC edit request ──────────────────────────────────────────────
  const handleRejectEdit = async () => {
    if (!editRejectReason.trim()) {
      toast.error("Please write a reason");
      return;
    }

    try {
      setProcessing(true);

      const { error: changeError } = await supabase
        .from("pending_changes")
        .update({ status: "rejected", reason: editRejectReason })
        .eq("id", editRejectModal.id);

      if (changeError) {
        toast.error("Error rejecting edit request");
        console.error(changeError);
        return;
      }

      await logAdminAction(
        user.id, "reject", editRejectModal.id, "buyers",
        editRejectReason
      );

      await supabase.from("notifications").insert({
        user_id: editRejectModal.user_id,
        title: "CNIC Update Rejected",
        message: `Your CNIC update request was rejected. Reason: ${editRejectReason}`,
        type: "approval",
        notification_for: "buyer",
        is_read: false,
      });

      toast.success(`Edit request rejected for ${editRejectModal.userName}`);
      setEditRejectModal(null);
      setEditRejectReason("");
      setSelectedEdit(null);
      fetchPendingEdits();

    } catch (err) {
      console.error(err);
      toast.error("Something went wrong");
    } finally {
      setProcessing(false);
    }
  };

  const handleSuspendToggle = async () => {
    if (!suspendReason.trim()) {
      toast.error("Please write a reason");
      return;
    }

    try {
      setSuspendingBuyer(suspendModal.id);

      const currentStatus = suspendModal.profiles?.status;
      const newStatus = currentStatus === "suspended" ? "active" : "suspended";
      const action = newStatus === "suspended" ? "suspend" : "activate";

      // Step 1: Update profiles.status
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ status: newStatus })
        .eq("id", suspendModal.user_id);

      if (profileError) {
        toast.error(`Error ${action}ing buyer`);
        console.error(profileError);
        return;
      }

      // Step 2: Log admin action
      await logAdminAction(
        user.id,
        newStatus === "suspended" ? "suspend" : "approve",
        suspendModal.id,
        "buyers",
        suspendReason
      );

      // Step 3: Notify buyer
      await supabase.from("notifications").insert({
        user_id: suspendModal.user_id,
        title: newStatus === "suspended"
          ? "Account Suspended"
          : "Account Reactivated",
        message: newStatus === "suspended"
          ? `Your bidder account has been suspended. Reason: ${suspendReason}`
          : `Your bidder account has been reactivated. Reason: ${suspendReason}`,
        type: "approval",
        notification_for: "buyer",
        is_read: false,
      });

      toast.success(
        newStatus === "suspended"
          ? `${suspendModal.name} suspended`
          : `${suspendModal.name} reactivated`
      );

      // Step 4: Update local state
      setApprovedBidders((prev) =>
        prev.map((b) =>
          b.id === suspendModal.id
            ? { ...b, profiles: { ...b.profiles, status: newStatus } }
            : b
        )
      );

      setSuspendModal(null);
      setSuspendReason("");

    } catch (err) {
      console.error(err);
      toast.error("Something went wrong");
    } finally {
      setSuspendingBuyer(null);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-PK", {
      year: "numeric", month: "short", day: "numeric",
    });
  };

  const renderEmptyRow = (colSpan, message) => (
    <tr><td colSpan={colSpan} className="empty-row">{message}</td></tr>
  );

  const totalPending = pendingBidders.length;
  const totalApproved = approvedBidders.length;
  const totalRejected = rejectedBidders.length;

  const statsData = [
    {
      title: "Pending Registrations",
      value: loading ? "..." : totalPending,
      subtitle: "Awaiting CNIC verification",
    },
    {
      title: "Approved Bidders",
      value: loading ? "..." : totalApproved,
      subtitle: "Allowed to place bids",
    },
    {
      title: "Rejected Registrations",
      value: loading ? "..." : totalRejected,
      subtitle: "CNIC not approved",
    },
    {
      title: "Pending CNIC Edits",
      value: editsLoading ? "..." : pendingEdits.length,
      subtitle: "Edit requests from buyers",
    },
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
    plugins: {
      legend: {
        position: "top", align: "center",
        labels: { boxWidth: 30, padding: 15 },
      },
    },
  };

  return (
    <div className="admin-page">

      {/* STAT CARDS */}
      <div className="stats-grid">
        {statsData.map((item, index) => (
          <StatCard
            key={index}
            title={item.title}
            value={item.value}
            subtitle={item.subtitle}
          />
        ))}
      </div>

      {/* ── PENDING NEW REGISTRATIONS ── */}
      <div className="admin-section">
        <h3 className="admin-section-heading">Pending Bidder Registrations</h3>
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
                  <th>Submitted</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingBidders.length === 0
                  ? renderEmptyRow(6, "No pending bidder registrations.")
                  : pendingBidders.map((submission) => (
                    <tr key={submission.id}>
                      <td>{submission.name}</td>
                      <td>{submission.email}</td>
                      <td>{submission.cnic_number}</td>
                      <td>
                        <span
                          className="view-image-link"
                          onClick={() => handleViewCnic(submission)}
                        >
                          View CNIC
                        </span>
                      </td>
                      <td>{formatDate(submission.created_at)}</td>
                      <td className="actions">
                        <ActionButton
                          label="Approve"
                          variant="success"
                          onClick={() => handleApprove(submission)}
                          disabled={processing}
                        />
                        <ActionButton
                          label="Reject"
                          variant="danger"
                          onClick={() => openRejectModal(submission)}
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

      {/* ── PENDING CNIC EDIT REQUESTS ── */}
      <div className="admin-section">
        <h3 className="admin-section-heading">Pending CNIC Update Requests</h3>
        {editsLoading ? (
          <div className="loading-state">Loading edit requests...</div>
        ) : (
          <div className="table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Buyer Name</th>
                  <th>Email</th>
                  <th>New CNIC No</th>
                  <th>Has New Images</th>
                  <th>Submitted</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingEdits.length === 0
                  ? renderEmptyRow(6, "No pending CNIC update requests.")
                  : pendingEdits.map((edit) => (
                    <tr key={edit.id}>
                      <td>{edit.userName}</td>
                      <td>{edit.userEmail}</td>
                      <td>{edit.pending_cnic_number || "—"}</td>
                      <td>
                        {edit.pending_cnic_front || edit.pending_cnic_back ? (
                          <span style={{ color: "#10b981", fontWeight: "600" }}>
                            Yes
                          </span>
                        ) : (
                          <span style={{ color: "#999" }}>No</span>
                        )}
                      </td>
                      <td>{formatDate(edit.created_at)}</td>
                      <td className="actions">
                        <ActionButton
                          label="Review"
                          variant="secondary"
                          onClick={() => handleViewEditRequest(edit)}
                          disabled={processing}
                        />
                        <ActionButton
                          label="Reject"
                          variant="danger"
                          onClick={() => {
                            setEditRejectModal(edit);
                            setEditRejectReason("");
                          }}
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

      {/* ── APPROVED BIDDERS ── */}
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
                  <th>Email</th>
                  <th>CNIC No</th>
                  <th>Total Bids</th>
                  <th>Auctions Won</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {approvedBidders.length === 0
                  ? renderEmptyRow(6, "No approved bidders.")
                  : approvedBidders.map((buyer) => (
                    <tr key={buyer.id}>
                      <td>{buyer.name}</td>
                      <td>{buyer.email}</td>
                      <td>{buyer.cnic_number}</td>
                      <td>{buyer.totalBids}</td>
                      <td>{buyer.auctionsWon}</td>
                      <td>
                        <StatusBadge label="Approved" type="approved" />
                      </td>
                      <td className="actions">   {/* ← ADD THIS */}
                        <ActionButton
                          label={buyer.profiles?.status === "suspended" ? "Activate" : "Suspend"}
                          variant={buyer.profiles?.status === "suspended" ? "success" : "danger"}
                          onClick={() => {
                            setSuspendModal(buyer);
                            setSuspendReason("");
                          }}
                          disabled={suspendingBuyer === buyer.id}
                        />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── REJECTED REGISTRATIONS ── */}
      <div className="admin-section">
        <h3 className="admin-section-heading">Rejected Registrations</h3>
        {loading ? (
          <div className="loading-state">Loading...</div>
        ) : (
          <div className="table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>CNIC No</th>
                  <th>Status</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {rejectedBidders.length === 0
                  ? renderEmptyRow(5, "No rejected registrations.")
                  : rejectedBidders.map((submission) => (
                    <tr key={submission.id}>
                      <td>{submission.name}</td>
                      <td>{submission.email}</td>
                      <td>{submission.cnic_number}</td>
                      <td>
                        <StatusBadge label="Rejected" type="rejected" />
                      </td>
                      <td>
                        <span
                          className="long-text"
                          title={submission.rejection_reason}
                        >
                          {submission.rejection_reason || "—"}
                        </span>
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
          <h3 className="admin-section-heading">Bidder Status Overview</h3>
          <div className="chart-container">
            <Doughnut data={bidderStatusData} options={doughnutOptions} />
          </div>
        </div>
      </div>

      {/* ── CNIC VIEW MODAL (new registration) ── */}
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

      {/* ── EDIT REVIEW MODAL ── */}
      {selectedEdit && (
        <div className="cnic-modal-overlay">
          <div className="cnic-modal" style={{ maxWidth: "560px", width: "90%" }}>
            <h3>CNIC Update Request — {selectedEdit.userName}</h3>
            <p style={{ color: "#666", fontSize: "13px", marginBottom: "16px" }}>
              {selectedEdit.userEmail}
            </p>

            <div
              style={{
                display: "flex", flexDirection: "column",
                gap: "10px", marginBottom: "16px",
              }}
            >
              {selectedEdit.pending_cnic_number && (
                <div className="result-row">
                  <span className="result-label">New CNIC No</span>
                  <span className="result-value">
                    {selectedEdit.pending_cnic_number}
                  </span>
                </div>
              )}
            </div>

            {(selectedEdit.pending_cnic_front ||
              selectedEdit.pending_cnic_back) && (
                <>
                  <p
                    style={{
                      fontWeight: "600", marginBottom: "10px", fontSize: "14px",
                    }}
                  >
                    New CNIC Images
                  </p>
                  {editCnicLoading ? (
                    <div
                      style={{
                        textAlign: "center", padding: "20px", color: "#999",
                      }}
                    >
                      Loading CNIC images...
                    </div>
                  ) : (
                    <div className="cnic-images" style={{ marginBottom: "16px" }}>
                      <div>
                        <p>Front Side</p>
                        {editCnicUrls.front ? (
                          <img src={editCnicUrls.front} alt="New CNIC Front" />
                        ) : (
                          <p style={{ color: "#999" }}>Not available</p>
                        )}
                      </div>
                      <div>
                        <p>Back Side</p>
                        {editCnicUrls.back ? (
                          <img src={editCnicUrls.back} alt="New CNIC Back" />
                        ) : (
                          <p style={{ color: "#999" }}>Not available</p>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}

            <div
              style={{
                display: "flex", gap: "10px", justifyContent: "flex-end",
              }}
            >
              <button
                className="close-btn"
                onClick={() => setSelectedEdit(null)}
              >
                Close
              </button>
              <button
                className="close-btn"
                style={{
                  background: "#ef4444", color: "#fff", border: "none",
                }}
                onClick={() => {
                  setEditRejectModal(selectedEdit);
                  setEditRejectReason("");
                  setSelectedEdit(null);
                }}
                disabled={processing}
              >
                Reject
              </button>
              <button
                className="create-btn"
                onClick={() => handleApproveEdit(selectedEdit)}
                disabled={processing}
              >
                {processing ? "Approving..." : "Approve"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT REJECT REASON MODAL ── */}
      {editRejectModal && (
        <div className="reason-modal-overlay">
          <div className="reason-modal">
            <h3>Reject CNIC Update</h3>
            <p style={{ fontSize: "13px", color: "#666", marginBottom: "8px" }}>
              Rejecting update for:{" "}
              <strong>{editRejectModal.userName}</strong>
            </p>
            <textarea
              placeholder="Write reason here..."
              value={editRejectReason}
              onChange={(e) => setEditRejectReason(e.target.value)}
            />
            <div className="modal-actions">
              <button
                className="cancel"
                onClick={() => {
                  setEditRejectModal(null);
                  setEditRejectReason("");
                }}
                disabled={processing}
              >
                Cancel
              </button>
              <button
                className="confirm"
                onClick={handleRejectEdit}
                disabled={processing}
              >
                {processing ? "Processing..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── REGISTRATION REJECT REASON MODAL ── */}
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

      {suspendModal && (
        <div className="reason-modal-overlay">
          <div className="reason-modal">
            <h3>
              {suspendModal.profiles?.status === "suspended"
                ? "Activate Buyer"
                : "Suspend Buyer"}
            </h3>
            <p style={{ fontSize: "13px", color: "#666", marginBottom: "8px" }}>
              {suspendModal.profiles?.status === "suspended"
                ? "Activating"
                : "Suspending"}:{" "}
              <strong>{suspendModal.name}</strong>
            </p>
            <textarea
              placeholder="Write reason here..."
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
            />
            <div className="modal-actions">
              <button
                className="cancel"
                onClick={() => {
                  setSuspendModal(null);
                  setSuspendReason("");
                }}
                disabled={suspendingBuyer}
              >
                Cancel
              </button>
              <button
                className="confirm"
                onClick={handleSuspendToggle}
                disabled={suspendingBuyer}
              >
                {suspendingBuyer ? "Processing..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default BidderManagement;