import { useState, useEffect, useMemo } from "react";
import { supabase } from "../../supabase/supabase";
import { useAuthContext } from "../../context/AuthContext";
import StatCard from "../../common/components/StatCard";
import StatusBadge from "../../common/components/StatusBadge";
import "../styles/sellerLayout.css";
import "../styles/earningsPayouts.css";

const COMMISSION_RATE = 0.25; // 25%

const EarningsPayouts = () => {

  const { user } = useAuthContext();

  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  useEffect(() => {
    if (!user) return;
    fetchTransactions();
  }, [user]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);

      // Get seller id
      const { data: sellerData } = await supabase
        .from('sellers')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!sellerData) return;

      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
          payments (
            id,
            total_amount,
            platform_fee,
            status,
            payment_date,
            orders (
              id,
              auctions (
                id,
                products ( title )
              )
            )
          )
        `)
        .eq('seller_id', sellerData.id)
        .order('release_date', { ascending: false });

      if (error) {
        console.error(error);
        return;
      }

      setTransactions(data || []);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredTransactions = transactions.filter(t => {
    const productTitle = t.payments?.orders?.auctions?.products?.title?.toLowerCase() || '';
    const orderId = t.payments?.orders?.id?.toLowerCase() || '';
    const query = search.toLowerCase();

    const matchesSearch =
      productTitle.includes(query) ||
      orderId.includes(query) ||
      t.id.toLowerCase().includes(query);

    const matchesStatus =
      filterStatus === "all" || t.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  // Stats
  const stats = useMemo(() => {
    const totalRevenue = transactions.reduce((sum, t) => sum + (t.total_amount || 0), 0);
    const totalEarnings = transactions.reduce((sum, t) => sum + (t.seller_amount || 0), 0);
    const totalCommission = transactions.reduce((sum, t) => sum + (t.payments?.platform_fee || 0), 0);
    const pendingPayout = transactions
      .filter(t => t.status === 'onhold')
      .reduce((sum, t) => sum + (t.seller_amount || 0), 0);
    const releasedPayout = transactions
      .filter(t => t.status === 'released')
      .reduce((sum, t) => sum + (t.seller_amount || 0), 0);

    return { totalRevenue, totalEarnings, totalCommission, pendingPayout, releasedPayout };
  }, [transactions]);

  const statsData = [
    {
      title: "Total Sales",
      value: loading ? "..." : `PKR ${stats.totalRevenue.toLocaleString()}`,
      subtitle: "Gross revenue before commission"
    },
    {
      title: "Total Net Earnings",
      value: loading ? "..." : `PKR ${stats.totalEarnings.toLocaleString()}`,
      subtitle: "After 25% platform fee"
    },
    {
      title: "Released to You",
      value: loading ? "..." : `PKR ${stats.releasedPayout.toLocaleString()}`,
      subtitle: "Successfully paid out"
    },
    {
      title: "Pending Payout",
      value: loading ? "..." : `PKR ${stats.pendingPayout.toLocaleString()}`,
      subtitle: "Currently on hold"
    },
    {
      title: "Commission Paid",
      value: loading ? "..." : `PKR ${stats.totalCommission.toLocaleString()}`,
      subtitle: "25% platform fee"
    },
  ];

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-PK', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  };

  return (
    <div className="seller-page">

      <div className="stats-grid">
        {statsData.map((item, index) => (
          <StatCard key={index} title={item.title} value={item.value} subtitle={item.subtitle} />
        ))}
      </div>

      <div className="seller-section">
        <h3 className="seller-section-heading">Transactions & Payout History</h3>

        <div className="page-controls">
          <input
            type="text"
            placeholder="Search by product, order ID or transaction ID"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="all">All Status</option>
            <option value="onhold">On Hold</option>
            <option value="released">Released</option>
          </select>
        </div>

        {loading ? (
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
                  filteredTransactions.map(t => (
                    <tr key={t.id}>
                      <td>{t.payments?.orders?.auctions?.products?.title || '—'}</td>
                      <td>PKR {t.total_amount?.toLocaleString() || 0}</td>
                      <td>PKR {t.payments?.platform_fee?.toLocaleString() || 0}</td>
                      <td>PKR {t.seller_amount?.toLocaleString() || 0}</td>
                      <td>{formatDate(t.payments?.payment_date)}</td>
                      <td>{formatDate(t.hold_until)}</td>
                      <td>
                        <StatusBadge
                          label={t.status === 'released' ? 'Released' : 'On Hold'}
                          type={t.status === 'released' ? 'approved' : 'pending'}
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