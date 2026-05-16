import { useMemo, useState, useEffect } from "react";
import { useAuthContext } from "../../context/AuthContext";
import { supabase } from "../../supabase/supabase";
import StatCard from "../../common/components/StatCard";
import { Bar, Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import "../styles/sellerLayout.css";
import "../styles/sellerHome.css";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend
);

const SellerHome = () => {

  const { user } = useAuthContext();

  const [loading, setLoading] = useState(true);
  const [sellerId, setSellerId] = useState(null);

  // Stats
  const [activeListings, setActiveListings] = useState(0);
  const [totalBids, setTotalBids] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [pendingPayout, setPendingPayout] = useState(0);

  // Chart data
  const [bidsPerDay, setBidsPerDay] = useState(Array(7).fill(0));
  const [latestEnded, setLatestEnded] = useState([]);

  // Top auction
  const [topAuction, setTopAuction] = useState(null);

  useEffect(() => {
    if (!user) return;
    initSeller();
  }, [user]);

  const initSeller = async () => {
    try {
      setLoading(true);

      // Get seller record from sellers table using user_id
      const { data: sellerData, error } = await supabase
        .from('sellers')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (error || !sellerData) {
        console.error("Seller not found:", error);
        return;
      }

      setSellerId(sellerData.id);
      await fetchAllStats(sellerData.id);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllStats = async (sid) => {
    await Promise.all([
      fetchActiveListings(sid),
      fetchTotalBids(sid),
      fetchRevenue(sid),
      fetchPendingPayout(sid),
      fetchBidsPerDay(sid),
      fetchLatestEndedAuctions(sid),
      fetchTopLiveAuction(sid),
    ]);
  };

  // Active listings (live + paused)
  const fetchActiveListings = async (sid) => {
    const { count } = await supabase
      .from('auctions')
      .select('*', { count: 'exact', head: true })
      .eq('seller_id', sid)
      .in('status', ['live', 'paused']);

    setActiveListings(count || 0);
  };

  // Total bids across all seller auctions
  const fetchTotalBids = async (sid) => {
    // Get all auction IDs for this seller
    const { data: auctionData } = await supabase
      .from('auctions')
      .select('id')
      .eq('seller_id', sid);

    if (!auctionData?.length) {
      setTotalBids(0);
      return;
    }

    const auctionIds = auctionData.map(a => a.id);

    const { count } = await supabase
      .from('bids')
      .select('*', { count: 'exact', head: true })
      .in('auction_id', auctionIds);

    setTotalBids(count || 0);
  };

  // Total revenue from released transactions
  const fetchRevenue = async (sid) => {
    const { data } = await supabase
      .from('transactions')
      .select('seller_amount')
      .eq('seller_id', sid)
      .eq('status', 'released');

    const total = data?.reduce((sum, t) => sum + (t.seller_amount || 0), 0) || 0;
    setTotalRevenue(total);
  };

  // Pending payout — onhold transactions
  const fetchPendingPayout = async (sid) => {
    const { data } = await supabase
      .from('transactions')
      .select('seller_amount')
      .eq('seller_id', sid)
      .eq('status', 'onhold');

    const total = data?.reduce((sum, t) => sum + (t.seller_amount || 0), 0) || 0;
    setPendingPayout(total);
  };

  // Bids per day — last 7 days
  const fetchBidsPerDay = async (sid) => {
    const { data: auctionData } = await supabase
      .from('auctions')
      .select('id')
      .eq('seller_id', sid);

    if (!auctionData?.length) return;

    const auctionIds = auctionData.map(a => a.id);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

    const { data: bidsData } = await supabase
      .from('bids')
      .select('bid_time')
      .in('auction_id', auctionIds)
      .gte('bid_time', sevenDaysAgo.toISOString());

    // Group by day
    const daily = Array(7).fill(0);
    bidsData?.forEach(bid => {
      const bidDate = new Date(bid.bid_time);
      const today = new Date();
      const diffDays = Math.floor(
        (today - bidDate) / (1000 * 60 * 60 * 24)
      );
      if (diffDays >= 0 && diffDays < 7) {
        daily[6 - diffDays]++;
      }
    });

    setBidsPerDay(daily);
  };

  // Latest 5 ended auctions for revenue chart
  const fetchLatestEndedAuctions = async (sid) => {
    const { data } = await supabase
      .from('auctions')
      .select(`
        id,
        highest_bid,
        end_time,
        products ( title )
      `)
      .eq('seller_id', sid)
      .eq('status', 'ended')
      .order('end_time', { ascending: false })
      .limit(5);

    setLatestEnded(data || []);
  };

  // Top live auction by highest bid
  const fetchTopLiveAuction = async (sid) => {
    const { data } = await supabase
      .from('auctions')
      .select(`
        id,
        highest_bid,
        products ( title )
      `)
      .eq('seller_id', sid)
      .eq('status', 'live')
      .order('highest_bid', { ascending: false })
      .limit(1)
      .single();

    setTopAuction(data || null);
  };

  // Last 7 day labels
  const last7Days = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const labels = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      labels.push(days[d.getDay()]);
    }
    return labels;
  }, []);

  /* ================= Charts ================= */

  const bidsChartData = {
    labels: last7Days,
    datasets: [{
      label: "Bids Per Day",
      data: bidsPerDay,
      backgroundColor: "#4e73df",
      borderRadius: 6,
    }],
  };

  const revenueChartData = {
    labels: latestEnded.map(a => a.products?.title || '—'),
    datasets: [{
      label: "Revenue (PKR)",
      data: latestEnded.map(a => a.highest_bid || 0),
      borderColor: "#1cc88a",
      backgroundColor: "rgba(28,200,138,0.2)",
      fill: true,
      tension: 0.4,
      pointRadius: 4,
    }],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top",
        align: "center",
        labels: { boxWidth: 30, padding: 15 },
      },
    },
  };

  /* ================= Stat Cards ================= */

  const statsData = [
    {
      title: "Active Listings",
      value: loading ? "..." : activeListings,
      subtitle: "Currently live auctions",
    },
    {
      title: "Total Bids",
      value: loading ? "..." : totalBids.toLocaleString(),
      subtitle: "Across all auctions",
    },
    {
      title: "Total Revenue",
      value: loading ? "..." : `PKR ${totalRevenue.toLocaleString()}`,
      subtitle: "From released payouts",
    },
    {
      title: "Pending Payout",
      value: loading ? "..." : `PKR ${pendingPayout.toLocaleString()}`,
      subtitle: "Currently on hold",
    },
  ];

  return (
    <div className="seller-page">

      {/* Stat Cards */}
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

      {/* Top Live Auction */}
      {!loading && topAuction && (
        <div className="top-auction-card">
          <h3>🏆 Top Live Auction</h3>
          <p><strong>{topAuction.products?.title}</strong></p>
          <p>Highest Bid: PKR {topAuction.highest_bid?.toLocaleString() || 0}</p>
        </div>
      )}

      {/* Charts */}
      <div className="overview-grid">
        <div className="chart-box">
          <h3 className="admin-section-heading">Bids Per Day (Last 7 Days)</h3>
          <div className="chart-container">
            <Bar data={bidsChartData} options={chartOptions} />
          </div>
        </div>

        <div className="chart-box">
          <h3 className="admin-section-heading">Completed Auctions Revenue</h3>
          <div className="chart-container">
            <Line data={revenueChartData} options={chartOptions} />
          </div>
        </div>
      </div>

    </div>
  );
};

export default SellerHome;