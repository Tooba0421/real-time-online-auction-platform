import { useState, useMemo } from "react";
import "../styles/adminLayout.css";

import ActionButton from "../../common/components/ActionButton";
import StatCard from "../../common/components/StatCard";

import {
    Chart as ChartJS,
    ArcElement,
    Tooltip,
    Legend,
} from "chart.js";
import { Doughnut } from "react-chartjs-2";

import frontSide from "../../assets/frontSide.jpeg";
import backSide from "../../assets/backSide.jpeg";

ChartJS.register(ArcElement, Tooltip, Legend);

/* ================= DATA ================= */
const initialPendingBidders = [
    {
        id: "USR-201",
        name: "Ahmed Ali",
        email: "ahmed@email.com",
        cnic: "42101-1234567-1",
        requestDate: "2026-02-10",
        cnicFront: frontSide,
        cnicBack: backSide,
    },
    {
        id: "USR-202",
        name: "Sara Khan",
        email: "sara@email.com",
        cnic: "42156-1865567-1",
        requestDate: "2026-01-17",
        cnicFront: frontSide,
        cnicBack: backSide,
    },
];

const BidderManagement = () => {
    const [pendingBidders, setPendingBidders] = useState(initialPendingBidders);
    const [search, setSearch] = useState("");

    const [selectedBidder, setSelectedBidder] = useState(null);
    const [selectedCnic, setSelectedCnic] = useState(null);
    const [reason, setReason] = useState("");

    /* ================= TEMP COUNTS ================= */
    // 🔥 For now static (later from Firebase)
    const approvedCount = 3;
    const rejectedCount = 1;

    /* ================= ACTIONS ================= */
    const handleApprove = (id) => {
        setPendingBidders(prev => prev.filter(b => b.id !== id));
    };

    const handleReject = () => {
        if (!reason.trim()) return;

        setPendingBidders(prev =>
            prev.filter(b => b.id !== selectedBidder.id)
        );

        setSelectedBidder(null);
        setReason("");
    };

    const renderEmpty = (col, msg) => (
        <tr>
            <td colSpan={col} className="no-data">{msg}</td>
        </tr>
    );

    /* ================= search ================= */
    const filteredBidders = pendingBidders.filter((b) =>
        b.name.toLowerCase().includes(search.toLowerCase()) ||
        b.id.toLowerCase().includes(search.toLowerCase())
    );

    /* ================= STATS ================= */
    const statsData = [
        {
            title: "Pending Requests",
            value: pendingBidders.length,
            subtitle: "Waiting approval",
        },
        {
            title: "Approved Bidders",
            value: approvedCount,
            subtitle: "Allowed to bid",
        },
        {
            title: "Rejected Bidders",
            value: rejectedCount,
            subtitle: "Not allowed",
        },
    ];

    /* ================= CHART DATA ================= */
    const chartData = useMemo(() => ({
        labels: ["Approved", "Pending", "Rejected"],
        datasets: [
            {
                data: [approvedCount, pendingBidders.length, rejectedCount],
                backgroundColor: ["#10B981", "#F59E0B", "#EF4444"],
            },
        ],
    }), [pendingBidders.length]);

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "0%",
        plugins: {
            legend: {
                position: "top",
                align: "center",
            },
        },
    };

    return (
        <div className="admin-page">

            {/* ===== STATS ===== */}
            <div className="stats-grid">
                {statsData.map((item, i) => (
                    <StatCard key={i} {...item} />
                ))}
            </div>

            {/* ================= PENDING TABLE ================= */}
            <div className="admin-section">
                <h3 className="admin-section-heading">Pending Bidders</h3>

                <div className="admin-controls">
                    <input
                        type="text"
                        placeholder="Search by User ID or Name"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                <div className="table-wrapper">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>User ID</th>
                                <th>Name</th>
                                <th>Email</th>
                                <th>CNIC</th>
                                <th>View CNIC</th>
                                <th>Request Date</th>
                                <th>Actions</th>
                            </tr>
                        </thead>

                        <tbody>
                            {filteredBidders.length === 0
                                ? renderEmpty(7, "No pending bidders")
                                : filteredBidders.map(b => (
                                    <tr key={b.id}>
                                        <td>{b.id}</td>
                                        <td>{b.name}</td>
                                        <td>{b.email}</td>
                                        <td>{b.cnic}</td>

                                        <td>
                                            <span
                                                className="view-image-link"
                                                onClick={() => setSelectedCnic(b)}
                                            >
                                                View CNIC
                                            </span>
                                        </td>

                                        <td>{b.requestDate}</td>

                                        <td className="actions">
                                            <ActionButton
                                                label="Approve"
                                                variant="success"
                                                onClick={() => handleApprove(b.id)}
                                            />

                                            <ActionButton
                                                label="Reject"
                                                variant="danger"
                                                onClick={() => setSelectedBidder(b)}
                                            />
                                        </td>
                                    </tr>
                                ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ================= CHART ================= */}
            <div className="overview-grid chart-space">
                <div className="chart-box">
                    <h3 className="admin-section-heading">Bidder Status Overview</h3>
                    <div className="chart-container">
                        <Doughnut data={chartData} options={chartOptions} />
                    </div>
                </div>
            </div>

            {/* ================= CNIC MODAL ================= */}
            {selectedCnic && (
                <div className="cnic-modal-overlay">
                    <div className="cnic-modal">
                        <h3>{selectedCnic.name} CNIC</h3>

                        <div className="cnic-images">
                            <div>
                                <p>Front</p>
                                <img src={selectedCnic.cnicFront} alt="" />
                            </div>
                            <div>
                                <p>Back</p>
                                <img src={selectedCnic.cnicBack} alt="" />
                            </div>
                        </div>

                        <button className="close-btn" onClick={() => setSelectedCnic(null)}>
                            Close
                        </button>
                    </div>
                </div>
            )}

            {/* ================= REJECT MODAL ================= */}
            {selectedBidder && (
                <div className="reason-modal-overlay">
                    <div className="reason-modal">
                        <h3>Reject Bidder</h3>

                        <textarea
                            placeholder="Enter reason..."
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                        />

                        <div className="modal-actions">
                            <button onClick={() => setSelectedBidder(null)}>Cancel</button>
                            <button onClick={handleReject}>Confirm</button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default BidderManagement;