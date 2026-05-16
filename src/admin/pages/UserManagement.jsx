import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Doughnut } from "react-chartjs-2";
import { useState, useMemo, useEffect } from "react";
import { supabase } from "../../supabase/supabase";
import toast from "react-hot-toast";
import "../styles/adminLayout.css";
import "../styles/userManagement.css";
import StatusBadge from "../../common/components/StatusBadge";
import StatCard from "../../common/components/StatCard";
import ActionButton from "../../common/components/ActionButton";

ChartJS.register(
  CategoryScale,
  LinearScale,
  ArcElement,
  Tooltip,
  Legend
);

const UserManagement = () => {

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [suspending, setSuspending] = useState(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('join_date', { ascending: false });

      if (error) {
        toast.error("Error fetching users");
        console.error(error);
        return;
      }

      setUsers(data || []);

    } catch (err) {
      console.error(err);
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  // Toggle suspend/activate user
  const handleToggleStatus = async (userId, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    const action = newStatus === 'suspended' ? 'suspend' : 'activate';

    if (!window.confirm(`Are you sure you want to ${action} this user?`)) return;

    try {
      setSuspending(userId);

      // Update profile status
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ status: newStatus })
        .eq('id', userId);

      if (profileError) {
        toast.error(`Error ${action}ing user`);
        console.error(profileError);
        return;
      }

      // Log admin action
      await supabase
        .from('admin_actions')
        .insert({
          admin_id: (await supabase.auth.getUser()).data.user.id,
          action_type: newStatus === 'suspended' ? 'suspend' : 'approve',
          target_id: userId,
          target_table: 'profiles',
          remarks: newStatus === 'suspended'
            ? 'User account suspended by admin'
            : 'User account reactivated by admin'
        });

      // Notify user
      await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          title: newStatus === 'suspended' ? 'Account Suspended' : 'Account Activated',
          message: newStatus === 'suspended'
            ? 'Your account has been suspended by admin.'
            : 'Your account has been reactivated by admin.',
          type: 'approval',
          notification_for: 'user',
          is_read: false
        });

      // Update local state
      setUsers(prev =>
        prev.map(u =>
          u.id === userId ? { ...u, status: newStatus } : u
        )
      );

      toast.success(`User ${action}d successfully`);

    } catch (err) {
      console.error(err);
      toast.error("Something went wrong");
    } finally {
      setSuspending(null);
    }
  };

  // Filter users
  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.id?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRole =
      roleFilter === "All" || user.role === roleFilter.toLowerCase();

    const matchesStatus =
      statusFilter === "All" ||
      user.status?.toLowerCase() === statusFilter.toLowerCase();

    return matchesSearch && matchesRole && matchesStatus;
  });

  // Stats
  const totalUsers = users.length;
  const totalSellers = users.filter(u => u.role === 'seller').length;
  const totalBuyers = users.filter(u => u.role === 'buyer').length;
  const suspendedUsers = users.filter(u => u.status === 'suspended').length;

  const statsData = [
    {
      title: "Total Users",
      value: loading ? "..." : totalUsers,
      subtitle: "All registered users"
    },
    {
      title: "Total Sellers",
      value: loading ? "..." : totalSellers,
      subtitle: "Users who can list auctions"
    },
    {
      title: "Total Buyers",
      value: loading ? "..." : totalBuyers,
      subtitle: "Users who can place bids"
    },
    {
      title: "Suspended Accounts",
      value: loading ? "..." : suspendedUsers,
      subtitle: "Restricted accounts"
    }
  ];

  // Chart data
  const userRoleData = useMemo(() => {
    const buyers = users.filter(u => u.role === 'buyer').length;
    const sellers = users.filter(u => u.role === 'seller').length;
    const regularUsers = users.filter(u => u.role === 'user').length;
    const admins = users.filter(u => u.role === 'admin').length;

    return {
      labels: ["Buyers", "Sellers", "Users", "Admins"],
      datasets: [
        {
          data: [buyers, sellers, regularUsers, admins],
          backgroundColor: ["#3B82F6", "#10B981", "#F59E0B", "#E74A3B"],
        },
      ],
    };
  }, [users]);

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "0%",
    layout: {
      padding: { top: 10, bottom: 30 },
    },
    plugins: {
      legend: {
        position: "top",
        align: "center",
        labels: { boxWidth: 30, padding: 15 },
      },
    },
  };

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-PK', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Get role label
  const getRoleLabel = (role) => {
    switch (role) {
      case 'user': return 'User';
      case 'buyer': return 'Buyer';
      case 'seller': return 'Seller';
      case 'admin': return 'Admin';
      default: return role || '—';
    }
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

      {/* USER TABLE */}
      <div className="admin-section">
        <h3 className="admin-section-heading">All Users</h3>

        {/* Search & Filter */}
        <div className="admin-controls">
          <input
            type="text"
            placeholder="Search by name, email or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="All">All Roles</option>
            <option value="User">User</option>
            <option value="Buyer">Buyer</option>
            <option value="Seller">Seller</option>
            <option value="Admin">Admin</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="All">All Status</option>
            <option value="Active">Active</option>
            <option value="Suspended">Suspended</option>
          </select>
        </div>

        {loading ? (
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
                  <th>Registration Date</th>
                </tr>
              </thead>

              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="no-data">
                      No users found
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.id}>
                      <td>{user.name || '—'}</td>
                      <td>{user.email || '—'}</td>
                      <td>
                        <span className="role-badge">
                          {getRoleLabel(user.role)}
                        </span>
                      </td>

                      <td>
                        <StatusBadge
                          label={
                            user.id_verified === 'approved' ? 'Verified' :
                            user.id_verified === 'pending' ? 'Pending' :
                            user.id_verified === 'rejected' ? 'Rejected' :
                            'Not Submitted'
                          }
                          type={
                            user.id_verified === 'approved' ? 'approved' :
                            user.id_verified === 'pending' ? 'pending' :
                            user.id_verified === 'rejected' ? 'rejected' :
                            'inactive'
                          }
                        />
                      </td>

                      <td>
                        <StatusBadge
                          label={user.status === 'active' ? 'Active' : 'Suspended'}
                          type={user.status === 'active' ? 'active' : 'suspended'}
                        />
                      </td>

                      <td>{formatDate(user.join_date)}</td>

          
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CHART */}
      <div className="overview-grid chart-space">
        <div className="chart-box">
          <h3 className="admin-section-heading">User Distribution</h3>
          <div className="chart-container">
            <Doughnut data={userRoleData} options={doughnutOptions} />
          </div>
        </div>
      </div>

    </div>
  );
};

export default UserManagement;