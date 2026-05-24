import { useState, useMemo } from "react";
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  PointElement, LineElement, ArcElement, Tooltip, Legend, Filler,
} from "chart.js";
import { Line, Doughnut } from "react-chartjs-2";
import { supabase } from "../../supabase/supabase";
import { useAuthContext } from "../../context/AuthContext";
import { useAdminContext } from "../../context/AdminContext";
import toast from "react-hot-toast";
import StatCard from "../../common/components/StatCard";
import StatusBadge from "../../common/components/StatusBadge";
import ActionButton from "../../common/components/ActionButton";
import "../styles/adminLayout.css";
import "../styles/revenuePayouts.css";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ArcElement, Tooltip, Legend, Filler);

const RevenuePayouts = () => {
  const { user } = useAuthContext();
  const {
    pendingTransactions,
    releasedTransactions,
    payments,
    revenueLoading,
    updateTransactionLocally,
    refetchRevenue,
  } = useAdminContext();

  const [processing, setProcessing] = useState(null);

  const handleRelease = async (transaction) => {
    if (!window.confirm("Release this payment to the seller?")) return;
    try {
      setProcessing(transaction.id);
      // Optimistic update — moves row from pending to released immediately
      updateTransactionLocally(transaction.id, {
        status: "released",
        release_date: new Date().toISOString(),
      });

      const [{ error: txErr }, { error: payErr }] = await Promise.all([
        supabase.from("transactions")
          .update({ status: "released", release_date: new Date().toISOString() })
          .eq("id", transaction.id),
        supabase.from("payments")
          .update({ hold_status: false })
          .eq("id", transaction.payment_id),
      ]);

      if (txErr || payErr) {
        toast.error("Error releasing transaction");
        refetchRevenue(); // rollback via fresh fetch
        return;
      }

      if (transaction.sellers?.user_id) {
        await supabase.from("notifications").insert({
          user_id: transaction.sellers.user_id,
          title: "Payment Released! 💰",
          message: `PKR ${transaction.seller_amount?.toLocaleString()} has been released to your account.`,
          type: "payment", notification_for: "seller", is_read: false,
        });
      }

      toast.success("Payment released to seller!");
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong");
      refetchRevenue();
    } finally {
      setProcessing(null);
    }
  };

  const formatDate = (d) => !d ? "—" : new Date(d).toLocaleDateString("en-PK", {
    year: "numeric", month: "short", day: "numeric",
  });

  const totalRevenue          = payments.reduce((s, p) => s + (p.total_amount || 0), 0);
  const totalPlatformEarnings = payments.reduce((s, p) => s + (p.platform_fee  || 0), 0);
  const pendingPayouts        = pendingTransactions.reduce((s, t) => s + (t.seller_amount || 0), 0);
  const releasedPayouts       = releasedTransactions.reduce((s, t) => s + (t.seller_amount || 0), 0);

  const statsData = [
    { title: "Total Revenue",           value: revenueLoading ? "..." : `PKR ${totalRevenue.toLocaleString()}`,          subtitle: "All paid transactions" },
    { title: "Platform Earnings (25%)", value: revenueLoading ? "..." : `PKR ${totalPlatformEarnings.toLocaleString()}`, subtitle: "Commission earned" },
    { title: "Pending Payouts",         value: revenueLoading ? "..." : `PKR ${pendingPayouts.toLocaleString()}`,        subtitle: "On hold" },
    { title: "Released to Sellers",     value: revenueLoading ? "..." : `PKR ${releasedPayouts.toLocaleString()}`,       subtitle: "Successfully paid out" },
  ];

  const revenueTrend = useMemo(() => {
    const monthly = Array(12).fill(0);
    payments.forEach((p) => { if (p.payment_date) monthly[new Date(p.payment_date).getMonth()] += p.total_amount || 0; });
    return {
      labels: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
      datasets: [{
        label: "Revenue (PKR)", data: monthly,
        borderColor: "#2563EB", backgroundColor: "rgba(37,99,235,0.15)",
        fill: true, tension: 0.4,
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
    responsive: true, maintainAspectRatio: false, cutout: "0%",
    layout: { padding: { top: 10, bottom: 30 } },
    plugins: { legend: { position: "top", align: "center", labels: { boxWidth: 30, padding: 15 } } },
  };
  const lineOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { position: "top", align: "center", labels: { boxWidth: 30, padding: 15 } } },
  };

  return (
    <div className="admin-page">

      <div className="stats-grid">
        {statsData.map((item, i) => (
          <StatCard key={i} title={item.title} value={item.value} subtitle={item.subtitle} />
        ))}
      </div>

      <div className="admin-section">
        <h3 className="admin-section-heading">Pending Payouts (On Hold)</h3>
        {revenueLoading ? <div className="loading-state">Loading transactions...</div> : (
          <div className="table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Seller</th><th>Business</th><th>Product</th><th>Buyer</th>
                  <th>Total Amount</th><th>Platform Fee</th><th>Seller Amount</th>
                  <th>Payment Date</th><th>Hold Until</th><th>Status</th><th>Action</th>
                </tr>
              </thead>
              <tbody>
                {pendingTransactions.length === 0 ? (
                  <tr><td colSpan="11" className="empty-row">No pending payouts</td></tr>
                ) : pendingTransactions.map((t) => (
                  <tr key={t.id}>
                    <td>{t.sellers?.profiles?.name    || "—"}</td>
                    <td>{t.sellers?.business_name     || "—"}</td>
                    <td>{t.payments?.orders?.auctions?.products?.title || "—"}</td>
                    <td>{t.payments?.orders?.buyers?.profiles?.name    || "—"}</td>
                    <td>PKR {t.total_amount?.toLocaleString()}</td>
                    <td>PKR {t.payments?.platform_fee?.toLocaleString() || 0}</td>
                    <td>PKR {t.seller_amount?.toLocaleString()}</td>
                    <td>{formatDate(t.payments?.payment_date)}</td>
                    <td>{formatDate(t.hold_until)}</td>
                    <td><StatusBadge label="On Hold" type="pending" /></td>
                    <td className="actions">
                      <ActionButton
                        label={processing === t.id ? "Releasing..." : "Release"}
                        variant="success"
                        onClick={() => handleRelease(t)}
                        disabled={processing === t.id}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="admin-section">
        <h3 className="admin-section-heading">Released Payouts</h3>
        {revenueLoading ? <div className="loading-state">Loading transactions...</div> : (
          <div className="table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Seller</th><th>Business</th><th>Product</th>
                  <th>Total Amount</th><th>Platform Fee</th><th>Seller Amount</th>
                  <th>Release Date</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {releasedTransactions.length === 0 ? (
                  <tr><td colSpan="8" className="empty-row">No released payouts</td></tr>
                ) : releasedTransactions.map((t) => (
                  <tr key={t.id}>
                    <td>{t.sellers?.profiles?.name || "—"}</td>
                    <td>{t.sellers?.business_name  || "—"}</td>
                    <td>{t.payments?.orders?.auctions?.products?.title || "—"}</td>
                    <td>PKR {t.total_amount?.toLocaleString()}</td>
                    <td>PKR {t.payments?.platform_fee?.toLocaleString() || 0}</td>
                    <td>PKR {t.seller_amount?.toLocaleString()}</td>
                    <td>{formatDate(t.release_date)}</td>
                    <td><StatusBadge label="Released" type="approved" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="overview-grid">
        <div className="chart-box">
          <h3 className="admin-section-heading">Revenue Growth</h3>
          <div className="chart-container"><Line data={revenueTrend} options={lineOptions} /></div>
        </div>
        <div className="chart-box">
          <h3 className="admin-section-heading">Commission Breakdown</h3>
          <div className="chart-container"><Doughnut data={commissionData} options={doughnutOptions} /></div>
        </div>
      </div>

    </div>
  );
};

export default RevenuePayouts;