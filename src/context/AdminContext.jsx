import {
  createContext, useContext, useState, useEffect,
  useRef, useCallback,
} from "react";
import { supabase } from "../supabase/supabase";

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

  const channelsRef = useRef([]);

  // ─────────────────────────────────────────────────────────────────
  // FETCH FUNCTIONS
  // Each function is lean: one primary query + minimal joins.
  // Expensive aggregations use Promise.all so parallel, not serial.
  // ─────────────────────────────────────────────────────────────────

  const fetchUsers = useCallback(async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("join_date", { ascending: false });
    if (!error) setUsers(data || []);
    setUsersLoading(false);
  }, []);

  // ── Sellers: fetch base data first, then enrich in background ────
  const fetchSellers = useCallback(async () => {
    setSellersLoading(true);

    const { data, error } = await supabase
      .from("sellers")
      .select(`*, profiles ( id, name, role, status, email )`)
      .order("created_at", { ascending: false });

    if (error) { setSellersLoading(false); return; }

    const rows = data || [];

    // Show basic data immediately while stats load in background
    const skeleton = rows.map((s) => ({
      ...s,
      name: s.profiles?.name || "—",
      email: s.profiles?.email || "—",
      listings: 0,
      successRate: "—",
      earnings: "PKR 0",
    }));
    const bucket = (arr) => {
      const p = [], a = [], r = [];
      arr.forEach((s) => {
        if (s.is_verified === "pending") p.push(s);
        else if (s.is_verified === "approved") a.push(s);
        else if (["rejected", "suspended"].includes(s.is_verified)) r.push(s);
      });
      return { pending: p, approved: a, rejected: r };
    };
    setSellers(bucket(skeleton));
    setSellersLoading(false); // ← unblock UI early

    // Now enrich with stats in background (no extra loading spinner)
    const sellerIds = rows.map((s) => s.id);
    if (!sellerIds.length) return;

    const [listingsRes, soldRes, txRes] = await Promise.all([
      supabase.from("auctions")
        .select("seller_id, status")
        .in("seller_id", sellerIds)
        .in("status", ["live", "ended", "scheduled"]),
      supabase.from("products")
        .select("seller_id")
        .in("seller_id", sellerIds)
        .eq("status", "sold"),
      supabase.from("transactions")
        .select("seller_id, seller_amount")
        .in("seller_id", sellerIds)
        .eq("status", "released"),
    ]);

    const listingMap = {}, endedMap = {}, soldMap = {}, earningsMap = {};
    listingsRes.data?.forEach((a) => {
      listingMap[a.seller_id] = (listingMap[a.seller_id] || 0) + 1;
      if (a.status === "ended") endedMap[a.seller_id] = (endedMap[a.seller_id] || 0) + 1;
    });
    soldRes.data?.forEach((p) => { soldMap[p.seller_id] = (soldMap[p.seller_id] || 0) + 1; });
    txRes.data?.forEach((t) => { earningsMap[t.seller_id] = (earningsMap[t.seller_id] || 0) + (t.seller_amount || 0); });

    const enriched = rows.map((s) => {
      const totalEnded = endedMap[s.id] || 0;
      const totalSold = soldMap[s.id] || 0;
      return {
        ...s,
        name: s.profiles?.name || "—",
        email: s.profiles?.email || "—",
        listings: listingMap[s.id] || 0,
        successRate: totalEnded > 0 ? `${((totalSold / totalEnded) * 100).toFixed(1)}%` : "0%",
        earnings: `PKR ${(earningsMap[s.id] || 0).toLocaleString()}`,
      };
    });
    setSellers(bucket(enriched));
  }, []);

  const fetchSellerEdits = useCallback(async () => {
    setSellerEditsLoading(true);
    const { data, error } = await supabase
      .from("pending_changes")
      .select(`*, profiles ( id, name, email, role )`)
      .eq("role", "seller")
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (!error) {
      setPendingSellerEdits(
        (data || []).map((e) => ({
          ...e,
          userName: e.profiles?.name || "—",
          userEmail: e.profiles?.email || "—",
        }))
      );
    }
    setSellerEditsLoading(false);
  }, []);

  // ── Bidders: same "show fast, enrich later" pattern ───────────────
  const fetchBidders = useCallback(async () => {
    setBiddersLoading(true);

    const [pendingRes, rejectedRes, buyerRes] = await Promise.all([
      supabase.from("pending_cnic_submissions")
        .select(`*, profiles ( id, name, email, role, status )`)
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
      supabase.from("pending_cnic_submissions")
        .select(`*, profiles ( id, name, email, role, status )`)
        .eq("status", "rejected")
        .order("created_at", { ascending: false }),
      supabase.from("buyers")
        .select(`*, profiles ( id, name, email, role, status )`)
        .eq("is_verified", "approved")
        .order("created_at", { ascending: false }),
    ]);

    setPendingSubmissions(
      (pendingRes.data || []).map((s) => ({
        ...s,
        name: s.profiles?.name || "—",
        email: s.email || s.profiles?.email || "—",
        submissionId: s.id,
      }))
    );
    setRejectedSubmissions(
      (rejectedRes.data || []).map((s) => ({
        ...s,
        name: s.profiles?.name || "—",
        email: s.email || s.profiles?.email || "—",
      }))
    );

    // Show buyers immediately without bid stats
    const buyerRows = buyerRes.data || [];
    setApprovedBuyers(
      buyerRows.map((b) => ({
        ...b,
        name: b.profiles?.name || "—",
        email: b.profiles?.email || "—",
        totalBids: 0,
        auctionsWon: 0,
      }))
    );
    setBiddersLoading(false); // ← unblock UI early

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

    setApprovedBuyers(
      buyerRows.map((b) => ({
        ...b,
        name: b.profiles?.name || "—",
        email: b.profiles?.email || "—",
        totalBids: bidCountMap[b.id] || 0,
        auctionsWon: winCountMap[b.id] || 0,
      }))
    );
  }, []);

  const fetchBuyerEdits = useCallback(async () => {
    setBuyerEditsLoading(true);
    const { data, error } = await supabase
      .from("pending_changes")
      .select(`*, profiles ( id, name, email, role )`)
      .eq("role", "buyer")
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (!error) {
      setPendingBuyerEdits(
        (data || []).map((e) => ({
          ...e,
          userName: e.profiles?.name || "—",
          userEmail: e.profiles?.email || "—",
        }))
      );
    }
    setBuyerEditsLoading(false);
  }, []);

  const fetchProducts = useCallback(async () => {
    setProductsLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select(`
        *,
        product_images ( image_url, is_primary ),
        sellers ( id, business_name, user_id, profiles ( name ) )
      `)
      .order("created_at", { ascending: false });

    if (error) { setProductsLoading(false); return; }

    const pending = [], approved = [], rejected = [];
    for (const product of data || []) {
      const primaryImage =
        product.product_images?.find((img) => img.is_primary) ||
        product.product_images?.[0];
      const enriched = {
        ...product,
        sellerName: product.sellers?.profiles?.name || "—",
        businessName: product.sellers?.business_name || "—",
        sellerId: product.sellers?.user_id,
        primaryImage: primaryImage?.image_url || null,
        allImages: product.product_images || [],
      };
      if (product.status === "pending") pending.push(enriched);
      else if (product.status === "active") approved.push(enriched);
      else if (product.status === "rejected") rejected.push(enriched);
    }
    setPendingProducts(pending);
    setApprovedProducts(approved);
    setRejectedProducts(rejected);
    setProductsLoading(false);
  }, []);

  const fetchAuctions = useCallback(async () => {
    setAuctionsLoading(true);
    const [auctionsRes, bidsRes] = await Promise.all([
      supabase.from("auctions")
        .select(`
        *,
        products ( title, reserved_price ),
        sellers ( id, user_id, business_name, profiles ( id, name ) )
      `)
        .in("status", ["live", "scheduled", "paused"])
        .order("created_at", { ascending: false }),
      supabase.from("bids")
        .select(`
        *,
        auctions ( id, products ( title ) ),
        buyers ( id, profiles ( name ) )
      `)
        .eq("is_suspicious", true)
        .eq("status", "active")
        .order("bid_time", { ascending: false }),
    ]);
    if (!auctionsRes.error) setActiveAuctions(auctionsRes.data || []);
    if (!bidsRes.error) setSuspiciousBids(bidsRes.data || []);
    setAuctionsLoading(false);
  }, []);

  const fetchOrders = useCallback(async () => {
    setOrdersLoading(true);
    const { data, error } = await supabase
      .from("orders")
      .select(`
        *,
        auctions ( id, products ( title ) ),
        buyers ( id, profiles ( name ) ),
        sellers ( id, business_name, profiles ( name ) ),
        payments ( status, total_amount, payment_date ),
        deliveries ( status, tracking_no, courier_service, delivery_date )
      `)
      .order("created_at", { ascending: false });
    if (!error) setOrders(data || []);
    setOrdersLoading(false);
  }, []);

  const fetchRevenue = useCallback(async () => {
    setRevenueLoading(true);
    const [txRes, payRes] = await Promise.all([
      supabase.from("transactions")
        .select(`
          *,
          payments (
            id, status, payment_date, total_amount, platform_fee,
            orders ( id, buyers ( profiles ( name ) ), auctions ( products ( title ) ) )
          ),
          sellers ( id, business_name, user_id, profiles ( name ) )
        `)
        .order("created_at", { ascending: false }),
      supabase.from("payments")
        .select("total_amount, payment_date, platform_fee")
        .eq("status", "paid")
        .order("payment_date", { ascending: true }),
    ]);
    if (!txRes.error) {
      setPendingTransactions((txRes.data || []).filter((t) => t.status === "onhold"));
      setReleasedTransactions((txRes.data || []).filter((t) => t.status === "released"));
    }
    if (!payRes.error) setPayments(payRes.data || []);
    setRevenueLoading(false);
  }, []);

  const fetchHomeStats = useCallback(async () => {
    setHomeLoading(true);
    const currentYear = new Date().getFullYear();

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
      supabase.from("bids").select("bid_time")
        .gte("bid_time", `${currentYear}-01-01`)
        .lte("bid_time", `${currentYear}-12-31`),
      supabase.from("auctions").select("created_at")
        .gte("created_at", `${currentYear}-01-01`)
        .lte("created_at", `${currentYear}-12-31`),
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
      pendingRequests: (pendingSellersRes.count || 0) + (pendingBuyersRes.count || 0) +
        (pendingProductsRes.count || 0) + (pendingAuctionsRes.count || 0),
      totalRevenue: revenueRes.data?.reduce((s, p) => s + (p.total_amount || 0), 0) || 0,
      totalAuctions: totalAuctionsRes.count || 0,
      completedAuctions: completedAuctionsRes.count || 0,
      totalBids: bidsRes.count || 0,
      monthlyBids: bidsByMonth,
      monthlyAuctions: auctionsByMonth,
      categoryData: catCounts,
    });
    setHomeLoading(false);
  }, []);

  // ─────────────────────────────────────────────────────────────────
  // OPTIMISTIC / LOCAL UPDATE HELPERS
  // These let pages update the UI instantly without waiting for a
  // re-fetch, keeping the UX snappy after admin actions.
  // ─────────────────────────────────────────────────────────────────

  const updateUserLocally = useCallback((userId, fields) => {
    setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, ...fields } : u));
  }, []);

  // Use a ref so the callback always sees current pendingTransactions
  const pendingTxRef = useRef([]);
  useEffect(() => { pendingTxRef.current = pendingTransactions; }, [pendingTransactions]);

  const updateTransactionLocally = useCallback((txId, fields) => {
    setPendingTransactions((prev) => {
      const txToMove = prev.find((t) => t.id === txId);
      if (txToMove) {
        setReleasedTransactions((rel) => [{ ...txToMove, ...fields }, ...rel]);
      }
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

  // ── Granular realtime helpers (update single rows, not full re-fetch) ──

  // Apply a realtime profiles change to the users list
  const applyUserChange = useCallback((payload) => {
    const { eventType, new: newRow, old } = payload;
    if (eventType === "INSERT") {
      setUsers((prev) => [newRow, ...prev]);
    } else if (eventType === "UPDATE") {
      setUsers((prev) => prev.map((u) => u.id === newRow.id ? { ...u, ...newRow } : u));
    } else if (eventType === "DELETE") {
      setUsers((prev) => prev.filter((u) => u.id !== old.id));
    }
  }, []);

  // Apply a realtime auctions change to activeAuctions
  const applyAuctionChange = useCallback((payload) => {
    const { eventType, new: newRow, old } = payload;
    const activeStatuses = ["live", "scheduled", "paused"];

    if (eventType === "INSERT" && activeStatuses.includes(newRow.status)) {
      // New active auction: fetch full row with joins then prepend
      supabase.from("auctions")
        .select(`*, products ( title, reserved_price ), sellers ( business_name, profiles ( name ) )`)
        .eq("id", newRow.id)
        .single()
        .then(({ data }) => {
          if (data) setActiveAuctions((prev) => [data, ...prev]);
        });
    } else if (eventType === "UPDATE") {
      if (!activeStatuses.includes(newRow.status)) {
        // Auction moved out of active states — remove it
        setActiveAuctions((prev) => prev.filter((a) => a.id !== newRow.id));
      } else {
        // Merge scalar updates (highest_bid, status, paused_by, end_time, etc.)
        setActiveAuctions((prev) =>
          prev.map((a) => a.id === newRow.id ? { ...a, ...newRow } : a)
        );
      }
    } else if (eventType === "DELETE") {
      setActiveAuctions((prev) => prev.filter((a) => a.id !== old.id));
    }
  }, []);

  // Apply a realtime suspicious bid change
  const applySuspiciousBidChange = useCallback((payload) => {
    const { eventType, new: newRow, old } = payload;
    if (eventType === "INSERT" && newRow.is_suspicious && newRow.status === "active") {
      // Fetch the full row with joins
      supabase.from("bids")
        .select(`*, auctions ( id, products ( title ) ), buyers ( id, profiles ( name ) )`)
        .eq("id", newRow.id)
        .single()
        .then(({ data }) => {
          if (data) setSuspiciousBids((prev) => [data, ...prev]);
        });
    } else if (eventType === "UPDATE") {
      if (!newRow.is_suspicious || newRow.status !== "active") {
        setSuspiciousBids((prev) => prev.filter((b) => b.id !== newRow.id));
      }
    } else if (eventType === "DELETE") {
      setSuspiciousBids((prev) => prev.filter((b) => b.id !== old.id));
    }
  }, []);

  // Apply realtime product change
  const applyProductChange = useCallback((payload) => {
    const { eventType, new: newRow, old } = payload;
    if (eventType === "INSERT" || eventType === "UPDATE") {
      // Fetch full product with joins to get seller info and images
      supabase.from("products")
        .select(`
          *,
          product_images ( image_url, is_primary ),
          sellers ( id, business_name, user_id, profiles ( name ) )
        `)
        .eq("id", newRow.id)
        .single()
        .then(({ data }) => {
          if (!data) return;
          const primaryImage =
            data.product_images?.find((img) => img.is_primary) ||
            data.product_images?.[0];
          const enriched = {
            ...data,
            sellerName: data.sellers?.profiles?.name || "—",
            businessName: data.sellers?.business_name || "—",
            sellerId: data.sellers?.user_id,
            primaryImage: primaryImage?.image_url || null,
            allImages: data.product_images || [],
          };
          // Remove from all buckets first, then add to correct bucket
          const removeById = (prev) => prev.filter((p) => p.id !== enriched.id);
          setPendingProducts((prev) => {
            const filtered = removeById(prev);
            return enriched.status === "pending" ? [enriched, ...filtered] : filtered;
          });
          setApprovedProducts((prev) => {
            const filtered = removeById(prev);
            return enriched.status === "active" ? [enriched, ...filtered] : filtered;
          });
          setRejectedProducts((prev) => {
            const filtered = removeById(prev);
            return enriched.status === "rejected" ? [enriched, ...filtered] : filtered;
          });
        });
    } else if (eventType === "DELETE") {
      const removeById = (prev) => prev.filter((p) => p.id !== old.id);
      setPendingProducts(removeById);
      setApprovedProducts(removeById);
      setRejectedProducts(removeById);
    }
  }, []);

  // Apply realtime order change (fetch full row with joins)
  const applyOrderChange = useCallback((payload) => {
    const { eventType, new: newRow, old } = payload;
    if (eventType === "INSERT" || eventType === "UPDATE") {
      supabase.from("orders")
        .select(`
          *,
          auctions ( id, products ( title ) ),
          buyers ( id, profiles ( name ) ),
          sellers ( id, business_name, profiles ( name ) ),
          payments ( status, total_amount, payment_date ),
          deliveries ( status, tracking_no, courier_service, delivery_date )
        `)
        .eq("id", newRow.id)
        .single()
        .then(({ data }) => {
          if (!data) return;
          if (eventType === "INSERT") {
            setOrders((prev) => [data, ...prev]);
          } else {
            setOrders((prev) => prev.map((o) => o.id === data.id ? data : o));
          }
        });
    } else if (eventType === "DELETE") {
      setOrders((prev) => prev.filter((o) => o.id !== old.id));
    }
  }, []);

  // Apply realtime transaction change
  const applyTransactionChange = useCallback((payload) => {
    const { eventType, new: newRow, old } = payload;
    if (eventType === "INSERT" || eventType === "UPDATE") {
      supabase.from("transactions")
        .select(`
          *,
          payments (
            id, status, payment_date, total_amount, platform_fee,
            orders ( id, buyers ( profiles ( name ) ), auctions ( products ( title ) ) )
          ),
          sellers ( id, business_name, user_id, profiles ( name ) )
        `)
        .eq("id", newRow.id)
        .single()
        .then(({ data }) => {
          if (!data) return;
          if (data.status === "onhold") {
            setReleasedTransactions((prev) => prev.filter((t) => t.id !== data.id));
            setPendingTransactions((prev) => {
              const exists = prev.some((t) => t.id === data.id);
              return exists
                ? prev.map((t) => t.id === data.id ? data : t)
                : [data, ...prev];
            });
          } else if (data.status === "released") {
            setPendingTransactions((prev) => prev.filter((t) => t.id !== data.id));
            setReleasedTransactions((prev) => {
              const exists = prev.some((t) => t.id === data.id);
              return exists
                ? prev.map((t) => t.id === data.id ? data : t)
                : [data, ...prev];
            });
          }
        });
    } else if (eventType === "DELETE") {
      setPendingTransactions((prev) => prev.filter((t) => t.id !== old.id));
      setReleasedTransactions((prev) => prev.filter((t) => t.id !== old.id));
    }
  }, []);

  // ─────────────────────────────────────────────────────────────────
  // INITIAL FETCH + REALTIME SUBSCRIPTIONS
  // ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    // Kick off all fetches in parallel
    Promise.all([
      fetchUsers(),
      fetchSellers(),
      fetchSellerEdits(),
      fetchBidders(),
      fetchBuyerEdits(),
      fetchProducts(),
      fetchAuctions(),
      fetchOrders(),
      fetchRevenue(),
      fetchHomeStats(),
    ]);

    // ── profiles: granular row-level updates ──────────────────────
    const userChannel = supabase
      .channel("admin-ctx-users")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        (payload) => {
          applyUserChange(payload);
          // Debounce home stats since it's expensive — just re-fetch once
          fetchHomeStats();
        }
      )
      .subscribe();

    // ── sellers: full re-fetch (complex enrichment) ───────────────
    const sellerChannel = supabase
      .channel("admin-ctx-sellers")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sellers" },
        () => {
          fetchSellers();
          fetchHomeStats();
        }
      )
      .subscribe();

    // ── pending_changes: light queries, full re-fetch is fine ─────
    const pendingChangesChannel = supabase
      .channel("admin-ctx-pending-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pending_changes" },
        () => {
          fetchSellerEdits();
          fetchBuyerEdits();
        }
      )
      .subscribe();

    // ── CNIC / buyers ─────────────────────────────────────────────
    const cnicChannel = supabase
      .channel("admin-ctx-cnic")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pending_cnic_submissions" },
        fetchBidders
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "buyers" },
        () => {
          fetchBidders();
          fetchHomeStats();
        }
      )
      .subscribe();

    // ── products: granular per-row updates ────────────────────────
    const productChannel = supabase
      .channel("admin-ctx-products")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products" },
        (payload) => {
          applyProductChange(payload);
          fetchHomeStats();
        }
      )
      .subscribe();

    // ── auctions + bids: granular updates ────────────────────────
    const auctionChannel = supabase
      .channel("admin-ctx-auctions")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "auctions" },
        (payload) => {
          applyAuctionChange(payload);
          fetchHomeStats();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bids" },
        (payload) => {
          applySuspiciousBidChange(payload);
          fetchHomeStats();
        }
      )
      .subscribe();

    // ── orders + deliveries: granular per-row updates ─────────────
    const orderChannel = supabase
      .channel("admin-ctx-orders")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        applyOrderChange
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "deliveries" },
        // A delivery update should re-render the matching order with new delivery data
        (payload) => {
          const orderId = payload.new?.order_id || payload.old?.order_id;
          if (!orderId) return;
          supabase.from("orders")
            .select(`
              *,
              auctions ( id, products ( title ) ),
              buyers ( id, profiles ( name ) ),
              sellers ( id, business_name, profiles ( name ) ),
              payments ( status, total_amount, payment_date ),
              deliveries ( status, tracking_no, courier_service, delivery_date )
            `)
            .eq("id", orderId)
            .single()
            .then(({ data }) => {
              if (data) setOrders((prev) => prev.map((o) => o.id === data.id ? data : o));
            });
        }
      )
      .subscribe();

    // ── transactions + payments: granular updates ─────────────────
    const revenueChannel = supabase
      .channel("admin-ctx-revenue")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transactions" },
        (payload) => {
          applyTransactionChange(payload);
          fetchHomeStats();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "payments" },
        () => {
          // Payments don't have their own list — just refresh revenue and home stats
          fetchRevenue();
          fetchHomeStats();
        }
      )
      .subscribe();

    channelsRef.current = [
      userChannel, sellerChannel, pendingChangesChannel,
      cnicChannel, productChannel, auctionChannel,
      orderChannel, revenueChannel,
    ];

    return () => {
      channelsRef.current.forEach((ch) => {
        try { supabase.removeChannel(ch); } catch (_) { }
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty — all callbacks are stable useCallbacks

  // ─────────────────────────────────────────────────────────────────
  // CONTEXT VALUE
  // ─────────────────────────────────────────────────────────────────

  return (
    <AdminContext.Provider value={{
      // Users
      users, usersLoading,
      refetchUsers: fetchUsers,
      updateUserLocally,

      // Sellers
      sellers, sellersLoading,
      pendingSellerEdits, sellerEditsLoading,
      refetchSellers: fetchSellers,
      refetchSellerEdits: fetchSellerEdits,

      // Bidders
      pendingSubmissions, rejectedSubmissions, approvedBuyers,
      biddersLoading,
      pendingBuyerEdits, buyerEditsLoading,
      refetchBidders: fetchBidders,
      refetchBuyerEdits: fetchBuyerEdits,

      // Products
      pendingProducts, approvedProducts, rejectedProducts,
      productsLoading,
      refetchProducts: fetchProducts,

      // Auctions
      activeAuctions, suspiciousBids,
      auctionsLoading,
      refetchAuctions: fetchAuctions,
      updateAuctionLocally,
      removeSuspiciousBid,

      // Orders
      orders, ordersLoading,
      refetchOrders: fetchOrders,

      // Revenue
      pendingTransactions, releasedTransactions, payments,
      revenueLoading,
      refetchRevenue: fetchRevenue,
      updateTransactionLocally,

      // Home stats
      homeStats, homeLoading,
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
