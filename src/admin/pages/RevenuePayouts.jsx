import { useState, useMemo } from "react";
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  PointElement, LineElement, ArcElement, Tooltip, Legend, Filler,
} from "chart.js";
import { Line, Doughnut } from "react-chartjs-2";
import { supabase } from "../../supabase/supabase";
import { useAdminContext } from "../../context/AdminContext";
import toast from "react-hot-toast";
import StatCard from "../../common/components/StatCard";
import StatusBadge from "../../common/components/StatusBadge";
import ActionButton from "../../common/components/ActionButton";
import "../styles/adminLayout.css";
import "../styles/revenuePayouts.css";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ArcElement, Tooltip, Legend, Filler);

const RevenuePayouts = () => {
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
    const sellerName = transaction.sellers?.profiles?.name
      || transaction.sellers?.business_name || "the seller";
    const amount = transaction.seller_amount?.toLocaleString() || 0;

    if (!window.confirm(
      `Release PKR ${amount} to ${sellerName}?\n\nThis action cannot be undone.`
    )) return;

    try {
      setProcessing(transaction.id);

      // ✅ Optimistic update — row moves to released immediately in UI
      updateTransactionLocally(transaction.id, {
        status:       "released",
        release_date: new Date().toISOString(),
      });

      // ── Update transaction ────────────────────────────────────────
      const { error: txErr } = await supabase
        .from("transactions")
        .update({
          status:       "released",
          release_date: new Date().toISOString(),
        })
        .eq("id", transaction.id);

      if (txErr) {
        toast.error(`Error releasing transaction: ${txErr.message}`);
        console.error("Transaction release error:", txErr);
        refetchRevenue(); // rollback optimistic update
        return;
      }

      // ── Update payment hold_status ────────────────────────────────
      const { error: payErr } = await supabase
        .from("payments")
        .update({ hold_status: false })
        .eq("id", transaction.payment_id);

      if (payErr) {
        // Non-critical — transaction status is the source of truth
        console.error("Payment hold_status update error (non-critical):", payErr);
      }

      // ── Notify seller ─────────────────────────────────────────────
      // ✅ FIXED: removed logAdminAction — "release_payment" is not in
      // admin_action_type enum (approve, reject, suspend only)
      // which was causing a 400 error on every release
      if (transaction.sellers?.user_id) {
        await supabase.from("notifications").insert({
          user_id:          transaction.sellers.user_id,
          title:            "Payment Released! 💰",
          message:          `PKR ${amount} has been released to your account for the completed auction.`,
          type:             "payment",
          notification_for: "seller",
          is_read:          false,
        }).catch((e) => console.error("Notification error (non-critical):", e));
      }

      toast.success(`PKR ${amount} released to ${sellerName}!`);

    } catch (err) {
      console.error("handleRelease unexpected error:", err);
      toast.error("Something went wrong. Please try again.");
      refetchRevenue();
    } finally {
      setProcessing(null);
    }
  };

  const formatDate = (d) => !d ? "—" : new Date(d).toLocaleDateString("en-PK", {
    year: "numeric", month: "short", day: "numeric",
  });

  const truncateText = (text, maxLength = 30) => {
    if (!text) return "—";
    return text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
  };

  // ── Revenue calculations ──────────────────────────────────────────
  // Total revenue = ALL payments received (held + released)
  const totalRevenue = payments
    .reduce((s, p) => s + (p.total_amount || 0), 0);

  // Platform earnings = only from released payments (hold_status = false)
  const totalPlatformEarnings = payments
    .filter((p) => p.hold_status === false)
    .reduce((s, p) => s + (p.platform_fee || 0), 0);

  const pendingPayouts  = pendingTransactions
    .reduce((s, t) => s + (t.seller_amount || 0), 0);

  const releasedPayouts = releasedTransactions
    .reduce((s, t) => s + (t.seller_amount || 0), 0);

  const statsData = [
    {
      title:    "Total Revenue",
      value:    revenueLoading ? "..." : `PKR ${totalRevenue.toLocaleString()}`,
      subtitle: "All completed payments",
    },
    {
      title:    "Platform Earnings (25%)",
      value:    revenueLoading ? "..." : `PKR ${totalPlatformEarnings.toLocaleString()}`,
      subtitle: "Commission from released payouts",
    },
    {
      title:    "Pending Payouts",
      value:    revenueLoading ? "..." : `PKR ${pendingPayouts.toLocaleString()}`,
      subtitle: "Held — not yet released to sellers",
    },
    {
      title:    "Released to Sellers",
      value:    revenueLoading ? "..." : `PKR ${releasedPayouts.toLocaleString()}`,
      subtitle: "Successfully paid out",
    },
  ];

  // ── Charts ────────────────────────────────────────────────────────
  const revenueTrend = useMemo(() => {
    const monthly = Array(12).fill(0);
    payments.forEach((p) => {
      if (p.payment_date)
        monthly[new Date(p.payment_date).getMonth()] += p.total_amount || 0;
    });
    return {
      labels: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
      datasets: [{
        label:           "Revenue (PKR)",
        data:            monthly,
        borderColor:     "#2563EB",
        backgroundColor: "rgba(37,99,235,0.15)",
        fill:            true,
        tension:         0.4,
      }],
    };
  }, [payments]);

  const commissionData = useMemo(() => {
    const sellerEarnings = Math.max(0, totalRevenue - totalPlatformEarnings);
    return {
      labels: ["Platform (25%)", "Sellers (75%)"],
      datasets: [{
        data:            [totalPlatformEarnings, sellerEarnings],
        backgroundColor: ["#10B981", "#3B82F6"],
      }],
    };
  }, [totalPlatformEarnings, totalRevenue]);

  const doughnutOptions = {
    responsive: true, maintainAspectRatio: false, cutout: "0%",
    layout: { padding: { top: 10, bottom: 30 } },
    plugins: {
      legend: { position: "top", align: "center", labels: { boxWidth: 30, padding: 15 } },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
            const pct   = total > 0 ? ((ctx.raw / total) * 100).toFixed(1) : 0;
            return `${ctx.label}: PKR ${ctx.raw.toLocaleString()} (${pct}%)`;
          },
        },
      },
    },
  };

  const lineOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { position: "top", align: "center", labels: { boxWidth: 30, padding: 15 } },
      tooltip: {
        callbacks: { label: (ctx) => `PKR ${ctx.raw.toLocaleString()}` },
      },
    },
  };

  return (
    <div className="admin-page">

      {/* STAT CARDS */}
      <div className="stats-grid">
        {statsData.map((item, i) => (
          <StatCard key={i} title={item.title} value={item.value} subtitle={item.subtitle} />
        ))}
      </div>

      {/* PENDING PAYOUTS TABLE */}
      <div className="admin-section">
        <h3 className="admin-section-heading">Pending Payouts</h3>
        {revenueLoading ? (
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
                    <td colSpan="11" className="empty-row">
                      No pending payouts. All payments have been released.
                    </td>
                  </tr>
                ) : pendingTransactions.map((t) => (
                  <tr key={t.id}>
                    <td>{t.sellers?.profiles?.name || "—"}</td>
                    <td>{t.sellers?.business_name  || "—"}</td>
                    <td title={t.payments?.orders?.auctions?.products?.title}>
                      {truncateText(t.payments?.orders?.auctions?.products?.title)}
                    </td>
                    <td>{t.payments?.orders?.buyers?.profiles?.name || "—"}</td>
                    <td>PKR {t.total_amount?.toLocaleString()}</td>
                    <td>PKR {(t.payments?.platform_fee || 0).toLocaleString()}</td>
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

      {/* RELEASED PAYOUTS TABLE */}
      <div className="admin-section">
        <h3 className="admin-section-heading">Released Payouts</h3>
        {revenueLoading ? (
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
                    <td colSpan="8" className="empty-row">No released payouts yet</td>
                  </tr>
                ) : releasedTransactions.map((t) => (
                  <tr key={t.id}>
                    <td>{t.sellers?.profiles?.name || "—"}</td>
                    <td>{t.sellers?.business_name  || "—"}</td>
                    <td title={t.payments?.orders?.auctions?.products?.title}>
                      {truncateText(t.payments?.orders?.auctions?.products?.title)}
                    </td>
                    <td>PKR {t.total_amount?.toLocaleString()}</td>
                    <td>PKR {(t.payments?.platform_fee || 0).toLocaleString()}</td>
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