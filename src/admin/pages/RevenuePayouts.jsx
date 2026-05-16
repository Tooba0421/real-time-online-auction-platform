import { useState, useEffect, useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line, Doughnut } from "react-chartjs-2";
import { supabase } from "../../supabase/supabase";
import { useAuthContext } from "../../context/AuthContext";
import toast from "react-hot-toast";
import StatCard from "../../common/components/StatCard";
import StatusBadge from "../../common/components/StatusBadge";
import ActionButton from "../../common/components/ActionButton";
import "../styles/adminLayout.css";
import "../styles/revenuePayouts.css";

ChartJS.register(
  CategoryScale, LinearScale, PointElement,
  LineElement, ArcElement, Tooltip, Legend, Filler
);

const RevenuePayouts = () => {

  const { user } = useAuthContext();

  const [pendingTransactions, setPendingTransactions] = useState([]);
  const [releasedTransactions, setReleasedTransactions] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);

  const COMMISSION_RATE = 0.25; // 25%

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch transactions with related data
      const { data: transactionData, error } = await supabase
        .from('transactions')
        .select(`
          *,
          payments (
            id,
            status,
            payment_date,
            total_amount,
            platform_fee,
            orders (
              id,
              buyers (
                profiles ( name )
              ),
              auctions (
                products ( title )
              )
            )
          ),
          sellers (
            id,
            business_name,
            user_id,
            profiles ( name )
          )
        `)
        .order('release_date', { ascending: false });

      if (error) {
        toast.error("Error fetching transactions");
        console.error(error);
        return;
      }

      // Fetch all paid payments for revenue chart
      const { data: paymentData } = await supabase
        .from('payments')
        .select('total_amount, payment_date, platform_fee')
        .eq('status', 'paid')
        .order('payment_date', { ascending: true });

      setPayments(paymentData || []);

      const pending = [];
      const released = [];

      for (const t of transactionData || []) {
        if (t.status === 'onhold') {
          pending.push(t);
        } else if (t.status === 'released') {
          released.push(t);
        }
      }

      setPendingTransactions(pending);
      setReleasedTransactions(released);

    } catch (err) {
      console.error(err);
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  // Manually release payment to seller
  const handleRelease = async (transaction) => {
    if (!window.confirm("Release this payment to the seller?")) return;

    try {
      setProcessing(transaction.id);

      // Step 1: Update transaction status
      const { error: transactionError } = await supabase
        .from('transactions')
        .update({
          status: 'released',
          release_date: new Date().toISOString()
        })
        .eq('id', transaction.id);

      if (transactionError) {
        toast.error("Error releasing transaction");
        console.error(transactionError);
        return;
      }

      // Step 2: Update payment hold_status
      const { error: paymentError } = await supabase
        .from('payments')
        .update({ hold_status: false })
        .eq('id', transaction.payment_id);

      if (paymentError) {
        toast.error("Error updating payment");
        console.error(paymentError);
        return;
      }

      // Step 3: Notify seller
      if (transaction.sellers?.user_id) {
        await supabase
          .from('notifications')
          .insert({
            user_id: transaction.sellers.user_id,
            title: 'Payment Released! 💰',
            message: `PKR ${transaction.seller_amount?.toLocaleString()} has been released to your account.`,
            type: 'payment',
            notification_for: 'seller',
            is_read: false
          });
      }

      toast.success("Payment released to seller!");

      // Update local state
      setPendingTransactions(prev =>
        prev.filter(t => t.id !== transaction.id)
      );
      setReleasedTransactions(prev => [
        { ...transaction, status: 'released', release_date: new Date().toISOString() },
        ...prev
      ]);

    } catch (err) {
      console.error(err);
      toast.error("Something went wrong");
    } finally {
      setProcessing(null);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-PK', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  };

  // Derived stats
  const totalRevenue = payments.reduce((sum, p) => sum + (p.total_amount || 0), 0);
  const totalPlatformEarnings = payments.reduce((sum, p) => sum + (p.platform_fee || 0), 0);
  const pendingPayouts = pendingTransactions.reduce((sum, t) => sum + (t.seller_amount || 0), 0);
  const releasedPayouts = releasedTransactions.reduce((sum, t) => sum + (t.seller_amount || 0), 0);

  const statsData = [
    { title: "Total Revenue", value: loading ? "..." : `PKR ${totalRevenue.toLocaleString()}`, subtitle: "All paid transactions" },
    { title: "Platform Earnings (25%)", value: loading ? "..." : `PKR ${totalPlatformEarnings.toLocaleString()}`, subtitle: "Commission earned" },
    { title: "Pending Payouts", value: loading ? "..." : `PKR ${pendingPayouts.toLocaleString()}`, subtitle: "On hold" },
    { title: "Released to Sellers", value: loading ? "..." : `PKR ${releasedPayouts.toLocaleString()}`, subtitle: "Successfully paid out" },
  ];

  // Monthly revenue chart from real data
  const revenueTrend = useMemo(() => {
    const monthly = Array(12).fill(0);
    payments.forEach(p => {
      const month = new Date(p.payment_date).getMonth();
      monthly[month] += p.total_amount || 0;
    });

    return {
      labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
      datasets: [{
        label: "Revenue (PKR)",
        data: monthly,
        borderColor: "#2563EB",
        backgroundColor: "rgba(37,99,235,0.15)",
        fill: true,
        tension: 0.4,
      }],
    };
  }, [payments]);

  const commissionData = useMemo(() => ({
    labels: ["Platform Earnings (25%)", "Seller Earnings (75%)"],
    datasets: [{
      data: [totalPlatformEarnings, totalRevenue - totalPlatformEarnings],
      backgroundColor: ["#10B981", "#3B82F6"],
    }],
  }), [totalPlatformEarnings, totalRevenue]);

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "0%",
    layout: { padding: { top: 10, bottom: 30 } },
    plugins: {
      legend: {
        position: "top", align: "center",
        labels: { boxWidth: 30, padding: 15 },
      },
    },
  };

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top", align: "center",
        labels: { boxWidth: 30, padding: 15 },
      },
    },
  };

  return (
    <div className="admin-page">

      {/* STAT CARDS */}
      <div className="stats-grid">
        {statsData.map((item, index) => (
          <StatCard key={index} title={item.title} value={item.value} subtitle={item.subtitle} />
        ))}
      </div>

      {/* PENDING PAYOUTS TABLE */}
      <div className="admin-section">
        <h3 className="admin-section-heading">Pending Payouts (On Hold)</h3>
        {loading ? (
          <div className="loading-state">Loading transactions...</div>
        ) : (
          <div className="table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Seller</th>
                  <th>Business</th>
                  <th>Product</th>
                  <th>Buyer</th>
                  <th>Total Amount</th>
                  <th>Platform Fee</th>
                  <th>Seller Amount</th>
                  <th>Payment Date</th>
                  <th>Hold Until</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {pendingTransactions.length === 0 ? (
                  <tr>
                    <td colSpan="11" className="empty-row">No pending payouts</td>
                  </tr>
                ) : (
                  pendingTransactions.map(t => (
                    <tr key={t.id}>
                      <td>{t.sellers?.profiles?.name || '—'}</td>
                      <td>{t.sellers?.business_name || '—'}</td>
                      <td>{t.payments?.orders?.auctions?.products?.title || '—'}</td>
                      <td>{t.payments?.orders?.buyers?.profiles?.name || '—'}</td>
                      <td>PKR {t.total_amount?.toLocaleString()}</td>
                      <td>PKR {t.payments?.platform_fee?.toLocaleString() || 0}</td>
                      <td>PKR {t.seller_amount?.toLocaleString()}</td>
                      <td>{formatDate(t.payments?.payment_date)}</td>
                      <td>{formatDate(t.hold_until)}</td>
                      <td>
                        <StatusBadge label="On Hold" type="pending" />
                      </td>
                      <td className="actions">
                        <ActionButton
                          label={processing === t.id ? "Releasing..." : "Release"}
                          variant="success"
                          onClick={() => handleRelease(t)}
                          disabled={processing === t.id}
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

      {/* RELEASED PAYOUTS TABLE */}
      <div className="admin-section">
        <h3 className="admin-section-heading">Released Payouts</h3>
        {loading ? (
          <div className="loading-state">Loading transactions...</div>
        ) : (
          <div className="table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Seller</th>
                  <th>Business</th>
                  <th>Product</th>
                  <th>Total Amount</th>
                  <th>Platform Fee</th>
                  <th>Seller Amount</th>
                  <th>Release Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {releasedTransactions.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="empty-row">No released payouts</td>
                  </tr>
                ) : (
                  releasedTransactions.map(t => (
                    <tr key={t.id}>
                      <td>{t.sellers?.profiles?.name || '—'}</td>
                      <td>{t.sellers?.business_name || '—'}</td>
                      <td>{t.payments?.orders?.auctions?.products?.title || '—'}</td>
                      <td>PKR {t.total_amount?.toLocaleString()}</td>
                      <td>PKR {t.payments?.platform_fee?.toLocaleString() || 0}</td>
                      <td>PKR {t.seller_amount?.toLocaleString()}</td>
                      <td>{formatDate(t.release_date)}</td>
                      <td>
                        <StatusBadge label="Released" type="approved" />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CHARTS */}
      <div className="overview-grid">
        <div className="chart-box">
          <h3 className="admin-section-heading">Revenue Growth</h3>
          <div className="chart-container">
            <Line data={revenueTrend} options={lineOptions} />
          </div>
        </div>
        <div className="chart-box">
          <h3 className="admin-section-heading">Commission Breakdown</h3>
          <div className="chart-container">
            <Doughnut data={commissionData} options={doughnutOptions} />
          </div>
        </div>
      </div>

    </div>
  );
};

export default RevenuePayouts;