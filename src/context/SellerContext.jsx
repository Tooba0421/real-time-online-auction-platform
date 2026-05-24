import { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../supabase/supabase";
import { useAuthContext } from "../context/AuthContext";

const SellerContext = createContext(null);

export const SellerProvider = ({ children }) => {
  const { user } = useAuthContext();

  // ── Core shared state ─────────────────────────────────────────────
  const [sellerId, setSellerId] = useState(null);
  const [sellerLoading, setSellerLoading] = useState(true);

  // Shared auction list (used by LiveAuctions + AuctionManagement)
  const [auctions, setAuctions] = useState([]);
  const [auctionsLoading, setAuctionsLoading] = useState(true);

  // Shared stats (used by SellerHome)
  const [stats, setStats] = useState({
    activeListings: 0,
    totalBids: 0,
    totalRevenue: 0,
    pendingPayout: 0,
    bidsPerDay: Array(7).fill(0),
    latestEnded: [],
    topAuction: null,
  });
  const [statsLoading, setStatsLoading] = useState(true);

  // Shared orders (used by OrdersDelivery)
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);

  // Shared transactions (used by EarningsPayouts)
  const [transactions, setTransactions] = useState([]);
  const [transactionsLoading, setTransactionsLoading] = useState(true);

  // Track active realtime channels so we can clean up
  const channelsRef = useRef([]);
  const sellerIdRef = useRef(null); // always current sellerId for callbacks

  // ── Step 1: Fetch seller ID once ─────────────────────────────────
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
      return;
    }

    setSellerId(data.id);
    sellerIdRef.current = data.id;
    setSellerLoading(false);
  };

  // ── Step 2: Fetch all data once sellerId is known ─────────────────
  useEffect(() => {
    if (!sellerId) return;
    fetchAllData(sellerId);
    setupRealtimeSubscriptions(sellerId);

    return () => teardownSubscriptions();
  }, [sellerId]);

  // ── Fetch everything in parallel ──────────────────────────────────
  const fetchAllData = useCallback(async (sid) => {
    await Promise.all([
      fetchAuctions(sid),
      fetchStats(sid),
      fetchOrders(sid),
      fetchTransactions(sid),
    ]);
  }, []);

  // ── Auctions (shared by LiveAuctions + AuctionManagement) ─────────
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

      if (error) { console.error("fetchAuctions:", error); return; }

      // Enrich with rejection reasons, winner names, order info in parallel
      const productIds = data?.map((a) => a.products?.id).filter(Boolean) || [];
      const endedWithWinner = data?.filter((a) => a.status === "ended" && a.winner_id) || [];
      const auctionIds = data?.map((a) => a.id) || [];

      const [actionRes, winnerRes, orderRes] = await Promise.all([
        productIds.length
          ? supabase.from("admin_actions").select("target_id, remarks")
              .in("target_id", productIds).eq("action_type", "reject")
          : { data: [] },
        endedWithWinner.length
          ? supabase.from("buyers").select("id, profiles ( name )")
              .in("id", endedWithWinner.map((a) => a.winner_id))
          : { data: [] },
        auctionIds.length
          ? supabase.from("orders").select("auction_id, order_status, payments ( status )")
              .in("auction_id", auctionIds)
          : { data: [] },
      ]);

      const reasonMap = {};
      actionRes.data?.forEach((a) => { reasonMap[a.target_id] = a.remarks; });

      const winnerMap = {};
      winnerRes.data?.forEach((w) => { winnerMap[w.id] = w.profiles?.name || "—"; });

      const orderMap = {};
      orderRes.data?.forEach((o) => {
        orderMap[o.auction_id] = {
          orderStatus: o.order_status,
          paymentStatus: o.payments?.status,
        };
      });

      setAuctions(
        (data || []).map((a) => ({
          ...a,
          rejectionReason: reasonMap[a.products?.id] || null,
          winnerName: winnerMap[a.winner_id] || null,
          orderInfo: orderMap[a.id] || null,
        }))
      );
    } finally {
      setAuctionsLoading(false);
    }
  }, []);

  // ── Stats (SellerHome) ────────────────────────────────────────────
  const fetchStats = useCallback(async (sid) => {
    const id = sid || sellerIdRef.current;
    if (!id) return;

    setStatsLoading(true);
    try {
      // All auction IDs for this seller
      const { data: auctionData } = await supabase
        .from("auctions").select("id, status, highest_bid, end_time, products(title)")
        .eq("seller_id", id);

      const auctionIds = auctionData?.map((a) => a.id) || [];
      const activeCount = auctionData?.filter((a) =>
        ["live", "paused"].includes(a.status)).length || 0;

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

      const [bidsRes, revenueRes, pendingRes, bidsPerDayRes] = await Promise.all([
        auctionIds.length
          ? supabase.from("bids").select("*", { count: "exact", head: true })
              .in("auction_id", auctionIds)
          : { count: 0 },
        supabase.from("transactions").select("seller_amount")
          .eq("seller_id", id).eq("status", "released"),
        supabase.from("transactions").select("seller_amount")
          .eq("seller_id", id).eq("status", "onhold"),
        auctionIds.length
          ? supabase.from("bids").select("bid_time").in("auction_id", auctionIds)
              .gte("bid_time", sevenDaysAgo.toISOString())
          : { data: [] },
      ]);

      const totalRevenue = revenueRes.data?.reduce(
        (s, t) => s + (t.seller_amount || 0), 0) || 0;
      const pendingPayout = pendingRes.data?.reduce(
        (s, t) => s + (t.seller_amount || 0), 0) || 0;

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
        totalBids: bidsRes.count || 0,
        totalRevenue,
        pendingPayout,
        bidsPerDay: daily,
        latestEnded,
        topAuction,
      });
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
          payments ( status, total_amount ),
          deliveries ( id, status, tracking_no, courier_service, delivery_date )
        `)
        .eq("seller_id", id)
        .order("order_date", { ascending: false });

      if (!error) setOrders(data || []);
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

      if (!error) setTransactions(data || []);
    } finally {
      setTransactionsLoading(false);
    }
  }, []);

  // ── Realtime subscriptions ────────────────────────────────────────
  const setupRealtimeSubscriptions = useCallback((sid) => {
    teardownSubscriptions();

    // 1. Auction changes → refresh auctions + stats
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

    // 2. New bids → refresh auctions (highest_bid) + stats
    const bidChannel = supabase
      .channel(`seller-bids-${sid}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "bids",
      }, () => {
        fetchAuctions(sid);
        fetchStats(sid);
      })
      .subscribe();

    // 3. Order changes → refresh orders + transactions
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

    // 4. Delivery changes → refresh orders
    const deliveryChannel = supabase
      .channel(`seller-deliveries-${sid}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "deliveries",
        filter: `seller_id=eq.${sid}`,
      }, () => fetchOrders(sid))
      .subscribe();

    // 5. Transaction changes → refresh transactions + stats
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

  // ── Optimistic local update helpers (avoid full re-fetch) ─────────
  // Update a single auction's fields in local state immediately
  const updateAuctionLocally = useCallback((auctionId, fields) => {
    setAuctions((prev) =>
      prev.map((a) => (a.id === auctionId ? { ...a, ...fields } : a))
    );
  }, []);

  // Update a single order's delivery in local state
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
      // Identity
      sellerId,
      sellerLoading,

      // Auctions
      auctions,
      auctionsLoading,
      refetchAuctions: () => fetchAuctions(sellerIdRef.current),
      updateAuctionLocally,

      // Stats
      stats,
      statsLoading,
      refetchStats: () => fetchStats(sellerIdRef.current),

      // Orders
      orders,
      ordersLoading,
      refetchOrders: () => fetchOrders(sellerIdRef.current),
      updateOrderDeliveryLocally,

      // Transactions
      transactions,
      transactionsLoading,
      refetchTransactions: () => fetchTransactions(sellerIdRef.current),

      // Refetch everything (used after CreateAuction)
      refetchAll: () => fetchAllData(sellerIdRef.current),
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