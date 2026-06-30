import {
  createContext, useContext, useState, useEffect,
  useRef, useCallback,
} from "react";
import { supabase } from "../supabase/supabase";
import toast from "react-hot-toast";

const AdminContext = createContext(null);

export const AdminProvider = ({ children }) => {

  // ── Users ─────────────────────────────────────────────────────────
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);

  // ── Sellers ───────────────────────────────────────────────────────
  const [sellers, setSellers] = useState({ pending: [], approved: [], rejected: [] });
  const [sellersLoading, setSellersLoading] = useState(true);
  const [pendingSellerEdits, setPendingSellerEdits] = useState([]);
  const [sellerEditsLoading, setSellerEditsLoading] = useState(true);

  // ── Bidders ───────────────────────────────────────────────────────
  const [pendingSubmissions, setPendingSubmissions] = useState([]);
  const [rejectedSubmissions, setRejectedSubmissions] = useState([]);
  const [approvedBuyers, setApprovedBuyers] = useState([]);
  const [biddersLoading, setBiddersLoading] = useState(true);
  const [pendingBuyerEdits, setPendingBuyerEdits] = useState([]);
  const [buyerEditsLoading, setBuyerEditsLoading] = useState(true);

  // ── Products ──────────────────────────────────────────────────────
  const [pendingProducts, setPendingProducts] = useState([]);
  const [approvedProducts, setApprovedProducts] = useState([]);
  const [rejectedProducts, setRejectedProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);

  // ── Auctions + Bids ───────────────────────────────────────────────
  const [activeAuctions, setActiveAuctions] = useState([]);
  const [suspiciousBids, setSuspiciousBids] = useState([]);
  const [auctionsLoading, setAuctionsLoading] = useState(true);

  // ── Orders ────────────────────────────────────────────────────────
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);

  // ── Revenue ───────────────────────────────────────────────────────
  const [pendingTransactions, setPendingTransactions] = useState([]);
  const [releasedTransactions, setReleasedTransactions] = useState([]);
  const [payments, setPayments] = useState([]);
  const [revenueLoading, setRevenueLoading] = useState(true);

  // ── Home stats ────────────────────────────────────────────────────
  const [homeStats, setHomeStats] = useState({
    totalUsers: 0, totalSellers: 0, pendingRequests: 0,
    totalRevenue: 0, completedAuctions: 0, totalBids: 0, totalAuctions: 0,
    monthlyBids: Array(12).fill(0), monthlyAuctions: Array(12).fill(0),
    categoryData: {},
  });
  const [homeLoading, setHomeLoading] = useState(true);
  const [homeStatsError, setHomeStatsError] = useState(false);

  const channelsRef = useRef([]);
  const homeStatsTimeoutRef = useRef(null);

  // ─────────────────────────────────────────────────────────────────
  // FETCH FUNCTIONS
  // ─────────────────────────────────────────────────────────────────

  const fetchUsers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("join_date", { ascending: false })
      if (!error) setUsers(data || []);
    } catch (err) {
      console.error("fetchUsers error:", err);
    } finally {
      setUsersLoading(false);
    }
  }, []);

  const fetchSellers = useCallback(async () => {
    setSellersLoading(true);
    try {
      const { data, error } = await supabase
        .from("sellers")
        .select(`*, profiles ( id, name, role, status, email )`)
        .order("created_at", { ascending: false })

      if (error) {
        console.error("fetchSellers error:", error);
        setSellersLoading(false);
        return;
      }

      const rows = data || [];

      // Fetch rejection/suspension reasons from admin_actions
      const rejectedSellerIds = rows
        .filter(s => s.is_verified === "rejected" || s.is_verified === "suspended")
        .map(s => s.id);

      let reasonMap = {};
      if (rejectedSellerIds.length > 0) {
        const { data: actions } = await supabase
          .from("admin_actions")
          .select("target_id, remarks")
          .in("target_id", rejectedSellerIds)
          .in("action_type", ["reject", "suspend"])
          .eq("target_table", "sellers")
          .order("action_date", { ascending: false })

        // Keep only the most recent action per seller
        actions?.forEach(a => {
          if (!reasonMap[a.target_id]) reasonMap[a.target_id] = a.remarks;
        });
      }

      const bucket = (arr) => {
        const p = [], a = [], r = [];
        arr.forEach((s) => {
          if (s.is_verified === "pending") p.push(s);
          else if (s.is_verified === "approved") a.push(s);
          else if (["rejected", "suspended"].includes(s.is_verified)) r.push(s);
        });
        return { pending: p, approved: a, rejected: r };
      };

      // Show basic data immediately
      const skeleton = rows.map((s) => ({
        ...s,
        name: s.profiles?.name || "—",
        email: s.profiles?.email || "—",
        listings: 0,
        successRate: "—",
        earnings: "PKR 0",
        // FIX: field is 'reason' to match SellerManagement.jsx display
        reason: reasonMap[s.id] || null,
      }));
      setSellers(bucket(skeleton));
      setSellersLoading(false);

      // Enrich with stats in background
      const sellerIds = rows.map((s) => s.id);
      if (!sellerIds.length) return;

      const [auctionsRes, txRes] = await Promise.all([
        supabase
          .from("auctions")
          .select("seller_id, status, winner_id")
          .in("seller_id", sellerIds),

        supabase
          .from("transactions")
          .select("seller_id, seller_amount")
          .in("seller_id", sellerIds)
          .eq("status", "released"),
      ]);

      const listingMap = {};
      const endedMap = {};
      const successfulMap = {};
      const earningsMap = {};

      auctionsRes.data?.forEach((auction) => {
        const sellerId = auction.seller_id;

        listingMap[sellerId] =
          (listingMap[sellerId] || 0) + 1;

        if (auction.status === "ended") {
          endedMap[sellerId] =
            (endedMap[sellerId] || 0) + 1;

          // Auction had a winner
          if (auction.winner_id) {
            successfulMap[sellerId] =
              (successfulMap[sellerId] || 0) + 1;
          }
        }
      });

      txRes.data?.forEach((t) => {
        earningsMap[t.seller_id] =
          (earningsMap[t.seller_id] || 0) +
          (t.seller_amount || 0);
      });

      const enriched = rows.map((s) => {
        const totalEnded = endedMap[s.id] || 0;
        const successfulAuctions = successfulMap[s.id] || 0;
        return {
          ...s,
          name: s.profiles?.name || "—",
          email: s.profiles?.email || "—",
          listings: listingMap[s.id] || 0,
          successRate:
            totalEnded > 0
              ? `${(
                (successfulAuctions / totalEnded) *
                100
              ).toFixed(1)}%`
              : "0%",
          earnings: `PKR ${(earningsMap[s.id] || 0).toLocaleString()}`,
          reason: reasonMap[s.id] || null,
        };
      });
      setSellers(bucket(enriched));
    } catch (err) {
      console.error("fetchSellers unexpected error:", err);
      setSellersLoading(false);
    }
  }, []);

  const fetchSellerEdits = useCallback(async () => {
    setSellerEditsLoading(true);
    try {
      const { data, error } = await supabase
        .from("pending_changes")
        .select("*")
        .eq("role", "seller")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (!error) {
        const rows = data || [];

        const userIds = [...new Set(rows.map(d => d.user_id))];

        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, name, email, role")
          .in("id", userIds);
        if (profilesError) {
          console.error(
            "Profiles fetch failed:",
            profilesError
          );
        }

        const profileMap = {};
        profiles?.forEach(p => {
          profileMap[p.id] = p;
        });

        setPendingSellerEdits(
          (data || []).map(edit => ({
            ...edit,
            userName: profileMap[edit.user_id]?.name || "—",
            userEmail: profileMap[edit.user_id]?.email || "—",
          }))
        );
      }
    } catch (err) {
      console.error("fetchSellerEdits error:", err);
    } finally {
      setSellerEditsLoading(false);
    }
  }, []);

  const fetchBidders = useCallback(async () => {
    setBiddersLoading(true);
    try {
      const [pendingRes, rejectedRes, buyerRes] = await Promise.all([
        supabase.from("pending_cnic_submissions").select(`*, profiles ( id, name, email, role, status )`).eq("status", "pending").order("created_at", { ascending: false }),
        supabase.from("pending_cnic_submissions").select(`*, profiles ( id, name, email, role, status )`).eq("status", "rejected").order("created_at", { ascending: false }),
        supabase.from("buyers").select(`*, profiles ( id, name, email, role, status )`).eq("is_verified", "approved").order("created_at", { ascending: false }),
      ]);

      setPendingSubmissions((pendingRes.data || []).map((s) => ({
        ...s,
        name: s.profiles?.name || "—",
        email: s.email || s.profiles?.email || "—",
        submissionId: s.id,
      })));
      const rejectedRows = rejectedRes.data || [];

      // Fetch rejection reasons for rejected submissions
      let bidderReasonMap = {};
      const rejectedSubIds = rejectedRows.map((s) => s.id).filter(Boolean);
      if (rejectedSubIds.length > 0) {
        const { data: rejectActions } = await supabase
          .from("admin_actions")
          .select("target_id, remarks")
          .in("target_id", rejectedSubIds)
          .eq("action_type", "reject")
          .eq("target_table", "pending_cnic_submissions")
          .order("action_date", { ascending: false });
        rejectActions?.forEach((a) => {
          if (!bidderReasonMap[a.target_id]) bidderReasonMap[a.target_id] = a.remarks;
        });
      }

      setRejectedSubmissions(rejectedRows.map((s) => ({
        ...s,
        name: s.profiles?.name || "—",
        email: s.email || s.profiles?.email || "—",
        submissionId: s.id,
        reason: bidderReasonMap[s.id] || null,  
      })));

      const buyerRows = buyerRes.data || [];
      setApprovedBuyers(buyerRows.map((b) => ({
        ...b,
        name: b.profiles?.name || "—",
        email: b.profiles?.email || "—",
        totalBids: 0,
        auctionsWon: 0,
      })));
      setBiddersLoading(false);

      // Enrich bid/win counts in background
      const buyerIds = buyerRows.map((b) => b.id);
      if (!buyerIds.length) return;

      const [bidsRes, winsRes] = await Promise.all([
        supabase.from("bids").select("bidder_id").in("bidder_id", buyerIds),
        supabase.from("auctions").select("winner_id").in("winner_id", buyerIds),
      ]);

      const bidCountMap = {}, winCountMap = {};
      bidsRes.data?.forEach((b) => { bidCountMap[b.bidder_id] = (bidCountMap[b.bidder_id] || 0) + 1; });
      winsRes.data?.forEach((a) => { winCountMap[a.winner_id] = (winCountMap[a.winner_id] || 0) + 1; });

      setApprovedBuyers(buyerRows.map((b) => ({
        ...b,
        name: b.profiles?.name || "—",
        email: b.profiles?.email || "—",
        totalBids: bidCountMap[b.id] || 0,
        auctionsWon: winCountMap[b.id] || 0,
      })));
    } catch (err) {
      console.error("fetchBidders error:", err);
      setBiddersLoading(false);
    }
  }, []);

  const fetchBuyerEdits = useCallback(async () => {
    setBuyerEditsLoading(true);
    try {
      const { data, error } = await supabase
        .from("pending_changes")
        .select("*")
        .eq("role", "buyer")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (!error) {
        const rows = data || [];

        const userIds = [...new Set(rows.map(d => d.user_id))];

        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, name, email, role")
          .in("id", userIds);

        if (profilesError) {
          console.error(
            "Profiles fetch failed:",
            profilesError
          );
        }

        const profileMap = {};
        profiles?.forEach(p => {
          profileMap[p.id] = p;
        });

        setPendingBuyerEdits(
          (data || []).map(edit => ({
            ...edit,
            userName: profileMap[edit.user_id]?.name || "—",
            userEmail: profileMap[edit.user_id]?.email || "—",
          }))
        );
      }
    } catch (err) {
      console.error("fetchBuyerEdits error:", err);
    } finally {
      setBuyerEditsLoading(false);
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    setProductsLoading(true);
    try {
      const { data, error } = await supabase
        .from("products")
        .select(`*, product_images ( image_url, is_primary ), sellers ( id, business_name, user_id, profiles ( name ) )`)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("fetchProducts error:", error);
        setProductsLoading(false);
        return;
      }

      // Fetch rejection reasons from admin_actions
      const rejectedProductIds = (data || [])
        .filter(p => p.status === "rejected")
        .map(p => p.id);

      let reasonMap = {};
      if (rejectedProductIds.length > 0) {
        const { data: actions } = await supabase
          .from("admin_actions")
          .select("target_id, remarks")
          .in("target_id", rejectedProductIds)
          .eq("action_type", "reject")
          .eq("target_table", "products")
          .order("action_date", { ascending: false })

        actions?.forEach(a => {
          if (!reasonMap[a.target_id]) reasonMap[a.target_id] = a.remarks;
        });
      }

      const pending = [], approved = [], rejected = [];
      for (const product of data || []) {
        const primaryImage = product.product_images?.find((img) => img.is_primary) || product.product_images?.[0];
        const enriched = {
          ...product,
          sellerName: product.sellers?.profiles?.name || "—",
          businessName: product.sellers?.business_name || "—",
          sellerId: product.sellers?.user_id,
          primaryImage: primaryImage?.image_url || null,
          allImages: product.product_images || [],
          // FIX: field is 'reason' to match ProductManagement.jsx display
          reason: reasonMap[product.id] || null,
        };
        if (product.status === "pending") pending.push(enriched);
        else if (product.status === "active") approved.push(enriched);
        else if (product.status === "rejected") rejected.push(enriched);
      }
      setPendingProducts(pending);
      setApprovedProducts(approved);
      setRejectedProducts(rejected);
    } catch (err) {
      console.error("fetchProducts error:", err);
    } finally {
      setProductsLoading(false);
    }
  }, []);

  const fetchAuctions = useCallback(async () => {
    setAuctionsLoading(true);
    try {
      const [auctionsRes, bidsRes] = await Promise.all([
        supabase.from("auctions")
          .select(`*, products ( title, reserved_price ), sellers ( id, user_id, business_name, profiles ( id, name ) )`)
          .in("status", ["live", "scheduled", "paused"])
          .order("created_at", { ascending: false }),
        supabase.from("bids")
          .select(`*, auctions ( id, products ( title ) ), buyers ( id, profiles ( name ) )`)
          .eq("is_suspicious", true).eq("status", "active")
          .order("bid_time", { ascending: false }),
      ]);
      if (!auctionsRes.error) setActiveAuctions(auctionsRes.data || []);
      if (!bidsRes.error) setSuspiciousBids(bidsRes.data || []);
    } catch (err) {
      console.error("fetchAuctions error:", err);
    } finally {
      setAuctionsLoading(false);
    }
  }, []);

  const fetchOrders = useCallback(async () => {
    setOrdersLoading(true);
    try {
      const { data, error } = await supabase
        .from("orders")
        .select(`
          *,
          auctions ( id, products ( title ) ),
          buyers ( id, profiles ( name ) ),
          sellers ( id, business_name, user_id, profiles ( id, name ) ),
          payments ( id, status, total_amount, payment_date, hold_status ),
          deliveries ( id, status, tracking_no, courier_service, delivery_date )
        `)
        .order("order_date", { ascending: false });
      if (!error) {
        setOrders((data || []).map((o) => ({
          ...o,
          // ✅ Normalize both deliveries AND payments — Supabase returns
          // one-to-many joins as arrays even when only one row exists
          deliveries: Array.isArray(o.deliveries) ? (o.deliveries[0] || null) : o.deliveries,
          payments: Array.isArray(o.payments) ? (o.payments[0] || null) : o.payments,
        })));
      }
    } catch (err) {
      console.error("fetchOrders error:", err);
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  // FIX: fetchRevenue — correct filtering logic
  // pending = transaction.status='onhold' AND payment.hold_status=true
  // released = transaction.status='released'
  const fetchRevenue = useCallback(async () => {
    setRevenueLoading(true);
    try {
      const { data: txData, error: txError } = await supabase
        .from("transactions")
        .select(`
          *,
          payments (
            id,
            status,
            hold_status,
            payment_date,
            total_amount,
            platform_fee,
            orders (
              id,
              buyers ( profiles ( name ) ),
              auctions ( products ( title ) )
            )
          ),
          sellers (
            id,
            business_name,
            user_id,
            profiles ( name )
          )
        `)
        .order("hold_until", { ascending: false })

      if (txError) {
        console.error("fetchRevenue transactions error:", txError);
        toast.error("Failed to load revenue data");
        return;
      }
      console.log(txData);
      console.log(txError);

      const allTransactions = txData || [];

      // FIX: Correct filter — onhold means payment has hold_status=true
      // A transaction can only be pending if its payment is still on hold
      setPendingTransactions(
        allTransactions.filter(
          t =>
            t.status?.toLowerCase() === "onhold" &&
            t.payments?.hold_status === true
        )
      );
      setReleasedTransactions(
        allTransactions.filter(
          t =>
            t.status?.toLowerCase() === "released"
        )
      );

      // Separate payments query for revenue charts
      const { data: payData, error: payError } = await supabase
        .from("payments")
        .select("total_amount, payment_date, platform_fee, hold_status")
        .eq("status", "paid")
        .order("payment_date", { ascending: true });

      if (!payError) setPayments(payData || []);

    } catch (err) {
      console.error("fetchRevenue error:", err);
      toast.error("Failed to load revenue data");
    } finally {
      setRevenueLoading(false);
    }
  }, []);

  const fetchHomeStats = useCallback(async () => {
    setHomeLoading(true);
    setHomeStatsError(false);
    const currentYear = new Date().getFullYear();

    try {
      const [
        usersRes, sellersRes,
        pendingSellersRes, pendingBuyersRes, pendingProductsRes, pendingAuctionsRes,
        revenueRes, totalAuctionsRes, completedAuctionsRes, bidsRes,
        monthlyBidsRes, monthlyAuctionsRes, categoryRes,
      ] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("sellers").select("*", { count: "exact", head: true }).eq("is_verified", "approved"),
        supabase.from("sellers").select("*", { count: "exact", head: true }).eq("is_verified", "pending"),
        supabase.from("pending_cnic_submissions").select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("products").select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("auctions").select("*", { count: "exact", head: true }).eq("approval_status", "pending"),
        supabase.from("payments").select("total_amount").eq("status", "paid"),
        supabase.from("auctions").select("*", { count: "exact", head: true }),
        supabase.from("auctions").select("*", { count: "exact", head: true }).eq("status", "ended"),
        supabase.from("bids").select("*", { count: "exact", head: true }),
        supabase.from("bids").select("bid_time").gte("bid_time", `${currentYear}-01-01`).lte("bid_time", `${currentYear}-12-31`),
        supabase.from("auctions").select("created_at").gte("created_at", `${currentYear}-01-01`).lte("created_at", `${currentYear}-12-31`),
        supabase.from("products").select("category"),
      ]);

      const bidsByMonth = Array(12).fill(0);
      monthlyBidsRes.data?.forEach((b) => { bidsByMonth[new Date(b.bid_time).getMonth()]++; });

      const auctionsByMonth = Array(12).fill(0);
      monthlyAuctionsRes.data?.forEach((a) => { auctionsByMonth[new Date(a.created_at).getMonth()]++; });

      const catCounts = {};
      categoryRes.data?.forEach((p) => {
        if (p.category) catCounts[p.category] = (catCounts[p.category] || 0) + 1;
      });

      setHomeStats({
        totalUsers: usersRes.count || 0,
        totalSellers: sellersRes.count || 0,
        pendingRequests:
          (pendingSellersRes.count || 0) + (pendingBuyersRes.count || 0) +
          (pendingProductsRes.count || 0) + (pendingAuctionsRes.count || 0),
        totalRevenue: revenueRes.data?.reduce((s, p) => s + (p.total_amount || 0), 0) || 0,
        totalAuctions: totalAuctionsRes.count || 0,
        completedAuctions: completedAuctionsRes.count || 0,
        totalBids: bidsRes.count || 0,
        monthlyBids: bidsByMonth,
        monthlyAuctions: auctionsByMonth,
        categoryData: catCounts,
      });
    } catch (err) {
      console.error("fetchHomeStats error:", err);
      setHomeStatsError(true);
    } finally {
      setHomeLoading(false);
    }
  }, []);

  // ─────────────────────────────────────────────────────────────────
  // OPTIMISTIC / LOCAL UPDATE HELPERS
  // ─────────────────────────────────────────────────────────────────

  const updateUserLocally = useCallback((userId, fields) => {
    setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, ...fields } : u));
  }, []);

  const updateTransactionLocally = useCallback((txId, fields) => {
    setPendingTransactions((prev) => {
      const txToMove = prev.find((t) => t.id === txId);
      if (txToMove) setReleasedTransactions((rel) => [{ ...txToMove, ...fields }, ...rel]);
      return prev.filter((t) => t.id !== txId);
    });
  }, []);

  const removeSuspiciousBid = useCallback((bidId) => {
    setSuspiciousBids((prev) => prev.filter((b) => b.id !== bidId));
  }, []);

  const updateAuctionLocally = useCallback((auctionId, fields) => {
    setActiveAuctions((prev) =>
      prev.map((a) => a.id === auctionId ? { ...a, ...fields } : a)
    );
  }, []);

  // Debounced home stats — waits 5s after last event before re-fetching
  const debouncedFetchHomeStats = useCallback(() => {
    if (homeStatsTimeoutRef.current) clearTimeout(homeStatsTimeoutRef.current);
    homeStatsTimeoutRef.current = setTimeout(() => fetchHomeStats(), 5000);
  }, [fetchHomeStats]);

  // ─────────────────────────────────────────────────────────────────
  // JOIN HELPERS for realtime callbacks
  // ─────────────────────────────────────────────────────────────────

  const fetchJoinedAuction = useCallback(async (auctionId) => {
    try {
      const { data, error } = await supabase
        .from("auctions")
        .select(`*, products ( title, reserved_price ), sellers ( id, user_id, business_name, profiles ( id, name ) )`)
        .eq("id", auctionId)
        .single();
      return error ? null : data;
    } catch { return null; }
  }, []);

  const fetchJoinedOrder = useCallback(async (orderId) => {
    try {
      const { data, error } = await supabase
        .from("orders")
        .select(`
          *,
          auctions ( id, products ( title ) ),
          buyers ( id, profiles ( name ) ),
          sellers ( id, business_name, user_id, profiles ( id, name ) ),
          payments ( id, status, total_amount, payment_date, hold_status ),
          deliveries ( id, status, tracking_no, courier_service, delivery_date )
        `)
        .eq("id", orderId)
        .single();
      return error ? null : {
        ...data,
        // ✅ Normalize both — same array issue applies here too
        deliveries: Array.isArray(data.deliveries) ? (data.deliveries[0] || null) : data.deliveries,
        payments: Array.isArray(data.payments) ? (data.payments[0] || null) : data.payments,
      };
    } catch { return null; }
  }, []);

  const fetchJoinedTransaction = useCallback(async (transactionId) => {
    try {
      const { data, error } = await supabase
        .from("transactions")
        .select(`
          *,
          payments (
            id, status, hold_status, payment_date, total_amount, platform_fee,
            orders ( id, buyers ( profiles ( name ) ), auctions ( products ( title ) ) )
          ),
          sellers ( id, business_name, user_id, profiles ( name ) )
        `)
        .eq("id", transactionId)
        .single();
      return error ? null : data;
    } catch { return null; }
  }, []);

  const fetchJoinedSuspiciousBid = useCallback(async (bidId) => {
    try {
      const { data, error } = await supabase
        .from("bids")
        .select(`*, auctions ( id, products ( title ) ), buyers ( id, profiles ( name ) )`)
        .eq("id", bidId)
        .single();
      return error ? null : data;
    } catch { return null; }
  }, []);

  // ─────────────────────────────────────────────────────────────────
  // REALTIME SUBSCRIPTIONS
  // ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    // Initial parallel fetch
    Promise.all([
      fetchUsers(), fetchSellers(), fetchSellerEdits(),
      fetchBidders(), fetchBuyerEdits(), fetchProducts(),
      fetchAuctions(), fetchOrders(), fetchRevenue(), fetchHomeStats(),
    ]);

    const subscriptions = [];

    // Channel 1: profiles
    subscriptions.push(
      supabase.channel("admin-ctx-profiles")
        .on("postgres_changes", { event: "*", schema: "public", table: "profiles" },
          () => { fetchUsers(); debouncedFetchHomeStats(); })
        .subscribe()
    );

    // Channel 2: sellers
    subscriptions.push(
      supabase.channel("admin-ctx-sellers")
        .on("postgres_changes", { event: "*", schema: "public", table: "sellers" },
          () => { fetchSellers(); debouncedFetchHomeStats(); })
        .subscribe()
    );

    // Channel 3: pending_changes
    subscriptions.push(
      supabase.channel("admin-ctx-pending-changes")
        .on("postgres_changes", { event: "*", schema: "public", table: "pending_changes" },
          () => { fetchSellerEdits(); fetchBuyerEdits(); })
        .subscribe()
    );

    // Channel 4: pending_cnic_submissions
    subscriptions.push(
      supabase.channel("admin-ctx-cnic-submissions")
        .on("postgres_changes", { event: "*", schema: "public", table: "pending_cnic_submissions" },
          () => { fetchBidders(); debouncedFetchHomeStats(); })
        .subscribe()
    );

    // Channel 5: buyers
    subscriptions.push(
      supabase.channel("admin-ctx-buyers")
        .on("postgres_changes", { event: "*", schema: "public", table: "buyers" },
          () => { fetchBidders(); debouncedFetchHomeStats(); })
        .subscribe()
    );

    // Channel 6: products
    subscriptions.push(
      supabase.channel("admin-ctx-products")
        .on("postgres_changes", { event: "*", schema: "public", table: "products" },
          () => { fetchProducts(); debouncedFetchHomeStats(); })
        .subscribe()
    );

    // Channel 7: auctions — granular update preserving joined data
    subscriptions.push(
      supabase.channel("admin-ctx-auctions")
        .on("postgres_changes", { event: "*", schema: "public", table: "auctions" },
          async (payload) => {
            const { eventType, new: newRow, old } = payload;
            const activeStatuses = ["live", "scheduled", "paused"];

            if (eventType === "UPDATE") {
              if (!activeStatuses.includes(newRow?.status)) {
                setActiveAuctions((prev) => prev.filter((a) => a.id !== newRow.id));
              } else {
                const joinedAuction = await fetchJoinedAuction(newRow.id);
                if (joinedAuction) {
                  setActiveAuctions((prev) =>
                    prev.map((a) => a.id === newRow.id ? joinedAuction : a)
                  );
                } else {
                  // Fallback: merge scalar fields only
                  setActiveAuctions((prev) =>
                    prev.map((a) => a.id === newRow.id ? {
                      ...a,
                      status: newRow.status,
                      highest_bid: newRow.highest_bid,
                      highest_bidder_id: newRow.highest_bidder_id,
                      winner_id: newRow.winner_id,
                      end_time: newRow.end_time,
                      paused_by: newRow.paused_by,
                      min_increment: newRow.min_increment,
                      approval_status: newRow.approval_status,
                    } : a)
                  );
                }
              }
            } else if (eventType === "INSERT" && activeStatuses.includes(newRow?.status)) {
              const joinedAuction = await fetchJoinedAuction(newRow.id);
              if (joinedAuction) setActiveAuctions((prev) => [joinedAuction, ...prev]);
            } else if (eventType === "DELETE") {
              setActiveAuctions((prev) => prev.filter((a) => a.id !== old?.id));
            }

            debouncedFetchHomeStats();
          }
        )
        .subscribe()
    );

    // Channel 8: bids
    subscriptions.push(
      supabase.channel("admin-ctx-bids")
        .on("postgres_changes", { event: "*", schema: "public", table: "bids" },
          async (payload) => {
            const { eventType, new: newRow, old } = payload;

            if (eventType === "INSERT" && newRow?.is_suspicious && newRow?.status === "active") {
              const joinedBid = await fetchJoinedSuspiciousBid(newRow.id);
              if (joinedBid) setSuspiciousBids((prev) => [joinedBid, ...prev]);
            } else if (eventType === "UPDATE") {
              if (
                !newRow?.is_suspicious ||
                newRow?.status !== "active"
              ) {
                setSuspiciousBids((prev) =>
                  prev.filter((b) => b.id !== newRow.id)
                );
              } else {
                const joinedBid =
                  await fetchJoinedSuspiciousBid(newRow.id);

                if (joinedBid) {
                  setSuspiciousBids((prev) =>
                    prev.map((b) =>
                      b.id === joinedBid.id
                        ? joinedBid
                        : b
                    )
                  );
                }
              }
            } else if (eventType === "DELETE") {
              setSuspiciousBids((prev) => prev.filter((b) => b.id !== old?.id));
            }

            debouncedFetchHomeStats();
          }
        )
        .subscribe()
    );

    // Channel 9: orders
    subscriptions.push(
      supabase.channel("admin-ctx-orders")
        .on("postgres_changes", { event: "*", schema: "public", table: "orders" },
          async (payload) => {
            const { eventType, new: newRow, old } = payload;
            if (eventType === "INSERT" || eventType === "UPDATE") {
              const joinedOrder = await fetchJoinedOrder(newRow.id);
              if (joinedOrder) {
                if (eventType === "INSERT") setOrders((prev) => [joinedOrder, ...prev]);
                else setOrders((prev) => prev.map((o) => o.id === joinedOrder.id ? joinedOrder : o));
              }
            } else if (eventType === "DELETE") {
              setOrders((prev) => prev.filter((o) => o.id !== old?.id));
            }
            debouncedFetchHomeStats();
          }
        )
        .subscribe()
    );

    // Channel 10: deliveries — refresh parent order
    subscriptions.push(
      supabase.channel("admin-ctx-deliveries")
        .on("postgres_changes", { event: "*", schema: "public", table: "deliveries" },
          async (payload) => {
            const orderId = payload.new?.order_id || payload.old?.order_id;
            if (!orderId) return;
            const joinedOrder = await fetchJoinedOrder(orderId);
            if (joinedOrder) setOrders((prev) => prev.map((o) => o.id === joinedOrder.id ? joinedOrder : o));
            debouncedFetchHomeStats();
          }
        )
        .subscribe()
    );

    // Channel 11: transactions
    subscriptions.push(
      supabase.channel("admin-ctx-transactions")
        .on("postgres_changes", { event: "*", schema: "public", table: "transactions" },
          async (payload) => {
            const { eventType, new: newRow, old } = payload;
            if (eventType === "INSERT" || eventType === "UPDATE") {
              const joinedTx = await fetchJoinedTransaction(newRow.id);
              if (joinedTx) {
                if (joinedTx.status === "onhold" && joinedTx.payments?.hold_status === true) {
                  setPendingTransactions((prev) => {
                    const exists = prev.some((t) => t.id === joinedTx.id);
                    return exists
                      ? prev.map((t) => t.id === joinedTx.id ? joinedTx : t)
                      : [joinedTx, ...prev];
                  });
                  setReleasedTransactions((prev) => prev.filter((t) => t.id !== joinedTx.id));
                } else if (joinedTx.status === "released") {
                  setReleasedTransactions((prev) => {
                    const exists = prev.some((t) => t.id === joinedTx.id);
                    return exists
                      ? prev.map((t) => t.id === joinedTx.id ? joinedTx : t)
                      : [joinedTx, ...prev];
                  });
                  setPendingTransactions((prev) => prev.filter((t) => t.id !== joinedTx.id));
                }
              }
            } else if (eventType === "DELETE") {
              setPendingTransactions((prev) => prev.filter((t) => t.id !== old?.id));
              setReleasedTransactions((prev) => prev.filter((t) => t.id !== old?.id));
            }
            debouncedFetchHomeStats();
          }
        )
        .subscribe()
    );

    // Channel 12: payments — refresh revenue when any payment changes
    subscriptions.push(
      supabase.channel("admin-ctx-payments")
        .on("postgres_changes", { event: "*", schema: "public", table: "payments" },
          () => {
            fetchRevenue();
            fetchOrders();
            debouncedFetchHomeStats();
          })
        .subscribe()
    );

    channelsRef.current = subscriptions;

    return () => {
      if (homeStatsTimeoutRef.current) clearTimeout(homeStatsTimeoutRef.current);
      channelsRef.current.forEach((ch) => {
        try { supabase.removeChannel(ch); } catch (err) { console.error("removeChannel error:", err); }
      });
      channelsRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─────────────────────────────────────────────────────────────────
  // CONTEXT VALUE
  // ─────────────────────────────────────────────────────────────────

  return (
    <AdminContext.Provider value={{
      users, usersLoading,
      refetchUsers: fetchUsers,
      updateUserLocally,

      sellers, sellersLoading,
      pendingSellerEdits, sellerEditsLoading,
      refetchSellers: fetchSellers,
      refetchSellerEdits: fetchSellerEdits,

      pendingSubmissions, rejectedSubmissions, approvedBuyers,
      biddersLoading,
      pendingBuyerEdits, buyerEditsLoading,
      refetchBidders: fetchBidders,
      refetchBuyerEdits: fetchBuyerEdits,

      pendingProducts, approvedProducts, rejectedProducts,
      productsLoading,
      refetchProducts: fetchProducts,

      activeAuctions, suspiciousBids,
      auctionsLoading,
      refetchAuctions: fetchAuctions,
      updateAuctionLocally,
      removeSuspiciousBid,

      orders, ordersLoading,
      refetchOrders: fetchOrders,

      pendingTransactions, releasedTransactions, payments,
      revenueLoading,
      refetchRevenue: fetchRevenue,
      updateTransactionLocally,

      homeStats, homeLoading, homeStatsError,
      refetchHomeStats: fetchHomeStats,
    }}>
      {children}
    </AdminContext.Provider>
  );
};

export const useAdminContext = () => {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdminContext must be used within AdminProvider");
  return ctx;
};