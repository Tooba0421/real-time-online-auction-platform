import { useMemo, useEffect, useState } from "react";
import { Bar, Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

import StatCard from "../../common/components/StatCard";
import { supabase } from "../../supabase/supabase";
import "../styles/home.css";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

const Home = () => {

  const [loading, setLoading] = useState(true);

  // ── Stat Numbers ──
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalSellers, setTotalSellers] = useState(0);
  const [pendingRequests, setPendingRequests] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [completedAuctions, setCompletedAuctions] = useState(0);
  const [totalBids, setTotalBids] = useState(0);
  const [totalAuctions, setTotalAuctions] = useState(0);

  // ── Chart Data ──
  const [monthlyBids, setMonthlyBids] = useState(Array(12).fill(0));
  const [monthlyAuctions, setMonthlyAuctions] = useState(Array(12).fill(0));
  const [categoryData, setCategoryData] = useState([]);

  useEffect(() => {
    fetchAllStats();
  }, []);

  const fetchAllStats = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchUsers(),
        fetchSellers(),
        fetchPendingRequests(),
        fetchRevenue(),
        fetchAuctions(),
        fetchBids(),
        fetchMonthlyBids(),
        fetchMonthlyAuctions(),
        fetchCategoryData(),
      ]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Total registered users
  const fetchUsers = async () => {
    const { count } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });
    setTotalUsers(count || 0);
  };

  // Total approved sellers
  const fetchSellers = async () => {
    const { count } = await supabase
      .from('sellers')
      .select('*', { count: 'exact', head: true })
      .eq('is_verified', 'approved');
    setTotalSellers(count || 0);
  };

  // Pending requests (sellers + buyers + products pending)
  const fetchPendingRequests = async () => {
    const [sellers, buyers, products, auctions] = await Promise.all([
      supabase.from('sellers').select('*', { count: 'exact', head: true }).eq('is_verified', 'pending'),
      supabase.from('buyers').select('*', { count: 'exact', head: true }).eq('is_verified', 'pending'),
      supabase.from('products').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('auctions').select('*', { count: 'exact', head: true }).eq('approval_status', 'pending'),
    ]);

    const total =
      (sellers.count || 0) +
      (buyers.count || 0) +
      (products.count || 0) +
      (auctions.count || 0);

    setPendingRequests(total);
  };

  // Total revenue from completed payments
  const fetchRevenue = async () => {
    const { data } = await supabase
      .from('payments')
      .select('total_amount')
      .eq('status', 'paid');

    const total = data?.reduce((sum, p) => sum + (p.total_amount || 0), 0) || 0;
    setTotalRevenue(total);
  };

  // Total and completed auctions
  const fetchAuctions = async () => {
    const { count: total } = await supabase
      .from('auctions')
      .select('*', { count: 'exact', head: true });

    const { count: completed } = await supabase
      .from('auctions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'ended');

    setTotalAuctions(total || 0);
    setCompletedAuctions(completed || 0);
  };

  // Total bids
  const fetchBids = async () => {
    const { count } = await supabase
      .from('bids')
      .select('*', { count: 'exact', head: true });
    setTotalBids(count || 0);
  };

  // Monthly bids for chart
  const fetchMonthlyBids = async () => {
    const currentYear = new Date().getFullYear();

    const { data } = await supabase
      .from('bids')
      .select('bid_time')
      .gte('bid_time', `${currentYear}-01-01`)
      .lte('bid_time', `${currentYear}-12-31`);

    const monthly = Array(12).fill(0);
    data?.forEach((bid) => {
      const month = new Date(bid.bid_time).getMonth();
      monthly[month]++;
    });

    setMonthlyBids(monthly);
  };

  // Monthly auctions for chart
  const fetchMonthlyAuctions = async () => {
    const currentYear = new Date().getFullYear();

    const { data } = await supabase
      .from('auctions')
      .select('created_at')
      .gte('created_at', `${currentYear}-01-01`)
      .lte('created_at', `${currentYear}-12-31`);

    const monthly = Array(12).fill(0);
    data?.forEach((auction) => {
      const month = new Date(auction.created_at).getMonth();
      monthly[month]++;
    });

    setMonthlyAuctions(monthly);
  };

  // Category distribution for doughnut chart
  const fetchCategoryData = async () => {
    const { data } = await supabase
      .from('products')
      .select('category');

    const categoryCounts = {};
    data?.forEach((product) => {
      const cat = product.category;
      if (cat) {
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
      }
    });

    setCategoryData(categoryCounts);
  };

  /* ================= CHART DATA ================= */

  const monthlyBidData = useMemo(() => ({
    labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    datasets: [
      {
        label: "Bids Placed",
        data: monthlyBids,
        backgroundColor: "#4e73df",
      },
      {
        label: "New Auctions",
        data: monthlyAuctions,
        backgroundColor: "#1cc88a",
      },
    ],
  }), [monthlyBids, monthlyAuctions]);

  const categories = [
    "Electronics", "Antiques", "Artwork", "Furniture", "Jewelry",
    "Interiors", "Music,Movies & Cameras", "Coins & Stamps",
    "Fashion", "Toys & Models", "Luxury Watches"
  ];

  const auctionCategoryData = useMemo(() => ({
    labels: categories,
    datasets: [
      {
        data: categories.map((cat) => categoryData[cat] || 0),
        backgroundColor: [
          "#4e73df", "#1cc88a", "#36b9cc", "#f6c23e", "#e74a3b",
          "#19686d", "#1cc825", "#cc36b1", "#d6cef7", "#13492b", "#e18d06",
        ],
      },
    ],
  }), [categoryData]);

  /* ================= CHART OPTIONS ================= */

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "0%",
    plugins: {
      legend: {
        position: "top",
        align: "center",
        labels: { boxWidth: 30, padding: 18 },
      },
    },
  };

  const lineOptions = {
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

  /* ================= DERIVED VALUES ================= */

  const mostPopularCategoryIndex = auctionCategoryData.datasets[0].data.indexOf(
    Math.max(...auctionCategoryData.datasets[0].data)
  );
  const mostPopularCategory = auctionCategoryData.labels[mostPopularCategoryIndex];

  const auctionSuccessRate = totalAuctions > 0
    ? ((completedAuctions / totalAuctions) * 100).toFixed(1)
    : 0;

  /* ================= STAT CARDS ================= */

  const statsData = [
    {
      title: "Total Registered Users",
      value: loading ? "..." : totalUsers.toLocaleString(),
      subtitle: "All platform users",
    },
    {
      title: "Total Sellers",
      value: loading ? "..." : totalSellers.toLocaleString(),
      subtitle: "Verified sellers",
    },
    {
      title: "Total Auctions",
      value: loading ? "..." : totalAuctions.toLocaleString(),
      subtitle: "Created this year",
    },
    {
      title: "Completed Auctions",
      value: loading ? "..." : completedAuctions.toLocaleString(),
      subtitle: "Successfully closed",
    },
    {
      title: "Total Bids Placed",
      value: loading ? "..." : totalBids.toLocaleString(),
      subtitle: "Yearly bidding activity",
    },
    {
      title: "Auction Success Rate",
      value: loading ? "..." : `${auctionSuccessRate}%`,
      subtitle: "Completed vs total auctions",
    },
    {
      title: "Total Revenue",
      value: loading ? "..." : `PKR ${totalRevenue.toLocaleString()}`,
      subtitle: "Platform earnings",
    },
    {
      title: "Pending Requests",
      value: loading ? "..." : pendingRequests.toLocaleString(),
      subtitle: "Awaiting approval",
    },
  ];

  return (
    <div className="admin-page">

      {/* ================= STAT CARDS ================= */}
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

      {/* ================= CHARTS ================= */}
      <div className="overview-grid">
        <div className="chart-box">
          <h3 className="admin-section-heading">Monthly Bidding Activity</h3>
          <div className="chart-container">
            <Bar data={monthlyBidData} options={lineOptions} />
          </div>
        </div>

        <div className="chart-box">
          <h3 className="admin-section-heading">Auction Categories</h3>
          <div className="chart-container">
            <Doughnut data={auctionCategoryData} options={doughnutOptions} />
          </div>
        </div>
      </div>

    </div>
  );
};

export default Home;