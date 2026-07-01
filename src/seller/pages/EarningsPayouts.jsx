import { useState, useMemo } from "react";
import { useSellerContext } from "../../context/SellerContext";
import StatCard from "../../common/components/StatCard";
import StatusBadge from "../../common/components/StatusBadge";
import "../styles/sellerLayout.css";
import "../styles/earningsPayouts.css";

const EarningsPayouts = () => {
  const { transactions, transactionsLoading, sellerProfile } = useSellerContext();

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  // ── Filtered list ────────────────────────────────────────────────
  const filteredTransactions = useMemo(() => {
    const query = search.toLowerCase();
    return transactions.filter((t) => {
      const productTitle =
        t.payments?.orders?.auctions?.products?.title?.toLowerCase() || "";
      const orderId = t.payments?.orders?.id?.toLowerCase() || "";

      const matchesSearch =
        productTitle.includes(query) ||
        orderId.includes(query) ||
        t.id.toLowerCase().includes(query);

      const matchesStatus =
        filterStatus === "all" || t.status === filterStatus;

      return matchesSearch && matchesStatus;
    });
  }, [transactions, search, filterStatus]);

  // ── Stats ────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const totalRevenue = transactions.reduce((s, t) => s + (t.total_amount || 0), 0);
    const totalEarnings = transactions.reduce((s, t) => s + (t.seller_amount || 0), 0);
    const totalCommission = transactions.reduce((s, t) => s + (t.payments?.platform_fee || 0), 0);
    const pendingPayout = transactions
      .filter((t) => t.status === "onhold")
      .reduce((s, t) => s + (t.seller_amount || 0), 0);
    const releasedPayout = transactions
      .filter((t) => t.status === "released")
      .reduce((s, t) => s + (t.seller_amount || 0), 0);

    return { totalRevenue, totalEarnings, totalCommission, pendingPayout, releasedPayout };
  }, [transactions]);

  const statsData = [
    {
      title: "Total Sales",
      value: transactionsLoading ? "..." : `PKR ${stats.totalRevenue.toLocaleString()}`,
      subtitle: "Gross revenue before commission",
    },
    {
      title: "Total Net Earnings",
      value: transactionsLoading ? "..." : `PKR ${stats.totalEarnings.toLocaleString()}`,
      subtitle: "After 25% platform fee",
    },
    {
      title: "Released to You",
      value: transactionsLoading ? "..." : `PKR ${stats.releasedPayout.toLocaleString()}`,
      subtitle: "Successfully paid out",
    },
    {
      title: "Pending Payout",
      value: transactionsLoading ? "..." : `PKR ${stats.pendingPayout.toLocaleString()}`,
      subtitle: "Currently on hold",
    },
    {
      title: "Commission Paid",
      value: transactionsLoading ? "..." : `PKR ${stats.totalCommission.toLocaleString()}`,
      subtitle: "25% platform fee",
    },
  ];

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-PK", {
      year: "numeric", month: "short", day: "numeric",
    });
  };

  return (
    <div className="seller-page">

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

      {/* TABLE */}
      <div className="seller-section">
        <h3 className="seller-section-heading">Transactions & Payout History</h3>

        <div className="page-controls">
          <input
            type="text"
            placeholder="Search by product, order ID or transaction ID"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="onhold">On Hold</option>
            <option value="released">Released</option>
          </select>
        </div>

        {transactionsLoading ? (
          <div className="loading-state">Loading transactions...</div>
        ) : (
          <div className="table-wrapper">
            <table className="seller-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Total Sale</th>
                  <th>Platform Fee (25%)</th>
                  <th>Your Earnings</th>
                  <th>Payment Date</th>
                  <th>Hold Until</th>
                  <th>Payout Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="no-data">No transactions found</td>
                  </tr>
                ) : (
                  filteredTransactions.map((t) => (
                    <tr key={t.id}>
                      <td>
                        {t.payments?.orders?.auctions?.products?.title || "—"}
                      </td>
                      <td>PKR {t.total_amount?.toLocaleString() || 0}</td>
                      <td>PKR {t.payments?.platform_fee?.toLocaleString() || 0}</td>
                      <td>PKR {t.seller_amount?.toLocaleString() || 0}</td>
                      <td>{formatDate(t.payments?.payment_date)}</td>
                      <td>{formatDate(t.hold_until)}</td>
                      <td>
                        <StatusBadge
                          label={t.status === "released" ? "Released" : "On Hold"}
                          type={t.status === "released" ? "approved" : "pending"}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default EarningsPayouts;