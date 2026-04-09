import React, { useState } from "react";
import "../styles/adminLayout.css";
import "../styles/auctionsBidMonitoring.css";
import StatusBadge from "../../common/components/StatusBadge";
import ActionButton from "../../common/components/ActionButton";

/* ======================= DATA ======================= */

const auctionsData = [
  {
    id: "AUC-101",
    product: "iPhone 14 Pro",
    seller: "Ali Khan",
    currentBid: "$1,250",
    reserveMet: true,
    status: "Live",
    startTime: "10:00 AM",
    endTime: "6:00 PM",
  },
  {
    id: "AUC-102",
    product: "Antique Vase",
    seller: "Sara Ahmed",
    currentBid: "$320",
    reserveMet: false,
    status: "Paused",
    startTime: "12:00 PM",
    endTime: "8:00 PM",
  },
];

const bidLogsData = [
  {
    bidId: "BID-501",
    auctionId: "AUC-101",
    bidder: "User-34",
    amount: "$1,250",
    time: "2 mins ago",
    suspicious: false,
  },
  {
    bidId: "BID-502",
    auctionId: "AUC-101",
    bidder: "User-78",
    amount: "$1,300",
    time: "1 min ago",
    suspicious: true,
  },
];

const AuctionBidMonitoring = () => {
  const [auctions, setAuctions] = useState(auctionsData);
  const [bids, setBids] = useState(bidLogsData);

  /* ================= SEARCH & FILTER STATES ================= */

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  /* ================= FILTERED AUCTIONS ================= */

  const filteredAuctions = auctions.filter((auction) => {
    const matchesSearch =
      auction.id.toLowerCase().includes(search.toLowerCase()) ||
      auction.product.toLowerCase().includes(search.toLowerCase()) ||
      auction.seller.toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      filterStatus === "all" ||
      auction.status.toLowerCase() === filterStatus;

    return matchesSearch && matchesStatus;
  });

  /* ================= ACTIONS ================= */

  const toggleAuctionStatus = (id) => {
    setAuctions((prev) =>
      prev.map((auction) =>
        auction.id === id
          ? {
              ...auction,
              status: auction.status === "Live" ? "Paused" : "Live",
            }
          : auction
      )
    );
  };

  const forceCloseAuction = (id) => {
    setAuctions((prev) =>
      prev.map((auction) =>
        auction.id === id ? { ...auction, status: "Closed" } : auction
      )
    );
  };

  const removeBid = (bidId) => {
    setBids((prev) => prev.filter((bid) => bid.bidId !== bidId));
  };

  const suspiciousBids = bids.filter((bid) => bid.suspicious);

  return (
    <div className="admin-page">

      {/* ================= Active Auctions ================= */}

      <div className="admin-section">
        <h3 className="admin-section-heading">Active Auctions</h3>

        {/* 🔎 Search & Filter Controls */}
        <div className="admin-controls">
          <input
            type="text"
            placeholder="Search by Auction ID, Product, Seller"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="live">Live</option>
            <option value="paused">Paused</option>
            <option value="closed">Closed</option>
          </select>
        </div>

        <div className="table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Auction ID</th>
                <th>Product</th>
                <th>Seller</th>
                <th>Current Bid</th>
                <th>Reserve</th>
                <th>Status</th>
                <th>Time</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredAuctions.length === 0 ? (
                <tr>
                  <td colSpan="8" className="no-data">
                    No auctions found
                  </td>
                </tr>
              ) : (
                filteredAuctions.map((auction) => (
                  <tr key={auction.id}>
                    <td>{auction.id}</td>
                    <td>{auction.product}</td>
                    <td>{auction.seller}</td>
                    <td className="highlight-bid">{auction.currentBid}</td>

                    <td>
                      <StatusBadge
                        label={auction.reserveMet ? "Met" : "Not Met"}
                        type={auction.reserveMet ? "approved" : "pending"}
                      />
                    </td>

                    <td>
                      <StatusBadge
                        label={auction.status}
                        type={auction.status.toLowerCase()}
                      />
                    </td>

                    <td>
                      {auction.startTime} – {auction.endTime}
                    </td>

                    <td className="actions">
                      <ActionButton
                        label={auction.status === "Live" ? "Pause" : "Resume"}
                        variant="secondary"
                        onClick={() => toggleAuctionStatus(auction.id)}
                      />
                      <ActionButton
                        label="Force Close"
                        variant="danger"
                        onClick={() => forceCloseAuction(auction.id)}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================= Suspicious Bids ================= */}

      <div className="admin-section">
        <h3 className="admin-section-heading">Suspicious Bids</h3>

        <div className="table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Bid ID</th>
                <th>Auction</th>
                <th>Bidder</th>
                <th>Amount</th>
                <th>Time</th>
                <th>Risk</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {suspiciousBids.length > 0 ? (
                suspiciousBids.map((bid) => (
                  <tr key={bid.bidId}>
                    <td>{bid.bidId}</td>
                    <td>{bid.auctionId}</td>
                    <td>{bid.bidder}</td>
                    <td className="highlight-bid">{bid.amount}</td>
                    <td>{bid.time}</td>
                    <td>
                      <StatusBadge label="Suspicious" type="rejected" />
                    </td>
                    <td className="actions">
                      <ActionButton
                        label="Remove Bid"
                        variant="danger"
                        onClick={() => removeBid(bid.bidId)}
                      />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="empty-state">
                    No suspicious bids found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AuctionBidMonitoring;
