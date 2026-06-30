import { useState, useMemo } from "react";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { Doughnut } from "react-chartjs-2";
import { supabase } from "../../supabase/supabase";
import { useAuthContext } from "../../context/AuthContext";
import { useAdminContext } from "../../context/AdminContext";
import toast from "react-hot-toast";
import "../styles/adminLayout.css";
import "../styles/userManagement.css";
import StatusBadge from "../../common/components/StatusBadge";
import StatCard from "../../common/components/StatCard";
import ActionButton from "../../common/components/ActionButton";

ChartJS.register(ArcElement, Tooltip, Legend);

const UserManagement = () => {
  const { user: adminUser } = useAuthContext();
  const { users, usersLoading, updateUserLocally } = useAdminContext();

  const [searchTerm,   setSearchTerm]   = useState("");
  const [roleFilter,   setRoleFilter]   = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [processing,   setProcessing]   = useState(null);
  const [banModal,     setBanModal]     = useState(null);
  const [banReason,    setBanReason]    = useState("");

  const handleBanToggle = async () => {
    if (!banReason.trim()) {
      toast.error("Please write a reason");
      return;
    }

    const targetUser = banModal;
    const isBanned   = targetUser.status === "banned";
    const newStatus  = isBanned ? "active" : "banned";

    setProcessing(targetUser.id);

    try {
      // ── Step 1: Update profile status ──────────────────────────
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ status: newStatus })
        .eq("id", targetUser.id);

      if (updateError) {
        toast.error(`Error updating user: ${updateError.message}`);
        console.error("Profile update error:", updateError);
        return;
      }

      // ── Step 2: Optimistic local update ────────────────────────
      updateUserLocally(targetUser.id, { status: newStatus });

      // ── Step 3: Log admin action ────────────────────────────────
      try {
        const { error: actionError } = await supabase
          .from("admin_actions")
          .insert({
            admin_id:     adminUser.id,
            action_type:  isBanned ? "unban" : "ban",
            target_id:    targetUser.id,
            target_table: "profiles",
            remarks:      banReason.trim(),
          });

        if (actionError) {
          console.error("Admin action log error:", actionError);
        }
      } catch (logErr) {
        console.error("Admin action log exception:", logErr);
      }

      // ── Step 4: Notify user ─────────────────────────────────────
      // notification_for enum: 'buyer' | 'seller' | 'admin'
      const notifFor =
        targetUser.role === "seller" ? "seller" :
        targetUser.role === "admin"  ? null     : "buyer";

      if (notifFor) {
        try {
          await supabase.from("notifications").insert({
            user_id:          targetUser.id,
            title:            isBanned ? "Account Restored" : "Account Banned",
            message:          isBanned
              ? `Your account has been restored. Reason: ${banReason.trim()}`
              : `Your account has been banned. Reason: ${banReason.trim()}`,
            type:             "approval",
            notification_for: notifFor,
            is_read:          false,
          });
        } catch (notifErr) {
          console.error("Notification exception:", notifErr);
        }
      }

      toast.success(`User ${isBanned ? "unbanned" : "banned"} successfully`);
      setBanModal(null);
      setBanReason("");

    } catch (err) {
      console.error("Unexpected error:", err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setProcessing(null);
    }
  };

  const filteredUsers = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return users.filter((u) => {
      const matchSearch =
        u.name?.toLowerCase().includes(q)  ||
        u.email?.toLowerCase().includes(q) ||
        u.id?.toLowerCase().includes(q);
      const matchRole   = roleFilter   === "All" || u.role?.toLowerCase()   === roleFilter.toLowerCase();
      const matchStatus = statusFilter === "All" || u.status?.toLowerCase() === statusFilter.toLowerCase();
      return matchSearch && matchRole && matchStatus;
    });
  }, [users, searchTerm, roleFilter, statusFilter]);

  const statsData = [
    { title: "Total Users",   value: usersLoading ? "..." : users.length,                                      subtitle: "All registered users" },
    { title: "Total Sellers", value: usersLoading ? "..." : users.filter((u) => u.role === "seller").length,   subtitle: "Can list auctions" },
    { title: "Total Buyers",  value: usersLoading ? "..." : users.filter((u) => u.role === "buyer").length,    subtitle: "Can place bids" },
    { title: "Banned",        value: usersLoading ? "..." : users.filter((u) => u.status === "banned").length, subtitle: "Banned accounts" },
  ];

  const userRoleData = useMemo(() => ({
    labels: ["Buyers", "Sellers", "Users", "Admins"],
    datasets: [{
      data: [
        users.filter((u) => u.role === "buyer").length,
        users.filter((u) => u.role === "seller").length,
        users.filter((u) => u.role === "user").length,
        users.filter((u) => u.role === "admin").length,
      ],
      backgroundColor: ["#3B82F6", "#10B981", "#F59E0B", "#E74A3B"],
    }],
  }), [users]);

  const doughnutOptions = {
    responsive: true, maintainAspectRatio: false, cutout: "0%",
    layout: { padding: { top: 10, bottom: 30 } },
    plugins: {
      legend: { position: "top", align: "center", labels: { boxWidth: 30, padding: 15 } },
    },
  };

  const formatDate = (d) => !d ? "—" : new Date(d).toLocaleDateString("en-PK", {
    year: "numeric", month: "short", day: "numeric",
  });

  const getStatusLabel = (status) => {
    if (status === "active")   return "Active";
    if (status === "inactive") return "Inactive";
    if (status === "banned")   return "Banned";
    return status || "—";
  };

  const getStatusType = (status) => {
    if (status === "active") return "active";
    if (status === "banned") return "rejected"; // red badge
    return "pending";
  };

  return (
    <div className="admin-page">

      <div className="stats-grid">
        {statsData.map((item, i) => (
          <StatCard key={i} title={item.title} value={item.value} subtitle={item.subtitle} />
        ))}
      </div>

      <div className="admin-section">
        <h3 className="admin-section-heading">All Users</h3>

        <div className="admin-controls">
          <input
            type="text"
            placeholder="Search by name, email or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
            <option value="All">All Roles</option>
            <option value="user">User</option>
            <option value="buyer">Buyer</option>
            <option value="seller">Seller</option>
            <option value="admin">Admin</option>
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="All">All Status</option>
            <option value="active">Active</option>
            <option value="banned">Banned</option>
          </select>
        </div>

        {usersLoading ? (
          <div className="loading-state">Loading users...</div>
        ) : (
          <div className="table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>ID Verified</th>
                  <th>Status</th>
                  <th>Registered</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="no-data">No users found</td>
                  </tr>
                ) : filteredUsers.map((u) => (
                  <tr key={u.id}>
                    <td>{u.name  || "—"}</td>
                    <td>{u.email || "—"}</td>
                    <td>
                      <StatusBadge
                        label={u.role ? u.role.charAt(0).toUpperCase() + u.role.slice(1) : "—"}
                        type={u.role}
                      />
                    </td>
                    <td>
                      <StatusBadge
                        label={
                          u.id_verified === "approved" ? "Verified"       :
                          u.id_verified === "pending"  ? "Pending"        :
                          u.id_verified === "rejected" ? "Rejected"       : "Not Submitted"
                        }
                        type={
                          u.id_verified === "approved" ? "approved"       :
                          u.id_verified === "pending"  ? "pending"        :
                          u.id_verified === "rejected" ? "rejected"       : "pending"
                        }
                      />
                    </td>
                    <td>
                      <StatusBadge
                        label={getStatusLabel(u.status)}
                        type={getStatusType(u.status)}
                      />
                    </td>
                    <td>{formatDate(u.join_date)}</td>
                    <td className="actions">
                      {/* No action for admins or inactive users */}
                      {u.role !== "admin" && u.status !== "inactive" && (
                        <ActionButton
                          label={u.status === "active" ? "Ban" : "Unban"}
                          variant={u.status === "active" ? "danger" : "success"}
                          onClick={() => { setBanModal(u); setBanReason(""); }}
                          disabled={processing === u.id}
                        />
                      )}
                      {u.status === "inactive" && (
                        <span style={{ color: "#f59e0b", fontSize: "12px" }}>Inactive</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="overview-grid chart-space">
        <div className="chart-box">
          <h3 className="admin-section-heading">User Distribution</h3>
          <div className="chart-container">
            <Doughnut data={userRoleData} options={doughnutOptions} />
          </div>
        </div>
      </div>

      {/* Ban / Unban Modal */}
      {banModal && (
        <div
          className="reason-modal-overlay"
          onClick={() => { setBanModal(null); setBanReason(""); }}
        >
          <div className="reason-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{banModal.status === "active" ? "Ban User" : "Unban User"}</h3>

            <div className="modal-user-info">
              <p><strong>Name:</strong>   {banModal.name  || "—"}</p>
              <p><strong>Email:</strong>  {banModal.email || "—"}</p>
              <p><strong>Role:</strong>   {banModal.role}</p>
              <p><strong>Status:</strong> {getStatusLabel(banModal.status)}</p>
            </div>

            <textarea
              placeholder={
                banModal.status === "active"
                  ? "Reason for banning this user (e.g. suspicious activity, policy violation)..."
                  : "Reason for unbanning this user..."
              }
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
              rows="4"
            />

            <div className="modal-actions">
              <button
                className="cancel"
                onClick={() => { setBanModal(null); setBanReason(""); }}
                disabled={processing === banModal?.id}
              >
                Cancel
              </button>
              <button
                className="confirm"
                onClick={handleBanToggle}
                disabled={processing === banModal?.id}
              >
                {processing === banModal?.id
                  ? "Processing..."
                  : banModal.status === "active" ? "Ban User" : "Unban User"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default UserManagement;