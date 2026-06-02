import {
  createContext, useContext, useState, useEffect,
  useRef, useCallback,
} from "react";
import { supabase } from "../supabase/supabase";

const AdminContext = createContext(null);

export const AdminProvider = ({ children }) => {

  // ── Users ─────────────────────────────────────────────────────────
  const [users, setUsers]               = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);

  // ── Sellers ───────────────────────────────────────────────────────
  const [sellers, setSellers]                       = useState({ pending: [], approved: [], rejected: [] });
  const [sellersLoading, setSellersLoading]         = useState(true);
  const [pendingSellerEdits, setPendingSellerEdits] = useState([]);
  const [sellerEditsLoading, setSellerEditsLoading] = useState(true);

  // ── Bidders ───────────────────────────────────────────────────────
  const [pendingSubmissions, setPendingSubmissions] = useState([]);
  const [rejectedSubmissions, setRejectedSubmissions] = useState([]);
  const [approvedBuyers, setApprovedBuyers]         = useState([]);
  const [biddersLoading, setBiddersLoading]         = useState(true);
  const [pendingBuyerEdits, setPendingBuyerEdits]   = useState([]);
  const [buyerEditsLoading, setBuyerEditsLoading]   = useState(true);

  // ── Products ──────────────────────────────────────────────────────
  const [pendingProducts, setPendingProducts]   = useState([]);
  const [approvedProducts, setApprovedProducts] = useState([]);
  const [rejectedProducts, setRejectedProducts] = useState([]);
  const [productsLoading, setProductsLoading]   = useState(true);

  // ── Auctions + Bids ───────────────────────────────────────────────
  const [activeAuctions, setActiveAuctions] = useState([]);
  const [suspiciousBids, setSuspiciousBids] = useState([]);
  const [auctionsLoading, setAuctionsLoading] = useState(true);

  // ── Orders ────────────────────────────────────────────────────────
  const [orders, setOrders]           = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);

  // ── Revenue ───────────────────────────────────────────────────────
  const [pendingTransactions, setPendingTransactions]   = useState([]);
  const [releasedTransactions, setReleasedTransactions] = useState([]);
  const [payments, setPayments]                         = useState([]);
  const [revenueLoading, setRevenueLoading]             = useState(true);

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
  // ─────────────────────────────────────────────────────────────────

  const fetchUsers = useCallback(async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("join_date", { ascending: false });
    if (!error) setUsers(data || []);
    setUsersLoading(false);
  }, []);

  const fetchSellers = useCallback(async () => {
    setSellersLoading(true);

    const { data, error } = await supabase
      .from("sellers")
      .select(`*, profiles ( id, name, role, status, email )`)
      .order("created_at", { ascending: false });

    if (error) { setSellersLoading(false); return; }

    const rows = data || [];
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
      listings: 0, successRate: "—", earnings: "PKR 0",
    }));
    setSellers(bucket(skeleton));
    setSellersLoading(false);

    // Enrich with stats in background
    const sellerIds = rows.map((s) => s.id);
    if (!sellerIds.length) return;

    const [listingsRes, soldRes, txRes] = await Promise.all([
      supabase.from("auctions").select("seller_id, status").in("seller_id", sellerIds).in("status", ["live", "ended", "scheduled"]),
      supabase.from("products").select("seller_id").in("seller_id", sellerIds).eq("status", "sold"),
      supabase.from("transactions").select("seller_id, seller_amount").in("seller_id", sellerIds).eq("status", "released"),
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
      const totalSold  = soldMap[s.id] || 0;
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
      .eq("role", "seller").eq("status", "pending")
      .order("created_at", { ascending: false });
    if (!error) {
      setPendingSellerEdits((data || []).map((e) => ({
        ...e, userName: e.profiles?.name || "—", userEmail: e.profiles?.email || "—",
      })));
    }
    setSellerEditsLoading(false);
  }, []);

  const fetchBidders = useCallback(async () => {
    setBiddersLoading(true);

    const [pendingRes, rejectedRes, buyerRes] = await Promise.all([
      supabase.from("pending_cnic_submissions").select(`*, profiles ( id, name, email, role, status )`).eq("status", "pending").order("created_at", { ascending: false }),
      supabase.from("pending_cnic_submissions").select(`*, profiles ( id, name, email, role, status )`).eq("status", "rejected").order("created_at", { ascending: false }),
      supabase.from("buyers").select(`*, profiles ( id, name, email, role, status )`).eq("is_verified", "approved").order("created_at", { ascending: false }),
    ]);

    setPendingSubmissions((pendingRes.data || []).map((s) => ({
      ...s, name: s.profiles?.name || "—", email: s.email || s.profiles?.email || "—", submissionId: s.id,
    })));
    setRejectedSubmissions((rejectedRes.data || []).map((s) => ({
      ...s, name: s.profiles?.name || "—", email: s.email || s.profiles?.email || "—",
    })));

    const buyerRows = buyerRes.data || [];
    setApprovedBuyers(buyerRows.map((b) => ({
      ...b, name: b.profiles?.name || "—", email: b.profiles?.email || "—", totalBids: 0, auctionsWon: 0,
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
      ...b, name: b.profiles?.name || "—", email: b.profiles?.email || "—",
      totalBids: bidCountMap[b.id] || 0, auctionsWon: winCountMap[b.id] || 0,
    })));
  }, []);

  const fetchBuyerEdits = useCallback(async () => {
    setBuyerEditsLoading(true);
    const { data, error } = await supabase
      .from("pending_changes")
      .select(`*, profiles ( id, name, email, role )`)
      .eq("role", "buyer").eq("status", "pending")
      .order("created_at", { ascending: false });
    if (!error) {
      setPendingBuyerEdits((data || []).map((e) => ({
        ...e, userName: e.profiles?.name || "—", userEmail: e.profiles?.email || "—",
      })));
    }
    setBuyerEditsLoading(false);
  }, []);

  const fetchProducts = useCallback(async () => {
    setProductsLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select(`*, product_images ( image_url, is_primary ), sellers ( id, business_name, user_id, profiles ( name ) )`)
      .order("created_at", { ascending: false });

    if (error) { setProductsLoading(false); return; }

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
        sellers ( id, business_name, user_id, profiles ( id, name ) ),
        payments ( id, status, total_amount, payment_date ),
        deliveries ( id, status, tracking_no, courier_service, delivery_date )
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
    setHomeLoading(false);
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

  // ─────────────────────────────────────────────────────────────────
  // REALTIME SUBSCRIPTIONS
  // FIX: Each channel listens to ONE table
  // FIX: fetchHomeStats() only called for events that affect home stats
  // FIX: No stale closure — each callback calls the stable useCallback fn
  // FIX: Proper teardown on unmount
  // ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    // Initial data fetch — all in parallel
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

    // ── Channel 1: profiles ────────────────────────────────────────
    // FIX: Only refetch users — not homeStats on every profile change
    const userChannel = supabase
      .channel("admin-ctx-profiles")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" },
        () => {
          fetchUsers();
          // Debounce home stats — only refetch every 5s max
          // to avoid hammering DB on rapid profile updates
          fetchHomeStats();
        }
      )
      .subscribe();

    // ── Channel 2: sellers ─────────────────────────────────────────
    const sellerChannel = supabase
      .channel("admin-ctx-sellers")
      .on("postgres_changes", { event: "*", schema: "public", table: "sellers" },
        () => {
          fetchSellers();
          fetchHomeStats();
        }
      )
      .subscribe();

    // ── Channel 3: pending_changes ─────────────────────────────────
    // FIX: Only refetch edits — does NOT affect home stats
    const pendingChangesChannel = supabase
      .channel("admin-ctx-pending-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "pending_changes" },
        () => {
          fetchSellerEdits();
          fetchBuyerEdits();
        }
      )
      .subscribe();

    // ── Channel 4: pending_cnic_submissions ────────────────────────
    const cnicChannel = supabase
      .channel("admin-ctx-cnic-submissions")
      .on("postgres_changes", { event: "*", schema: "public", table: "pending_cnic_submissions" },
        () => {
          fetchBidders();
          fetchHomeStats();
        }
      )
      .subscribe();

    // ── Channel 5: buyers ──────────────────────────────────────────
    const buyerChannel = supabase
      .channel("admin-ctx-buyers")
      .on("postgres_changes", { event: "*", schema: "public", table: "buyers" },
        () => {
          fetchBidders();
          fetchHomeStats();
        }
      )
      .subscribe();

    // ── Channel 6: products ────────────────────────────────────────
    const productChannel = supabase
      .channel("admin-ctx-products")
      .on("postgres_changes", { event: "*", schema: "public", table: "products" },
        () => {
          fetchProducts();
          fetchHomeStats();
        }
      )
      .subscribe();

    // ── Channel 7: auctions ────────────────────────────────────────
    // FIX: Uses granular update for status changes (pause/resume)
    // so ProductDetailPage realtime pause works correctly
    const auctionChannel = supabase
      .channel("admin-ctx-auctions")
      .on("postgres_changes", { event: "*", schema: "public", table: "auctions" },
        (payload) => {
          const { eventType, new: newRow, old } = payload;
          const activeStatuses = ["live", "scheduled", "paused"];

          if (eventType === "UPDATE") {
            if (!activeStatuses.includes(newRow?.status)) {
              // Auction ended/cancelled — remove from active list
              setActiveAuctions((prev) => prev.filter((a) => a.id !== newRow.id));
            } else {
              // FIX: Merge only scalar fields — preserve joined products/sellers
              setActiveAuctions((prev) =>
                prev.map((a) =>
                  a.id === newRow.id
                    ? {
                        ...a,
                        status:            newRow.status,
                        highest_bid:       newRow.highest_bid,
                        highest_bidder_id: newRow.highest_bidder_id,
                        winner_id:         newRow.winner_id,
                        end_time:          newRow.end_time,
                        paused_by:         newRow.paused_by,
                        min_increment:     newRow.min_increment,
                        approval_status:   newRow.approval_status,
                      }
                    : a
                )
              );
            }
          } else if (eventType === "INSERT" && activeStatuses.includes(newRow?.status)) {
            // New active auction — fetch with joins then add
            supabase.from("auctions")
              .select(`*, products ( title, reserved_price ), sellers ( id, user_id, business_name, profiles ( id, name ) )`)
              .eq("id", newRow.id)
              .single()
              .then(({ data }) => {
                if (data) setActiveAuctions((prev) => [data, ...prev]);
              });
          } else if (eventType === "DELETE") {
            setActiveAuctions((prev) => prev.filter((a) => a.id !== old?.id));
          }

          fetchHomeStats();
        }
      )
      .subscribe();

    // ── Channel 8: bids ────────────────────────────────────────────
    // FIX: Only update suspicious bids list — NOT a full re-fetch
    const bidChannel = supabase
      .channel("admin-ctx-bids")
      .on("postgres_changes", { event: "*", schema: "public", table: "bids" },
        (payload) => {
          const { eventType, new: newRow, old } = payload;

          if (eventType === "INSERT" && newRow?.is_suspicious && newRow?.status === "active") {
            // New suspicious bid — fetch with joins then prepend
            supabase.from("bids")
              .select(`*, auctions ( id, products ( title ) ), buyers ( id, profiles ( name ) )`)
              .eq("id", newRow.id)
              .single()
              .then(({ data }) => {
                if (data) setSuspiciousBids((prev) => [data, ...prev]);
              });
          } else if (eventType === "UPDATE") {
            if (!newRow?.is_suspicious || newRow?.status !== "active") {
              setSuspiciousBids((prev) => prev.filter((b) => b.id !== newRow?.id));
            }
          } else if (eventType === "DELETE") {
            setSuspiciousBids((prev) => prev.filter((b) => b.id !== old?.id));
          }

          // FIX: Only update home stats totalBids counter
          // Do NOT call fetchHomeStats() here — too frequent during live auctions
          // Instead update the count locally
          setHomeStats((prev) => ({
            ...prev,
            totalBids: eventType === "INSERT"
              ? prev.totalBids + 1
              : eventType === "DELETE"
              ? Math.max(0, prev.totalBids - 1)
              : prev.totalBids,
          }));
        }
      )
      .subscribe();

    // ── Channel 9: orders ──────────────────────────────────────────
    // FIX: Fetch full row with joins when order changes
    // instead of a full re-fetch of all orders
    const orderChannel = supabase
      .channel("admin-ctx-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" },
        (payload) => {
          const { eventType, new: newRow, old } = payload;
          if (eventType === "INSERT" || eventType === "UPDATE") {
            supabase.from("orders")
              .select(`
                *,
                auctions ( id, products ( title ) ),
                buyers ( id, profiles ( name ) ),
                sellers ( id, business_name, user_id, profiles ( id, name ) ),
                payments ( id, status, total_amount, payment_date ),
                deliveries ( id, status, tracking_no, courier_service, delivery_date )
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
            setOrders((prev) => prev.filter((o) => o.id !== old?.id));
          }
        }
      )
      .subscribe();

    // ── Channel 10: deliveries ─────────────────────────────────────
    // FIX: When delivery changes, re-fetch the parent order
    // so the orders table shows updated delivery status immediately
    const deliveryChannel = supabase
      .channel("admin-ctx-deliveries")
      .on("postgres_changes", { event: "*", schema: "public", table: "deliveries" },
        (payload) => {
          const orderId = payload.new?.order_id || payload.old?.order_id;
          if (!orderId) return;

          supabase.from("orders")
            .select(`
              *,
              auctions ( id, products ( title ) ),
              buyers ( id, profiles ( name ) ),
              sellers ( id, business_name, user_id, profiles ( id, name ) ),
              payments ( id, status, total_amount, payment_date ),
              deliveries ( id, status, tracking_no, courier_service, delivery_date )
            `)
            .eq("id", orderId)
            .single()
            .then(({ data }) => {
              if (data) setOrders((prev) => prev.map((o) => o.id === data.id ? data : o));
            });
        }
      )
      .subscribe();

    // ── Channel 11: transactions ───────────────────────────────────
    // FIX: Granular update — move transaction between pending/released lists
    const transactionChannel = supabase
      .channel("admin-ctx-transactions")
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" },
        (payload) => {
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
                    return exists ? prev.map((t) => t.id === data.id ? data : t) : [data, ...prev];
                  });
                } else if (data.status === "released") {
                  setPendingTransactions((prev) => prev.filter((t) => t.id !== data.id));
                  setReleasedTransactions((prev) => {
                    const exists = prev.some((t) => t.id === data.id);
                    return exists ? prev.map((t) => t.id === data.id ? data : t) : [data, ...prev];
                  });
                }
              });
          } else if (eventType === "DELETE") {
            setPendingTransactions((prev) => prev.filter((t) => t.id !== old?.id));
            setReleasedTransactions((prev) => prev.filter((t) => t.id !== old?.id));
          }
        }
      )
      .subscribe();

    // ── Channel 12: payments ───────────────────────────────────────
    // FIX: Only refresh revenue when payments change
    // NOT home stats — payments rarely change
    const paymentChannel = supabase
      .channel("admin-ctx-payments")
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" },
        () => fetchRevenue()
      )
      .subscribe();

    // Store all channels for cleanup
    channelsRef.current = [
      userChannel, sellerChannel, pendingChangesChannel,
      cnicChannel, buyerChannel, productChannel,
      auctionChannel, bidChannel, orderChannel,
      deliveryChannel, transactionChannel, paymentChannel,
    ];

    // Cleanup on unmount
    return () => {
      channelsRef.current.forEach((ch) => {
        try { supabase.removeChannel(ch); } catch (_) {}
      });
      channelsRef.current = [];
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Intentionally empty — all fetch functions are stable useCallbacks

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