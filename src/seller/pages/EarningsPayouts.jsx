import { useState, useMemo } from "react";
import "../styles/sellerLayout.css"; // ✅ Reusing same styles
import "../styles/earningsPayouts.css";

import StatCard from "../../common/components/StatCard";
import StatusBadge from "../../common/components/StatusBadge";

/* ===== Constants ===== */
const COMMISSION_RATE = 0.05;

/* ===== Sample Transactions ===== */
const transactionsData = [
  {
    id: "TXN-101",
    auctionId: "AUC-201",
    item: "Vintage Clock",
    winningBid: 500,
    deliveryStatus: "delivered",
    paymentStatus: "released",
    payoutStatus: "paid",
    date: "2026-01-15",
  },
  {
    id: "TXN-102",
    auctionId: "AUC-202",
    item: "Antique Vase",
    winningBid: 800,
    deliveryStatus: "pending",
    paymentStatus: "holding",
    payoutStatus: "processing",
    date: "2026-01-18",
  },
  {
    id: "TXN-103",
    auctionId: "AUC-203",
    item: "Luxury Sofa",
    winningBid: 1200,
    deliveryStatus: "delivered",
    paymentStatus: "released",
    payoutStatus: "scheduled",
    date: "2026-01-20",
  },
];

const EarningsPayouts = () => {
  const [transactions] = useState(transactionsData);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  /* ===== Calculate Commission & Net ===== */
  const calculatedTransactions = useMemo(() => {
    return transactions.map((t) => {
      const commission = t.winningBid * COMMISSION_RATE;
      const net = t.winningBid - commission;

      return { ...t, commission, net };
    });
  }, [transactions]);

  /* ===== Simplified Payout Status ===== */
const simplifiedStatus = (status) => {
  return status === "paid" ? "Paid" : "Pending";
};

/* ===== Search + Filter Logic ===== */
const filteredTransactions = calculatedTransactions.filter((t) => {
  const matchesSearch =
    t.auctionId.toLowerCase().includes(search.toLowerCase()) ||
    t.item.toLowerCase().includes(search.toLowerCase()) ||
    t.id.toLowerCase().includes(search.toLowerCase());

  const matchesStatus =
    filterStatus === "all" || simplifiedStatus(t.payoutStatus).toLowerCase() === filterStatus;

  return matchesSearch && matchesStatus;
});

  /* ===== Connected Stats (Based on Filtered Data) ===== */

  const totalNet = calculatedTransactions.reduce(
    (acc, t) => acc + t.net,
    0
  );
  const totalSales = calculatedTransactions.reduce(
    (acc, t) => acc + t.winningBid,
    0
  );

  const completedTransactions = calculatedTransactions.filter(
    (t) => t.payoutStatus === "paid"
  ).length;

  const totalPaid = calculatedTransactions
    .filter((t) => t.payoutStatus === "paid")
    .reduce((acc, t) => acc + t.net, 0);

  const totalCommission = filteredTransactions.reduce(
    (acc, t) => acc + t.commission,
    0
  );

  const statsData = [
    {
      title: "Total Sales",
      value: `PKR ${totalSales.toFixed(2).toLocaleString()}`,
      subtitle: "Gross revenue before commission",
    },
    {
      title: "Total Net Earnings",
      value: `PKR ${totalNet.toFixed(2).toLocaleString()}`,
      subtitle: "Earnings after platform fee",
    },
    {
      title: "Total Paid to You",
      value: `PKR ${totalPaid.toFixed(2).toLocaleString()}`,
      subtitle: "Amount successfully received",
    },
    {
      title: "Completed Transactions",
      value: completedTransactions,
      subtitle: "Successfully paid sales",
    },
    {
      title: "Commission Paid",
      value: `PKR ${totalCommission.toFixed(2).toLocaleString()}`,
      subtitle: `Platform fee (${COMMISSION_RATE * 100}%)`,
    },
  ];

  return (
    <div className="seller-page">

      {/* ===== Stats Cards ===== */}
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

      {/* ===== Table ===== */}
      <div className="seller-section">
        <h3 className="seller-section-heading">Transactions & Payout History</h3>

        {/* ===== (Search + Filter) ===== */}
        <div className="page-controls">
          <input
            type="text"
            placeholder="Search by Auction ID, Item, or Transaction ID"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">Payout Status</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
          </select>
        </div>

        <div className="table-wrapper">
          <table className="seller-table">
            <thead>
              <tr>
                <th>Transaction ID</th>
                <th>Auction ID</th>
                <th>Item</th>
                <th>Winning Bid</th>
                <th>Commission</th>
                <th>Net Earnings</th>
                <th>Payout Status</th>
              </tr>
            </thead>

            <tbody>
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan="7" className="no-data">
                    No transactions found
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((t) => (
                  <tr key={t.id}>
                    <td>{t.id}</td>
                    <td>{t.auctionId}</td>
                    <td>{t.item}</td>
                    <td>{t.winningBid.toFixed(2).toLocaleString()}</td>
                    <td>{t.commission.toFixed(2).toLocaleString()}</td>
                    <td>
                      {t.net.toFixed(2).toLocaleString()}
                    </td>
                    <td>
                      <StatusBadge
                        label={simplifiedStatus(t.payoutStatus)}
                        type={simplifiedStatus(t.payoutStatus).toLowerCase()}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default EarningsPayouts;
