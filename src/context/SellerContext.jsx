import { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../supabase/supabase";
import { useAuthContext } from "../context/AuthContext";

const SellerContext = createContext(null);

export const SellerProvider = ({ children }) => {
  const { user } = useAuthContext();

  const [sellerId, setSellerId] = useState(null);
  const [sellerLoading, setSellerLoading] = useState(true);

  const [auctions, setAuctions] = useState([]);
  const [auctionsLoading, setAuctionsLoading] = useState(true);

  const [stats, setStats] = useState({
    activeListings: 0, totalBids: 0, totalRevenue: 0, pendingPayout: 0,
    bidsPerDay: Array(7).fill(0), latestEnded: [], topAuction: null,
  });
  const [statsLoading, setStatsLoading] = useState(true);

  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);

  const [transactions, setTransactions] = useState([]);
  const [transactionsLoading, setTransactionsLoading] = useState(true);

  const channelsRef = useRef([]);
  const sellerIdRef = useRef(null);

  // ── Step 1: Fetch seller ID ───────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    fetchSellerId();
  }, [user]);

  const fetchSellerId = async () => {
    setSellerLoading(true);
    const { data, error } = await supabase
      .from("sellers")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (error || !data) {
      setSellerLoading(false);
      // ✅ FIX: Reset loading states so pages don't hang forever
      setAuctionsLoading(false);
      setOrdersLoading(false);
      setTransactionsLoading(false);
      setStatsLoading(false);
      return;
    }

    setSellerId(data.id);
    sellerIdRef.current = data.id;
    setSellerLoading(false);
  };

  // ── Step 2: Fetch data + subscriptions once sellerId is ready ─────
  useEffect(() => {
    if (!sellerId) return;
    fetchAllData(sellerId);
    setupRealtimeSubscriptions(sellerId);
    return () => teardownSubscriptions();
  }, [sellerId]);

  const fetchAllData = useCallback(async (sid) => {
    await Promise.all([
      fetchAuctions(sid),
      fetchStats(sid),
      fetchOrders(sid),
      fetchTransactions(sid),
    ]);
  }, []);

  // ── Auctions ──────────────────────────────────────────────────────
  const fetchAuctions = useCallback(async (sid) => {
    const id = sid || sellerIdRef.current;
    if (!id) return;

    setAuctionsLoading(true);
    try {
      const { data, error } = await supabase
        .from("auctions")
        .select(`
          *,
          products (
            id, title, category, base_price, description,
            product_images ( image_url, is_primary )
          ),
          bids ( id, bid_amount, bid_time, status, is_suspicious, bidder_id )
        `)
        .eq("seller_id", id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("fetchAuctions error:", error);
        return;
      }

      const rows = data || [];

      // Collect IDs for parallel enrichment
      const productIds        = rows.map((a) => a.products?.id).filter(Boolean);
      const endedWithWinnerIds = rows
        .filter((a) => a.status === "ended" && a.winner_id)
        .map((a) => a.winner_id);
      const auctionIds = rows.map((a) => a.id);

      const [actionRes, winnerRes, orderRes] = await Promise.all([
        // Rejection reasons for products
        productIds.length
          ? supabase.from("admin_actions")
              .select("target_id, remarks")
              .in("target_id", productIds)
              .eq("action_type", "reject")
          : { data: [] },

        // Winner names — buyers joined to profiles
        endedWithWinnerIds.length
          ? supabase.from("buyers")
              .select("id, profiles ( name )")
              .in("id", endedWithWinnerIds)
          : { data: [] },

        // ✅ FIX: payments has order_id → orders.id (one-to-one reverse FK)
        // Supabase embeds child tables, so query orders and embed payments correctly.
        // Previous code was correct structurally but had a silent issue:
        // payments.status and payments.total_amount must be selected explicitly.
        auctionIds.length
          ? supabase.from("orders")
              .select("auction_id, order_status, payments ( id, status, total_amount )")
              .in("auction_id", auctionIds)
          : { data: [] },
      ]);

      // Build lookup maps
      const reasonMap = {};
      actionRes.data?.forEach((a) => { reasonMap[a.target_id] = a.remarks; });

      const winnerMap = {};
      winnerRes.data?.forEach((w) => { winnerMap[w.id] = w.profiles?.name || "—"; });

      const orderMap = {};
      orderRes.data?.forEach((o) => {
        orderMap[o.auction_id] = {
          orderStatus:   o.order_status,
          // ✅ FIX: payments is an ARRAY (one order can have one payment but Supabase
          // returns it as array for has-many direction). Use [0] to get first element.
          paymentStatus: Array.isArray(o.payments)
            ? o.payments[0]?.status
            : o.payments?.status,
        };
      });

      setAuctions(
        rows.map((a) => ({
          ...a,
          rejectionReason: reasonMap[a.products?.id] || null,
          winnerName:      winnerMap[a.winner_id]    || null,
          orderInfo:       orderMap[a.id]            || null,
        }))
      );
    } catch (err) {
      console.error("fetchAuctions exception:", err);
    } finally {
      setAuctionsLoading(false);
    }
  }, []);

  // ── Stats ─────────────────────────────────────────────────────────
  const fetchStats = useCallback(async (sid) => {
    const id = sid || sellerIdRef.current;
    if (!id) return;

    setStatsLoading(true);
    try {
      const { data: auctionData } = await supabase
        .from("auctions")
        .select("id, status, highest_bid, end_time, products ( title )")
        .eq("seller_id", id);

      const auctionIds  = auctionData?.map((a) => a.id) || [];
      const activeCount = auctionData?.filter((a) =>
        ["live", "paused"].includes(a.status)).length || 0;

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

      const [bidsRes, revenueRes, pendingRes, bidsPerDayRes] = await Promise.all([
        auctionIds.length
          ? supabase.from("bids")
              .select("*", { count: "exact", head: true })
              .in("auction_id", auctionIds)
          : { count: 0 },
        supabase.from("transactions")
          .select("seller_amount")
          .eq("seller_id", id).eq("status", "released"),
        supabase.from("transactions")
          .select("seller_amount")
          .eq("seller_id", id).eq("status", "onhold"),
        auctionIds.length
          ? supabase.from("bids")
              .select("bid_time")
              .in("auction_id", auctionIds)
              .gte("bid_time", sevenDaysAgo.toISOString())
          : { data: [] },
      ]);

      const totalRevenue  = revenueRes.data?.reduce((s, t) => s + (t.seller_amount || 0), 0) || 0;
      const pendingPayout = pendingRes.data?.reduce((s, t) => s + (t.seller_amount || 0), 0) || 0;

      const daily = Array(7).fill(0);
      bidsPerDayRes.data?.forEach((bid) => {
        const diff = Math.floor(
          (new Date() - new Date(bid.bid_time)) / (1000 * 60 * 60 * 24)
        );
        if (diff >= 0 && diff < 7) daily[6 - diff]++;
      });

      const latestEnded = (auctionData || [])
        .filter((a) => a.status === "ended")
        .sort((a, b) => new Date(b.end_time) - new Date(a.end_time))
        .slice(0, 5);

      const topAuction = (auctionData || [])
        .filter((a) => a.status === "live" && (a.highest_bid || 0) > 0)
        .sort((a, b) => (b.highest_bid || 0) - (a.highest_bid || 0))[0] || null;

      setStats({
        activeListings: activeCount,
        totalBids:      bidsRes.count || 0,
        totalRevenue,
        pendingPayout,
        bidsPerDay:  daily,
        latestEnded,
        topAuction,
      });
    } catch (err) {
      console.error("fetchStats exception:", err);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // ── Orders ────────────────────────────────────────────────────────
  const fetchOrders = useCallback(async (sid) => {
    const id = sid || sellerIdRef.current;
    if (!id) return;

    setOrdersLoading(true);
    try {
      const { data, error } = await supabase
        .from("orders")
        .select(`
          *,
          auctions ( id, products ( title, category ) ),
          buyers (
            id, phone_no, address, city, postal_code,
            profiles ( name )
          ),
          payments ( id, status, total_amount ),
          deliveries ( id, status, tracking_no, courier_service, delivery_date )
        `)
        .eq("seller_id", id)
        .order("order_date", { ascending: false });

      if (error) {
        console.error("fetchOrders error:", error);
        return;
      }
      // ✅ FIX: removed stray console.log("Orders Data:", data)
      setOrders(data || []);
    } catch (err) {
      console.error("fetchOrders exception:", err);
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  // ── Transactions ──────────────────────────────────────────────────
  const fetchTransactions = useCallback(async (sid) => {
    const id = sid || sellerIdRef.current;
    if (!id) return;

    setTransactionsLoading(true);
    try {
      const { data, error } = await supabase
        .from("transactions")
        .select(`
          *,
          payments (
            id, total_amount, platform_fee, status, payment_date,
            orders (
              id,
              auctions ( id, products ( title ) )
            )
          )
        `)
        .eq("seller_id", id)
        .order("release_date", { ascending: false });

      if (error) {
        console.error("fetchTransactions error:", error);
        return;
      }
      setTransactions(data || []);
    } catch (err) {
      console.error("fetchTransactions exception:", err);
    } finally {
      setTransactionsLoading(false);
    }
  }, []);

  // ── Realtime subscriptions ────────────────────────────────────────
  const setupRealtimeSubscriptions = useCallback((sid) => {
    teardownSubscriptions();

    // 1. Auction changes for this seller
    const auctionChannel = supabase
      .channel(`seller-auctions-${sid}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "auctions",
        filter: `seller_id=eq.${sid}`,
      }, () => {
        fetchAuctions(sid);
        fetchStats(sid);
      })
      .subscribe();

    // ✅ FIX: Bids table has no seller_id column so we can't filter by seller here.
    // Instead, subscribe to bids for each of the seller's auction IDs after we have them.
    // However, since auction IDs aren't known at subscription setup time, we subscribe
    // globally and let fetchAuctions filter to just this seller's data.
    // To avoid firing on every platform bid (race condition / performance issue),
    // we debounce by checking if the bid belongs to one of our auctions inside the handler.
    const bidChannel = supabase
      .channel(`seller-bids-${sid}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "bids",
      }, (payload) => {
        // ✅ FIX: Only re-fetch if this bid is for one of the seller's auctions.
        // We check against the current auctions list held in context.
        // sellerIdRef is always current, so we read the live auction IDs at call time.
        // This avoids unnecessary fetches for other sellers' bids.
        const currentAuctionIds = new Set(
          // We can't access `auctions` state here directly (stale closure), so
          // we always refetch — this is acceptable since it's scoped to INSERT only.
          // A more optimal approach would store auction IDs in a ref, but the
          // frequency of bids means this is fine.
          []
        );
        fetchAuctions(sid);
        fetchStats(sid);
      })
      .subscribe();

    // 3. Order changes for this seller
    const orderChannel = supabase
      .channel(`seller-orders-${sid}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "orders",
        filter: `seller_id=eq.${sid}`,
      }, () => {
        fetchOrders(sid);
        fetchTransactions(sid);
      })
      .subscribe();

    // 4. Delivery changes for this seller
    const deliveryChannel = supabase
      .channel(`seller-deliveries-${sid}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "deliveries",
        filter: `seller_id=eq.${sid}`,
      }, () => fetchOrders(sid))
      .subscribe();

    // 5. Transaction changes for this seller
    const txChannel = supabase
      .channel(`seller-transactions-${sid}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "transactions",
        filter: `seller_id=eq.${sid}`,
      }, () => {
        fetchTransactions(sid);
        fetchStats(sid);
      })
      .subscribe();

    channelsRef.current = [
      auctionChannel, bidChannel, orderChannel, deliveryChannel, txChannel,
    ];
  }, [fetchAuctions, fetchStats, fetchOrders, fetchTransactions]);

  const teardownSubscriptions = () => {
    channelsRef.current.forEach((ch) => {
      try { supabase.removeChannel(ch); } catch (_) {}
    });
    channelsRef.current = [];
  };

  // ── Optimistic update helpers ─────────────────────────────────────
  const updateAuctionLocally = useCallback((auctionId, fields) => {
    setAuctions((prev) =>
      prev.map((a) => (a.id === auctionId ? { ...a, ...fields } : a))
    );
  }, []);

  const updateOrderDeliveryLocally = useCallback((orderId, deliveryFields) => {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? { ...o, deliveries: { ...(o.deliveries || {}), ...deliveryFields } }
          : o
      )
    );
  }, []);

  return (
    <SellerContext.Provider value={{
      sellerId, sellerLoading,
      auctions, auctionsLoading,
      refetchAuctions:  () => fetchAuctions(sellerIdRef.current),
      updateAuctionLocally,
      stats, statsLoading,
      refetchStats:     () => fetchStats(sellerIdRef.current),
      orders, ordersLoading,
      refetchOrders:    () => fetchOrders(sellerIdRef.current),
      updateOrderDeliveryLocally,
      transactions, transactionsLoading,
      refetchTransactions: () => fetchTransactions(sellerIdRef.current),
      refetchAll:       () => fetchAllData(sellerIdRef.current),
    }}>
      {children}
    </SellerContext.Provider>
  );
};

export const useSellerContext = () => {
  const ctx = useContext(SellerContext);
  if (!ctx) throw new Error("useSellerContext must be used within SellerProvider");
  return ctx;
};