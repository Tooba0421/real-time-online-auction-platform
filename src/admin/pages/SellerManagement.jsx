import { useState, useMemo, useEffect } from "react";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { Doughnut } from "react-chartjs-2";
import { supabase } from "../../supabase/supabase";
import { useAuthContext } from "../../context/AuthContext";
import toast from "react-hot-toast";
import StatCard from "../../common/components/StatCard";
import "../styles/adminLayout.css";
import "../styles/sellerManagement.css";
import StatusBadge from "../../common/components/StatusBadge";
import ActionButton from "../../common/components/ActionButton";

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

const SellerManagement = () => {
  const { user } = useAuthContext();

  const [pendingSellers, setPendingSellers] = useState([]);
  const [approvedSellers, setApprovedSellers] = useState([]);
  const [rejectedSellers, setRejectedSellers] = useState([]);
  const [pendingEdits, setPendingEdits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editsLoading, setEditsLoading] = useState(true);

  const [selectedCnicSeller, setSelectedCnicSeller] = useState(null);
  const [sellerCnicUrls, setSellerCnicUrls] = useState({ front: null, back: null });
  const [sellerCnicLoading, setSellerCnicLoading] = useState(false);

  // Edit approval modal
  const [selectedEdit, setSelectedEdit] = useState(null);
  const [editCnicUrls, setEditCnicUrls] = useState({ front: null, back: null });
  const [editCnicLoading, setEditCnicLoading] = useState(false);
  const [editRejectModal, setEditRejectModal] = useState(null);
  const [editRejectReason, setEditRejectReason] = useState("");

  // Seller approve/reject modal
  const [selectedSeller, setSelectedSeller] = useState(null);
  const [reasonText, setReasonText] = useState("");
  const [actionType, setActionType] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchSellers();
    fetchPendingEdits();
  }, []);

  const fetchSellers = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("sellers")
        .select(`
          *,
          profiles (
            id, name, role, status, email
          )
        `)
        .order("created_at", { ascending: false });

      if (error) {
        toast.error("Error fetching sellers");
        console.error(error);
        return;
      }

      const pending = [];
      const approved = [];
      const rejected = [];

      for (const seller of data) {
        const { count: listingsCount } = await supabase
          .from("auctions")
          .select("*", { count: "exact", head: true })
          .eq("seller_id", seller.id)
          .in("status", ["live", "ended", "scheduled"]);

        const { count: totalEnded } = await supabase
          .from("auctions")
          .select("*", { count: "exact", head: true })
          .eq("seller_id", seller.id)
          .eq("status", "ended");

        const { count: totalSold } = await supabase
          .from("products")
          .select("*", { count: "exact", head: true })
          .eq("seller_id", seller.id)
          .eq("status", "sold");

        const successRate =
          totalEnded > 0
            ? ((totalSold / totalEnded) * 100).toFixed(1)
            : 0;

        const { data: transactionData } = await supabase
          .from("transactions")
          .select("seller_amount")
          .eq("seller_id", seller.id)
          .eq("status", "released");

        const earnings =
          transactionData?.reduce((sum, t) => sum + (t.seller_amount || 0), 0) || 0;

        const enriched = {
          ...seller,
          name: seller.profiles?.name || "—",
          email: seller.profiles?.email || "—",
          listings: listingsCount || 0,
          successRate: `${successRate}%`,
          earnings: `PKR ${earnings.toLocaleString()}`,
        };

        if (seller.is_verified === "pending") pending.push(enriched);
        else if (seller.is_verified === "approved") approved.push(enriched);
        else if (
          seller.is_verified === "rejected" ||
          seller.is_verified === "suspended"
        ) rejected.push(enriched);
      }

      setPendingSellers(pending);
      setApprovedSellers(approved);
      setRejectedSellers(rejected);

    } catch (err) {
      console.error(err);
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingEdits = async () => {
    try {
      setEditsLoading(true);

      const { data, error } = await supabase
        .from("pending_changes")
        .select(`
          *,
          profiles (
            id, name, email, role
          )
        `)
        .eq("role", "seller")
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

  // View seller CNIC (registration)
  const handleViewSellerCnic = async (seller) => {
    try {
      setSellerCnicLoading(true);
      setSelectedCnicSeller(seller);

      const { data: frontSigned } = await supabase.storage
        .from("cnic-images")
        .createSignedUrl(`sellers/${seller.user_id}/front`, 60);

      const { data: backSigned } = await supabase.storage
        .from("cnic-images")
        .createSignedUrl(`sellers/${seller.user_id}/back`, 60);

      setSellerCnicUrls({
        front: frontSigned?.signedUrl || null,
        back: backSigned?.signedUrl || null,
      });
    } catch (err) {
      console.error(err);
      toast.error("Could not load CNIC images");
    } finally {
      setSellerCnicLoading(false);
    }
  };

  // Open edit approval modal — generate signed URLs for pending CNIC images
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

  // Approve edit request — apply all pending changes to sellers table
  const handleApproveEdit = async (editRequest) => {
    try {
      setProcessing(true);

      // Build update payload from pending fields
      const updatePayload = {};
      if (editRequest.pending_phone_no) updatePayload.phone_no = editRequest.pending_phone_no;
      if (editRequest.pending_city) updatePayload.city = editRequest.pending_city;
      if (editRequest.pending_postal_code) updatePayload.postal_code = editRequest.pending_postal_code;
      if (editRequest.pending_address) updatePayload.address = editRequest.pending_address;
      if (editRequest.pending_cnic_number) updatePayload.cnic_number = editRequest.pending_cnic_number;
      if (editRequest.pending_cnic_front) updatePayload.cnic_front = editRequest.pending_cnic_front;
      if (editRequest.pending_cnic_back) updatePayload.cnic_back = editRequest.pending_cnic_back;

      // Step 1: Update sellers table
      const { error: sellerError } = await supabase
        .from("sellers")
        .update(updatePayload)
        .eq("user_id", editRequest.user_id);

      if (sellerError) {
        toast.error("Error applying seller changes");
        console.error("Seller update error:", sellerError);
        return;
      }

      // Step 2: Mark pending_changes as approved
      const { error: changeError } = await supabase
        .from("pending_changes")
        .update({ status: "approved" })
        .eq("id", editRequest.id);

      if (changeError) {
        console.error("pending_changes update error:", changeError);
      }

      // Step 3: Log admin action
      await logAdminAction(
        user.id, "approve", editRequest.id, "sellers",
        "Seller profile update approved by admin"
      );

      // Step 4: Notify seller
      await supabase.from("notifications").insert({
        user_id: editRequest.user_id,
        title: "Profile Update Approved ✅",
        message:
          "Your profile update request has been approved. Your information has been updated.",
        type: "approval",
        notification_for: "seller",
        is_read: false,
      });

      toast.success(`Profile update approved for ${editRequest.userName}`);
      setSelectedEdit(null);
      fetchPendingEdits();

    } catch (err) {
      console.error(err);
      toast.error("Something went wrong");
    } finally {
      setProcessing(false);
    }
  };

  // Reject edit request
  const handleRejectEdit = async () => {
    if (!editRejectReason.trim()) {
      toast.error("Please write a reason");
      return;
    }

    try {
      setProcessing(true);

      // Step 1: Mark pending_changes as rejected with reason
      const { error: changeError } = await supabase
        .from("pending_changes")
        .update({ status: "rejected", reason: editRejectReason })
        .eq("id", editRejectModal.id);

      if (changeError) {
        toast.error("Error rejecting edit request");
        console.error("pending_changes reject error:", changeError);
        return;
      }

      // Step 2: Log admin action
      await logAdminAction(
        user.id, "reject", editRejectModal.id, "sellers",
        editRejectReason
      );

      // Step 3: Notify seller
      await supabase.from("notifications").insert({
        user_id: editRejectModal.user_id,
        title: "Profile Update Rejected",
        message: `Your profile update request was rejected. Reason: ${editRejectReason}`,
        type: "approval",
        notification_for: "seller",
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

  // Approve seller registration
  const handleApprove = async (seller) => {
    try {
      setProcessing(true);

      const { error: sellerError } = await supabase
        .from("sellers")
        .update({ is_verified: "approved" })
        .eq("id", seller.id);

      if (sellerError) {
        toast.error("Error approving seller");
        console.error(sellerError);
        return;
      }

      const { error: profileError } = await supabase
        .from("profiles")
        .update({ role: "seller" })
        .eq("id", seller.user_id);

      if (profileError) {
        toast.error("Error updating seller role");
        console.error(profileError);
        return;
      }

      await logAdminAction(user.id, "approve", seller.id, "sellers", "Seller approved by admin");

      await supabase.from("notifications").insert({
        user_id: seller.user_id,
        title: "Seller Application Approved! 🎉",
        message:
          "Congratulations! Your seller application has been approved. You can now list products and create auctions.",
        type: "approval",
        notification_for: "seller",
        is_read: false,
      });

      toast.success(`${seller.name} approved as seller!`);
      setPendingSellers((prev) => prev.filter((s) => s.id !== seller.id));
      setApprovedSellers((prev) => [...prev, { ...seller, is_verified: "approved" }]);

    } catch (err) {
      console.error(err);
      toast.error("Something went wrong");
    } finally {
      setProcessing(false);
    }
  };

  const openReasonModal = (seller, type) => {
    setSelectedSeller(seller);
    setActionType(type);
    setReasonText("");
  };

  // Reject or suspend seller registration
  const handleConfirmAction = async () => {
    if (!reasonText.trim()) {
      toast.error("Please write a reason");
      return;
    }

    try {
      setProcessing(true);

      const newStatus = actionType === "reject" ? "rejected" : "suspended";

      const { error: sellerError } = await supabase
        .from("sellers")
        .update({ is_verified: newStatus })
        .eq("id", selectedSeller.id);

      if (sellerError) {
        toast.error(`Error ${actionType}ing seller`);
        console.error(sellerError);
        return;
      }

      if (actionType === "suspend") {
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ role: "user" })
          .eq("id", selectedSeller.user_id);

        if (profileError) {
          toast.error("Error updating seller role");
          console.error(profileError);
          return;
        }
      }

      await logAdminAction(
        user.id,
        actionType === "reject" ? "reject" : "suspend",
        selectedSeller.id,
        "sellers",
        reasonText
      );

      await supabase.from("notifications").insert({
        user_id: selectedSeller.user_id,
        title:
          actionType === "reject"
            ? "Seller Application Rejected"
            : "Seller Account Suspended",
        message:
          actionType === "reject"
            ? `Your seller application has been rejected. Reason: ${reasonText}`
            : `Your seller account has been suspended. Reason: ${reasonText}`,
        type: "approval",
        notification_for: "seller",
        is_read: false,
      });

      toast.success(
        actionType === "reject"
          ? `${selectedSeller.name} rejected`
          : `${selectedSeller.name} suspended`
      );

      if (actionType === "reject") {
        setPendingSellers((prev) => prev.filter((s) => s.id !== selectedSeller.id));
      } else {
        setApprovedSellers((prev) => prev.filter((s) => s.id !== selectedSeller.id));
      }

      setRejectedSellers((prev) => [
        ...prev,
        { ...selectedSeller, is_verified: newStatus, reason: reasonText },
      ]);

      setSelectedSeller(null);

    } catch (err) {
      console.error(err);
      toast.error("Something went wrong");
    } finally {
      setProcessing(false);
    }
  };

  const renderEmptyRow = (colSpan, message) => (
    <tr><td colSpan={colSpan} className="empty-row">{message}</td></tr>
  );

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-PK", {
      year: "numeric", month: "short", day: "numeric",
    });
  };

  const totalApproved = approvedSellers.length;
  const totalPending = pendingSellers.length;
  const totalRejected = rejectedSellers.length;
  const totalListings = approvedSellers.reduce((sum, s) => sum + (s.listings || 0), 0);

  const statsData = [
    { title: "Approved Sellers", value: loading ? "..." : totalApproved, subtitle: "Currently active sellers" },
    { title: "Pending Requests", value: loading ? "..." : totalPending, subtitle: "Awaiting verification" },
    { title: "Rejected / Suspended", value: loading ? "..." : totalRejected, subtitle: "Restricted sellers" },
    { title: "Total Listings", value: loading ? "..." : totalListings, subtitle: "From approved sellers" },
  ];

  const sellerStatusData = useMemo(() => ({
    labels: ["Approved", "Pending", "Rejected / Suspended"],
    datasets: [{
      data: [totalApproved, totalPending, totalRejected],
      backgroundColor: ["#10B981", "#F59E0B", "#EF4444"],
    }],
  }), [totalApproved, totalPending, totalRejected]);

  const doughnutOptions = {
    responsive: true, maintainAspectRatio: false, cutout: "0%",
    layout: { padding: { top: 10, bottom: 30 } },
    plugins: {
      legend: { position: "top", align: "center", labels: { boxWidth: 30, padding: 15 } },
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

      {/* PENDING SELLERS TABLE */}
      <div className="admin-section">
        <h3 className="admin-section-heading">Pending Sellers</h3>
        {loading ? (
          <div className="loading-state">Loading sellers...</div>
        ) : (
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
                  <th>Request Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingSellers.length === 0
                  ? renderEmptyRow(9, "No pending sellers.")
                  : pendingSellers.map((seller) => (
                    <tr key={seller.id}>
                      <td>{seller.name}</td>
                      <td>{seller.email}</td>
                      <td>{seller.business_name}</td>
                      <td>{seller.city}</td>
                      <td>
                        <span className="long-text" title={seller.address}>
                          {seller.address}
                        </span>
                      </td>
                      <td>{seller.cnic_number}</td>
                      <td>
                        <span className="view-image-link" onClick={() => handleViewSellerCnic(seller)}>
                          View CNIC
                        </span>
                      </td>
                      <td>{formatDate(seller.created_at)}</td>
                      <td className="actions">
                        <ActionButton label="Approve" variant="success"
                          onClick={() => handleApprove(seller)} disabled={processing} />
                        <ActionButton label="Reject" variant="danger"
                          onClick={() => openReasonModal(seller, "reject")} disabled={processing} />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* PENDING PROFILE EDITS TABLE */}
      <div className="admin-section">
        <h3 className="admin-section-heading">Pending Profile Updates</h3>
        {editsLoading ? (
          <div className="loading-state">Loading edit requests...</div>
        ) : (
          <div className="table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Seller Name</th>
                  <th>Email</th>
                  <th>Change Type</th>
                  <th>Pending Phone</th>
                  <th>Pending City</th>
                  <th>Pending Address</th>
                  <th>Pending CNIC No</th>
                  <th>Has CNIC Images</th>
                  <th>Submitted</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingEdits.length === 0
                  ? renderEmptyRow(10, "No pending profile edit requests.")
                  : pendingEdits.map((edit) => (
                    <tr key={edit.id}>
                      <td>{edit.userName}</td>
                      <td>{edit.userEmail}</td>
                      <td>
                        <span style={{
                          background: "#e0f2fe", color: "#0369a1",
                          padding: "2px 8px", borderRadius: "4px", fontSize: "12px"
                        }}>
                          {edit.change_type || "all"}
                        </span>
                      </td>
                      <td>{edit.pending_phone_no || "—"}</td>
                      <td>{edit.pending_city || "—"}</td>
                      <td>
                        <span className="long-text" title={edit.pending_address}>
                          {edit.pending_address || "—"}
                        </span>
                      </td>
                      <td>{edit.pending_cnic_number || "—"}</td>
                      <td>
                        {edit.pending_cnic_front || edit.pending_cnic_back
                          ? <span style={{ color: "#10b981", fontWeight: "600" }}>Yes</span>
                          : <span style={{ color: "#999" }}>No</span>
                        }
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

      {/* APPROVED SELLERS TABLE */}
      <div className="admin-section">
        <h3 className="admin-section-heading">Approved Sellers</h3>
        {loading ? (
          <div className="loading-state">Loading sellers...</div>
        ) : (
          <div className="table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Seller</th>
                  <th>Email</th>
                  <th>Business</th>
                  <th>Listings</th>
                  <th>Success Rate</th>
                  <th>Earnings</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {approvedSellers.length === 0
                  ? renderEmptyRow(8, "No approved sellers.")
                  : approvedSellers.map((seller) => (
                    <tr key={seller.id}>
                      <td>{seller.name}</td>
                      <td>{seller.email}</td>
                      <td>{seller.business_name}</td>
                      <td>{seller.listings}</td>
                      <td>{seller.successRate}</td>
                      <td>{seller.earnings}</td>
                      <td><StatusBadge label="Approved" type="approved" /></td>
                      <td className="actions">
                        <ActionButton label="Suspend" variant="danger"
                          onClick={() => openReasonModal(seller, "suspend")} disabled={processing} />
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
        {loading ? (
          <div className="loading-state">Loading sellers...</div>
        ) : (
          <div className="table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Seller</th>
                  <th>Email</th>
                  <th>Business</th>
                  <th>Status</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {rejectedSellers.length === 0
                  ? renderEmptyRow(5, "No rejected sellers.")
                  : rejectedSellers.map((seller) => (
                    <tr key={seller.id}>
                      <td>{seller.name}</td>
                      <td>{seller.email}</td>
                      <td>{seller.business_name}</td>
                      <td>
                        <StatusBadge
                          label={seller.is_verified === "rejected" ? "Rejected" : "Suspended"}
                          type="rejected"
                        />
                      </td>
                      <td>
                        <span className="long-text" title={seller.reason}>
                          {seller.reason || "—"}
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
          <h3 className="admin-section-heading">Seller Status Overview</h3>
          <div className="chart-container">
            <Doughnut data={sellerStatusData} options={doughnutOptions} />
          </div>
        </div>
      </div>

      {/* SELLER CNIC MODAL (registration) */}
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
            }}>
              Close
            </button>
          </div>
        </div>
      )}

      {/* EDIT REVIEW MODAL */}
      {selectedEdit && (
        <div className="cnic-modal-overlay">
          <div className="cnic-modal" style={{ maxWidth: "600px", width: "90%" }}>
            <h3>Profile Update Request — {selectedEdit.userName}</h3>
            <p style={{ color: "#666", fontSize: "13px", marginBottom: "16px" }}>
              {selectedEdit.userEmail}
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
              {selectedEdit.pending_phone_no && (
                <div className="result-row">
                  <span className="result-label">New Phone</span>
                  <span className="result-value">{selectedEdit.pending_phone_no}</span>
                </div>
              )}
              {selectedEdit.pending_city && (
                <div className="result-row">
                  <span className="result-label">New City</span>
                  <span className="result-value">{selectedEdit.pending_city}</span>
                </div>
              )}
              {selectedEdit.pending_postal_code && (
                <div className="result-row">
                  <span className="result-label">New Postal Code</span>
                  <span className="result-value">{selectedEdit.pending_postal_code}</span>
                </div>
              )}
              {selectedEdit.pending_address && (
                <div className="result-row">
                  <span className="result-label">New Address</span>
                  <span className="result-value">{selectedEdit.pending_address}</span>
                </div>
              )}
              {selectedEdit.pending_cnic_number && (
                <div className="result-row">
                  <span className="result-label">New CNIC No</span>
                  <span className="result-value">{selectedEdit.pending_cnic_number}</span>
                </div>
              )}
            </div>

            {/* Pending CNIC images */}
            {(selectedEdit.pending_cnic_front || selectedEdit.pending_cnic_back) && (
              <>
                <p style={{ fontWeight: "600", marginBottom: "10px", fontSize: "14px" }}>
                  New CNIC Images
                </p>
                {editCnicLoading ? (
                  <div style={{ textAlign: "center", padding: "20px", color: "#999" }}>
                    Loading CNIC images...
                  </div>
                ) : (
                  <div className="cnic-images" style={{ marginBottom: "16px" }}>
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

            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button className="close-btn" onClick={() => setSelectedEdit(null)}>
                Close
              </button>
              <button
                className="close-btn"
                style={{ background: "#ef4444", color: "#fff", border: "none" }}
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

      {/* EDIT REJECT REASON MODAL */}
      {editRejectModal && (
        <div className="reason-modal-overlay">
          <div className="reason-modal">
            <h3>Reject Profile Update</h3>
            <p style={{ fontSize: "13px", color: "#666", marginBottom: "8px" }}>
              Rejecting update for: <strong>{editRejectModal.userName}</strong>
            </p>
            <textarea
              placeholder="Write reason here..."
              value={editRejectReason}
              onChange={(e) => setEditRejectReason(e.target.value)}
            />
            <div className="modal-actions">
              <button className="cancel"
                onClick={() => { setEditRejectModal(null); setEditRejectReason(""); }}
                disabled={processing}>
                Cancel
              </button>
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
              {actionType === "reject" ? "Rejecting" : "Suspending"}:{" "}
              <strong>{selectedSeller.name}</strong>
            </p>
            <textarea
              placeholder="Write reason here..."
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
            />
            <div className="modal-actions">
              <button className="cancel" onClick={() => setSelectedSeller(null)} disabled={processing}>
                Cancel
              </button>
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