import { useState, useEffect, useRef } from "react";
import { supabase } from "../supabase/supabase";

export const useAuction = (auctionId) => {

  const [auction, setAuction]   = useState(null);
  const [bids, setBids]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [timeLeft, setTimeLeft] = useState(null);
  const timerRef                = useRef(null);

  useEffect(() => {
    if (!auctionId) return;

    fetchAuction();
    fetchBids();

    // setupRealtime returns a cleanup function
    const cleanup = setupRealtime();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      cleanup(); // unsubscribe from channel
    };
  }, [auctionId]);

  // ── Fetch full auction with all joined data ──────────────────
  const fetchAuction = async () => {
    try {
      const { data, error } = await supabase
        .from("auctions")
        .select(`
          *,
          products (
            id,
            title,
            description,
            category,
            condition,
            material,
            dimension,
            weight,
            base_price,
            reserved_price,
            product_images (
              image_url,
              is_primary
            )
          ),
          sellers (
            id,
            user_id,
            business_name,
            profiles ( id, name )
          )
        `)
        .eq("id", auctionId)
        .single();

      if (error) throw error;

      setAuction(data);
      startTimer(data.end_time);

    } catch (err) {
    } finally {
      setLoading(false);
    }
  };

  // ── Fetch bids ────────────────────────────────────────────────
  const fetchBids = async () => {
    try {
      const { data, error } = await supabase
        .from("bids")
        .select(`
          id,
          bid_amount,
          bid_time,
          buyers (
            profiles ( name )
          )
        `)
        .eq("auction_id", auctionId)
        .order("bid_time", { ascending: false })
        .limit(20);

      if (error) throw error;
      setBids(data || []);

    } catch (err) {
      // Do nothing
    }
  };

  // ── Countdown timer ───────────────────────────────────────────
  const startTimer = (endTime) => {
    if (timerRef.current) clearInterval(timerRef.current);

    const calculate = () => {
      const now  = new Date();
      const end  = new Date(endTime);
      const diff = Math.max(0, Math.floor((end - now) / 1000));

      setTimeLeft({
        days:    Math.floor(diff / 86400),
        hours:   Math.floor((diff % 86400) / 3600),
        minutes: Math.floor((diff % 3600) / 60),
        seconds: diff % 60,
        total:   diff,
      });
    };

    calculate();
    timerRef.current = setInterval(calculate, 1000);
  };

  // ── Realtime subscription ─────────────────────────────────────
  const setupRealtime = () => {
    const channel = supabase
      .channel(`auction-${auctionId}`)

      // ── Auction row updated (pause, resume, end, highest_bid, auto-extend) ──
      .on(
        "postgres_changes",
        {
          event:  "UPDATE",
          schema: "public",
          table:  "auctions",
          filter: `id=eq.${auctionId}`,
        },
        (payload) => {
          // FIX: payload.new is a FLAT row — it has no joined data (products, sellers)
          // Spreading it directly would wipe out products/sellers/product_images
          // Instead: only update the flat columns, keep joined relations untouched
          setAuction((prev) => {
            if (!prev) return prev;
            return {
              ...prev,            // keep everything including joined products/sellers
              // Only overwrite the flat auction columns that actually changed:
              status:             payload.new.status,
              highest_bid:        payload.new.highest_bid,
              highest_bidder_id:  payload.new.highest_bidder_id,
              winner_id:          payload.new.winner_id,
              end_time:           payload.new.end_time,
              paused_by:          payload.new.paused_by,
              min_increment:      payload.new.min_increment,
              auto_extend:        payload.new.auto_extend,
              approval_status:    payload.new.approval_status,
            };
          });

          // Restart countdown if end_time changed (auto-extend feature)
          if (payload.new.end_time) {
            startTimer(payload.new.end_time);
          }
        }
      )

      // ── New bid inserted ──────────────────────────────────────
      .on(
        "postgres_changes",
        {
          event:  "INSERT",
          schema: "public",
          table:  "bids",
          filter: `auction_id=eq.${auctionId}`,
        },
        async (payload) => {
          // Fetch the new bid with buyer name (payload.new has no joined data)
          const { data } = await supabase
            .from("bids")
            .select(`
              id,
              bid_amount,
              bid_time,
              buyers (
                profiles ( name )
              )
            `)
            .eq("id", payload.new.id)
            .single();

          if (data) {
            // Prepend new bid and keep max 20
            setBids((prev) => [data, ...prev].slice(0, 20));
          }
        }
      )

      .subscribe();

    // Return cleanup function
    return () => supabase.removeChannel(channel);
  };

  return {
    auction,
    bids,
    loading,
    timeLeft,
    refetchAuction: fetchAuction,
  };
};