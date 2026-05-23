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
  CategoryScale, LinearScale, BarElement,
  LineElement, PointElement, Title, Tooltip, Legend
);

const SellerHome = () => {
  const { user } = useAuthContext();

  const [loading, setLoading] = useState(true);
  const [activeListings, setActiveListings] = useState(0);
  const [totalBids, setTotalBids] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [pendingPayout, setPendingPayout] = useState(0);
  const [bidsPerDay, setBidsPerDay] = useState(Array(7).fill(0));
  const [latestEnded, setLatestEnded] = useState([]);
  const [topAuction, setTopAuction] = useState(null);

  useEffect(() => {
    if (!user) return;
    initSeller();
  }, [user]);

  const initSeller = async () => {
    try {
      setLoading(true);
      const { data: sellerData, error } = await supabase
        .from("sellers")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (error || !sellerData) {
        console.error("Seller not found:", error);
        return;
      }

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

  const fetchActiveListings = async (sid) => {
    const { count } = await supabase
      .from("auctions")
      .select("*", { count: "exact", head: true })
      .eq("seller_id", sid)
      .in("status", ["live", "paused"]);
    setActiveListings(count || 0);
  };

  const fetchTotalBids = async (sid) => {
    const { data: auctionData } = await supabase
      .from("auctions")
      .select("id")
      .eq("seller_id", sid);

    if (!auctionData?.length) { setTotalBids(0); return; }

    const auctionIds = auctionData.map(a => a.id);
    const { count } = await supabase
      .from("bids")
      .select("*", { count: "exact", head: true })
      .in("auction_id", auctionIds);
    setTotalBids(count || 0);
  };

  const fetchRevenue = async (sid) => {
    const { data } = await supabase
      .from("transactions")
      .select("seller_amount")
      .eq("seller_id", sid)
      .eq("status", "released");
    const total = data?.reduce((sum, t) => sum + (t.seller_amount || 0), 0) || 0;
    setTotalRevenue(total);
  };

  const fetchPendingPayout = async (sid) => {
    const { data } = await supabase
      .from("transactions")
      .select("seller_amount")
      .eq("seller_id", sid)
      .eq("status", "onhold");
    const total = data?.reduce((sum, t) => sum + (t.seller_amount || 0), 0) || 0;
    setPendingPayout(total);
  };

  const fetchBidsPerDay = async (sid) => {
    const { data: auctionData } = await supabase
      .from("auctions")
      .select("id")
      .eq("seller_id", sid);

    if (!auctionData?.length) return;

    const auctionIds = auctionData.map(a => a.id);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

    const { data: bidsData } = await supabase
      .from("bids")
      .select("bid_time")
      .in("auction_id", auctionIds)
      .gte("bid_time", sevenDaysAgo.toISOString());

    const daily = Array(7).fill(0);
    bidsData?.forEach(bid => {
      const bidDate = new Date(bid.bid_time);
      const today = new Date();
      const diffDays = Math.floor((today - bidDate) / (1000 * 60 * 60 * 24));
      if (diffDays >= 0 && diffDays < 7) daily[6 - diffDays]++;
    });
    setBidsPerDay(daily);
  };

  const fetchLatestEndedAuctions = async (sid) => {
    const { data } = await supabase
      .from("auctions")
      .select(`
        id, highest_bid, end_time,
        products ( title )
      `)
      .eq("seller_id", sid)
      .eq("status", "ended")
      .order("end_time", { ascending: false })
      .limit(5);
    setLatestEnded(data || []);
  };

  // Fixed: use maybeSingle() instead of single() to avoid error when no live auctions
  const fetchTopLiveAuction = async (sid) => {
    const { data, error } = await supabase
      .from("auctions")
      .select(`
        id, highest_bid,
        products ( title )
      `)
      .eq("seller_id", sid)
      .eq("status", "live")
      .gt("highest_bid", 0)           // only show if there are actual bids
      .order("highest_bid", { ascending: false })
      .limit(1);

    if (error) {
      console.error("Top auction fetch error:", error);
      setTopAuction(null);
      return;
    }

    // data is an array — pick first item or null
    setTopAuction(data?.[0] || null);
  };

  const last7Days = useMemo(() => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const labels = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      labels.push(days[d.getDay()]);
    }
    return labels;
  }, []);

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
    labels: latestEnded.map(a => a.products?.title || "—"),
    datasets: [{
      label: "Final Bid (PKR)",
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
        position: "top", align: "center",
        labels: { boxWidth: 30, padding: 15 },
      },
    },
  };

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

      <div className="stats-grid">
        {statsData.map((item, index) => (
          <StatCard key={index} title={item.title} value={item.value} subtitle={item.subtitle} />
        ))}
      </div>

      {/* Top Live Auction — only shows when a live auction has bids */}
      {!loading && topAuction && (
        <div className="top-auction-card">
          <h3>🏆 Top Live Auction</h3>
          <p className="top-auction-title">{topAuction.products?.title}</p>
          <p className="top-auction-bid">
            Current Highest Bid:{" "}
            <strong>PKR {topAuction.highest_bid?.toLocaleString()}</strong>
          </p>
        </div>
      )}

      <div className="overview-grid">
        <div className="chart-box">
          <h3 className="admin-section-heading">Bids Per Day (Last 7 Days)</h3>
          <div className="chart-container">
            <Bar data={bidsChartData} options={chartOptions} />
          </div>
        </div>

        <div className="chart-box">
          <h3 className="admin-section-heading">Completed Auctions — Final Bids</h3>
          <div className="chart-container">
            <Line data={revenueChartData} options={chartOptions} />
          </div>
        </div>
      </div>

    </div>
  );
};

export default SellerHome;