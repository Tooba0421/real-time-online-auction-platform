import { useState, useMemo } from "react";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Doughnut } from "react-chartjs-2";
import StatCard from "../../common/components/StatCard";
import "../styles/adminLayout.css";
import "../styles/sellerManagement.css";

import StatusBadge from "../../common/components/StatusBadge";
import ActionButton from "../../common/components/ActionButton";
import frontSide from "../../assets/frontSide.jpeg";
import backSide from "../../assets/backSide.jpeg";

ChartJS.register(ArcElement, Tooltip, Legend);

/* ================= INITIAL DATA ================= */
const initialPendingSellers = [
  {
    id: "USR-102",
    name: "Sara Ahmed",
    email: "sara@email.com",
    businessName: "Sara Antiques",
    city: "Multan",
    cnic: "42101-1234567-8",
    requestDate: "2026-01-18",
    statusType: "pending",
    cnicFront: frontSide,
    cnicBack: backSide,
    address: "123 Main Street, Gulberg, Multan, Pakistan"
  },
  {
    id: "USR-103",
    name: "Hassan Raza",
    email: "hassan@email.com",
    businessName: "Vintage Hub",
    city: "Lahore",
    cnic: "42101-9876543-2",
    requestDate: "2026-01-20",
    statusType: "pending",
    cnicFront: frontSide,
    cnicBack: backSide,
    address: "45 Model Town, Lahore, Pakistan"
  }
];

const initialApprovedSellers = [
  {
    id: "USR-101",
    name: "Ali Khan",
    listings: 12,
    successRate: "78%",
    earnings: "$4,250",
    lastActive: "2 hours ago",
    statusType: "approved",
  },
  {
    id: "USR-104",
    name: "Fatima Noor",
    listings: 8,
    successRate: "65%",
    earnings: "$2,100",
    lastActive: "1 day ago",
    statusType: "approved",
  }
];

const initialRejectedSellers = [
  {
    id: "USR-100",
    name: "Bilal Ahmed",
    statusType: "rejected",
    reason: "Uploaded blurred CNIC image which was not readable."
  },
  {
    id: "USR-099",
    name: "Usman Tariq",
    statusType: "suspended",
    reason: "Violation of auction rules and suspicious bidding activity detected."
  }
];

const SellerManagement = () => {
  const [pendingSellers, setPendingSellers] = useState(initialPendingSellers);
  const [approvedSellers, setApprovedSellers] = useState(initialApprovedSellers);
  const [rejectedSellers, setRejectedSellers] = useState(initialRejectedSellers);
  const [selectedCnicSeller, setSelectedCnicSeller] = useState(null);
  const [selectedSeller, setSelectedSeller] = useState(null);
  const [reasonText, setReasonText] = useState("");
  const [actionType, setActionType] = useState(""); // reject or suspend

  /* ================= ACTIONS ================= */
  const handleApprove = (sellerId) => {
    const seller = pendingSellers.find((s) => s.id === sellerId);
    if (!seller) return;

    setPendingSellers(prev => prev.filter(s => s.id !== sellerId));

    setApprovedSellers(prev => [
      ...prev,
      {
        id: seller.id,
        name: seller.name,
        listings: 0,
        successRate: "0%",
        earnings: "$0",
        lastActive: "Just now",
        statusType: "approved",
      }
    ]);
  };

  const openReasonModal = (seller, type) => {
    setSelectedSeller(seller);
    setActionType(type);
    setReasonText("");
  };

  const handleConfirmAction = () => {
    if (!reasonText.trim()) return;

    if (actionType === "reject") {
      setPendingSellers(prev => prev.filter(s => s.id !== selectedSeller.id));
    }

    if (actionType === "suspend") {
      setApprovedSellers(prev => prev.filter(s => s.id !== selectedSeller.id));
    }

    setRejectedSellers(prev => [
      ...prev,
      {
        id: selectedSeller.id,
        name: selectedSeller.name,
        statusType: actionType === "reject" ? "rejected" : "suspended",
        reason: reasonText
      }
    ]);

    setSelectedSeller(null);
  };

  const renderEmptyRow = (colSpan, message) => (
    <tr>
      <td colSpan={colSpan} className="empty-row">
        {message}
      </td>
    </tr>
  );

  /* ================= SELLER STATS ================= */

  const totalApproved = approvedSellers.length;
  const totalPending = pendingSellers.length;
  const totalRejected = rejectedSellers.length;

  const totalListings = approvedSellers.reduce(
    (sum, seller) => sum + (seller.listings || 0),
    0
  );

  /* ================= CHART DATA ================= */

  const sellerStatusData = useMemo(() => ({
    labels: ["Approved", "Pending", "Rejected / Suspended"],
    datasets: [
      {
        data: [totalApproved, totalPending, totalRejected],
        backgroundColor: ["#10B981", "#F59E0B", "#EF4444"],
      },
    ],
  }), [totalApproved, totalPending, totalRejected]);

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

  const statsData = [
    {
      title: "Approved Sellers",
      value: totalApproved,
      subtitle: "Currently active sellers",
    },
    {
      title: "Pending Requests",
      value: totalPending,
      subtitle: "Awaiting verification",
    },
    {
      title: "Rejected / Suspended",
      value: totalRejected,
      subtitle: "Restricted sellers",
    },
    {
      title: "Total Listings",
      value: totalListings,
      subtitle: "From approved sellers",
    },
  ];

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

      {/* ================= PENDING TABLE ================= */}
      <div className="admin-section">
        <h3 className="admin-section-heading">Pending Sellers</h3>
        <div className="table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>User ID</th>
                <th>Seller</th>
                <th>Email</th>
                <th>Business</th>
                <th>City</th>
                <th>Address</th>
                <th>View CNIC</th>
                <th>Request Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pendingSellers.length === 0
                ? renderEmptyRow(7, "No pending sellers.")
                : pendingSellers.map(seller => (
                  <tr key={seller.id}>
                    <td>{seller.id}</td>
                    <td>{seller.name}</td>
                    <td>{seller.email}</td>
                    <td>{seller.businessName}</td>
                    <td>{seller.city}</td>
                    <td>
                      <span className="long-text" title={seller.address}>
                        {seller.address}
                      </span>
                    </td>
                    <td>
                      <span
                        className="view-image-link"
                        onClick={() => setSelectedCnicSeller(seller)}
                      >
                        View CNIC
                      </span>
                    </td>
                    <td>{seller.requestDate}</td>
                    <td className="actions">
                      <ActionButton
                        label="Approve"
                        variant="success"
                        onClick={() => handleApprove(seller.id)}
                      />
                      <ActionButton
                        label="Reject"
                        variant="danger"
                        onClick={() => openReasonModal(seller, "reject")}
                      />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================= APPROVED TABLE ================= */}
      <div className="admin-section">
        <h3 className="admin-section-heading">Approved Sellers</h3>
        <div className="table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>User ID</th>
                <th>Seller</th>
                <th>Listings</th>
                <th>Success Rate</th>
                <th>Earnings</th>
                <th>Status</th>
                <th>Last Active</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {approvedSellers.length === 0
                ? renderEmptyRow(8, "No approved sellers.")
                : approvedSellers.map(seller => (
                  <tr key={seller.id}>
                    <td>{seller.id}</td>
                    <td>{seller.name}</td>
                    <td>{seller.listings}</td>
                    <td>{seller.successRate}</td>
                    <td>{seller.earnings}</td>
                    <td>
                      <StatusBadge label="Approved" type="approved" />
                    </td>
                    <td>{seller.lastActive}</td>
                    <td className="actions">
                      <ActionButton
                        label="Suspend"
                        variant="danger"
                        onClick={() => openReasonModal(seller, "suspend")}
                      />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================= REJECTED TABLE ================= */}
      <div className="admin-section">
        <h3 className="admin-section-heading">Rejected / Suspended Sellers</h3>
        <div className="table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>User ID</th>
                <th>Seller</th>
                <th>Status</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {rejectedSellers.length === 0
                ? renderEmptyRow(4, "No rejected sellers.")
                : rejectedSellers.map(seller => (
                  <tr key={seller.id}>
                    <td>{seller.id}</td>
                    <td>{seller.name}</td>
                    <td>
                      <StatusBadge label={seller.statusType} type="rejected" />
                    </td>
                    <td>
                      <span className="long-text" title={seller.reason}>
                        {seller.reason}
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================= CNIC MODAL ================= */}
      {selectedCnicSeller && (
        <div className="cnic-modal-overlay">
          <div className="cnic-modal">
            <h3>CNIC Details - {selectedCnicSeller.name}</h3>

            <div className="cnic-images">
              <div>
                <p>Front Side</p>
                <img src={selectedCnicSeller.cnicFront} alt="CNIC Front" />
              </div>

              <div>
                <p>Back Side</p>
                <img src={selectedCnicSeller.cnicBack} alt="CNIC Back" />
              </div>
            </div>

            <button
              className="close-btn"
              onClick={() => setSelectedCnicSeller(null)}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* ================= REASON MODAL ================= */}
      {selectedSeller && (
        <div className="reason-modal-overlay">
          <div className="reason-modal">
            <h3>{actionType === "reject" ? "Reject Seller" : "Suspend Seller"}</h3>

            <textarea
              placeholder="Write reason here..."
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
            />

            <div className="modal-actions">
              <button className="cancel" onClick={() => setSelectedSeller(null)}>
                Cancel
              </button>
              <button className="confirm" onClick={handleConfirmAction}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= SELLER STATUS CHART ================= */}

      <div className="overview-grid chart-space">
        <div className="chart-box">
          <h3 className="admin-section-heading">Seller Status Overview</h3>
          <div className="chart-container">
            <Doughnut data={sellerStatusData} options={doughnutOptions} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SellerManagement;