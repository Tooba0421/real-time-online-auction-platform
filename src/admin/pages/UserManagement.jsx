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

  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [suspending, setSuspending] = useState(null);

  const handleToggleStatus = async (userId, currentStatus) => {
    const newStatus = currentStatus === "active" ? "suspended" : "active";
    const action = newStatus === "suspended" ? "suspend" : "activate";
    if (!window.confirm(`Are you sure you want to ${action} this user?`)) return;

    try {
      setSuspending(userId);

      // Optimistic update — UI responds immediately
      updateUserLocally(userId, { status: newStatus });

      const { error } = await supabase
        .from("profiles")
        .update({ status: newStatus })
        .eq("id", userId);

      if (error) {
        // Rollback on failure
        updateUserLocally(userId, { status: currentStatus });
        toast.error(`Error ${action}ing user`);
        return;
      }

      // Fire-and-forget: audit log + notification in parallel
      await Promise.all([
        supabase.from("admin_actions").insert({
          admin_id: adminUser.id,
          action_type: newStatus === "suspended" ? "suspend" : "approve",
          target_id: userId,
          target_table: "profiles",
          remarks: newStatus === "suspended"
            ? "User account suspended by admin"
            : "User account reactivated by admin",
        }),
        supabase.from("notifications").insert({
          user_id: userId,
          title: newStatus === "suspended" ? "Account Suspended" : "Account Activated",
          message: newStatus === "suspended"
            ? "Your account has been suspended by admin."
            : "Your account has been reactivated by admin.",
          type: "approval",
          notification_for: "buyer",
          is_read: false,
        }),
      ]);

      toast.success(`User ${action}d successfully`);
    } catch (err) {
      console.error(err);
      updateUserLocally(userId, { status: currentStatus });
      toast.error("Something went wrong");
    } finally {
      setSuspending(null);
    }
  };

  const filteredUsers = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return users.filter((u) => {
      const matchSearch =
        u.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.id?.toLowerCase().includes(q);
      const matchRole   = roleFilter   === "All" || u.role   === roleFilter.toLowerCase();
      const matchStatus = statusFilter === "All" || u.status?.toLowerCase() === statusFilter.toLowerCase();
      return matchSearch && matchRole && matchStatus;
    });
  }, [users, searchTerm, roleFilter, statusFilter]);

  const statsData = [
    { title: "Total Users",        value: usersLoading ? "..." : users.length,                                         subtitle: "All registered users" },
    { title: "Total Sellers",      value: usersLoading ? "..." : users.filter((u) => u.role === "seller").length,      subtitle: "Can list auctions" },
    { title: "Total Buyers",       value: usersLoading ? "..." : users.filter((u) => u.role === "buyer").length,       subtitle: "Can place bids" },
    { title: "Suspended Accounts", value: usersLoading ? "..." : users.filter((u) => u.status === "suspended").length, subtitle: "Restricted accounts" },
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

  const formatDate = (d) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-PK", {
      year: "numeric", month: "short", day: "numeric",
    });
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
            <option value="User">User</option>
            <option value="Buyer">Buyer</option>
            <option value="Seller">Seller</option>
            <option value="Admin">Admin</option>
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="All">All Status</option>
            <option value="Active">Active</option>
            <option value="Suspended">Suspended</option>
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
                  <tr><td colSpan="7" className="no-data">No users found</td></tr>
                ) : filteredUsers.map((u) => (
                  <tr key={u.id}>
                    <td>{u.name || "—"}</td>
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
                          u.id_verified === "approved" ? "Verified"      :
                          u.id_verified === "pending"  ? "Pending"       :
                          u.id_verified === "rejected" ? "Rejected"      : "Not Submitted"
                        }
                        type={
                          u.id_verified === "approved" ? "approved"      :
                          u.id_verified === "pending"  ? "pending"       :
                          u.id_verified === "rejected" ? "rejected"      : "not_submitted"
                        }
                      />
                    </td>
                    <td>
                      <StatusBadge
                        label={u.status === "active" ? "Active" : "Suspended"}
                        type={u.status === "active" ? "active" : "suspended"}
                      />
                    </td>
                    <td>{formatDate(u.join_date)}</td>
                    <td className="actions">
                      {u.role !== "admin" && (
                        <ActionButton
                          label={u.status === "active" ? "Suspend" : "Activate"}
                          variant={u.status === "active" ? "danger" : "success"}
                          onClick={() => handleToggleStatus(u.id, u.status)}
                          disabled={suspending === u.id}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>{/* ✅ Fix: was </tabl\ne> — broken JSX that caused a parse error */}
          </div>
        )}
      </div>

      <div className="overview-grid chart-space">
        <div className="chart-box">
          <h3 className="admin-section-heading">User Distribution</h3>
          <div className="chart-container">
            <Doughnut
              data={userRoleData}
              options={{
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
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserManagement;
