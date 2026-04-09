import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Doughnut } from "react-chartjs-2";
import { useState, useMemo } from "react";
import "../styles/adminLayout.css";
import "../styles/userManagement.css";
import StatusBadge from "../../common/components/StatusBadge";
import StatCard from "../../common/components/StatCard";

ChartJS.register(
  CategoryScale,
  LinearScale,
  ArcElement,
  Tooltip,
  Legend
);

const initialUsers = [
  {
    id: "USR-101",
    name: "Ali Khan",
    email: "ali@example.com",
    phone: "+92 300 1234567",
    role: "Buyer",
    accountVerified: true,
    idVerified: false,
    status: "Active",
    registrationDate: "2025-12-01",
    lastLogin: "2 hours ago",
    totalPurchases: 5,
    address: "Lahore, Pakistan",
  },
  {
    id: "USR-102",
    name: "Sara Ahmed",
    email: "sara@example.com",
    phone: "+92 301 9876543",
    role: "Seller",
    accountVerified: false,
    idVerified: false,
    status: "Suspended",
    registrationDate: "2025-11-15",
    lastLogin: "3 days ago",
    totalListings: 12,
    address: "Karachi, Pakistan",
  },
  {
    id: "USR-103",
    name: "Zain Malik",
    email: "zain@example.com",
    phone: "+92 302 5555555",
    role: "Buyer & Seller",
    accountVerified: true,
    idVerified: true,
    status: "Active",
    registrationDate: "2025-10-20",
    lastLogin: "1 hour ago",
    totalListings: 8,
    totalPurchases: 3,
    address: "Islamabad, Pakistan",
  },
];
  
  const UserManagement = () => {
  const [users, setUsers] = useState(initialUsers);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  const toggleStatus = (id) => {
    setUsers((prev) =>
      prev.map((user) =>
        user.id === id
          ? { ...user, status: user.status === "Active" ? "Suspended" : "Active" }
          : user
      )
    );
  };

  // 🔎 Filtered Users Logic
  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.phone.includes(searchTerm);

    const matchesRole =
      roleFilter === "All" || user.role === roleFilter;

    const matchesStatus =
      statusFilter === "All" || user.status === statusFilter;

    return matchesSearch && matchesRole && matchesStatus;
  });

  const totalUsers = users.length;
  const totalSellers = users.filter((u) => u.role === "Seller" || u.role === "Buyer & Seller").length;
  const totalBuyers = users.filter((u) => u.role === "Buyer" || u.role === "Buyer & Seller").length;
  const suspendedUsers = users.filter(u => u.status === "Suspended").length;

  const statsData = [
    {
      title: "Total Users",
      value: totalUsers,
      subtitle: "All registered users"
    },
    {
      title: "Total Sellers",
      value: totalSellers,
      subtitle: "Users who can list auctions"
    },
    {
      title: "Total Buyers",
      value: totalBuyers,
      subtitle: "Users who can place bids"
    },
    {
      title: "Suspended Accounts",
      value: suspendedUsers,
      subtitle: "Restricted accounts"
    }
  ];

  const userRoleData = useMemo(() => {
    const buyers = users.filter(u => u.role === "Buyer").length;
    const sellers = users.filter(u => u.role === "Seller").length;
    const both = users.filter(u => u.role === "Buyer & Seller").length;

    return {
      labels: ["Buyers", "Sellers", "Both"],
      datasets: [
        {
          data: [buyers, sellers, both],
          backgroundColor: ["#3B82F6", "#10B981", "#F59E0B"],
        },
      ],
    };
  }, [users]);

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "0%",
    layout: {
      padding: {
        top: 10,    // space above the chart
        bottom: 30, // space below the chart
      },
    },
    plugins: {
      legend: {
        position: "top",
        align: "center",
        labels: {
          boxWidth: 30,
          padding: 15,
        },
      },
    },
  };

  return (
    <div className="admin-page">

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

      <div className="admin-section">
        <h3 className="admin-section-heading">All Users</h3>

        {/* 🔎 Search & Filter Section */}
        <div className="admin-controls">
          <input
            type="text"
            placeholder="Search by name, email, ID or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="All">All Roles</option>
            <option value="Buyer">Buyer</option>
            <option value="Seller">Seller</option>
            <option value="Buyer & Seller">Buyer & Seller</option>
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

        <div className="table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>User ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Role</th>
                <th>Account Verified</th>
                <th>ID Verified</th>
                <th>Status</th>
                <th>Registration Date</th>
                <th>Address</th>
              </tr>
            </thead>

            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="10" className="no-data">
                    No users found
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id}>
                    <td className="user-id">{user.id}</td>
                    <td>{user.name}</td>
                    <td>{user.email}</td>
                    <td>{user.phone}</td>
                    <td>
                      <span className="role-badge">{user.role}</span>
                    </td>

                    <td>
                      <StatusBadge
                        label={user.accountVerified ? "Verified" : "Not Verified"}
                        type={user.accountVerified ? "approved" : "pending"}
                      />
                    </td>

                    <td>
                      <StatusBadge
                        label={user.idVerified ? "Approved" : "Pending"}
                        type={user.idVerified ? "approved" : "pending"}
                      />
                    </td>

                    <td onClick={() => toggleStatus(user.id)}>
                      <StatusBadge
                        label={user.status}
                        type={user.status.toLowerCase()}
                      />
                    </td>

                    <td>{user.registrationDate}</td>
                    <td>
                      <span className="long-text" title={user.address}>
                        {user.address}
                      </span>
                    </td>
                  </tr>
                )))}
            </tbody>
          </table>
        </div>
      </div>


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
