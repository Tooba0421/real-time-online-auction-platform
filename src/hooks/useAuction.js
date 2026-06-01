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

    const cleanup = setupRealtime();

    return () => {
      stopTimer();   // ✅ always clear timer on unmount
      cleanup();
    };
  }, [auctionId]);

  // ── Stop timer helper ─────────────────────────────────────────
  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // ── Fetch full auction ────────────────────────────────────────
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

      // ✅ Only start timer if auction is live
      if (data.status === "live") {
        startTimer(data.end_time);
      } else {
        // Paused or ended — no timer needed
        stopTimer();
        setTimeLeft(null);
      }

    } catch (err) {
      console.error("fetchAuction error:", err);
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
      console.error("fetchBids error:", err);
    }
  };

  // ── Countdown timer ───────────────────────────────────────────
  const startTimer = (endTime) => {
    stopTimer(); // clear any existing interval first

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

      // ── Auction row updated (pause, resume, end, bid update, auto-extend) ──
      .on(
        "postgres_changes",
        {
          event:  "UPDATE",
          schema: "public",
          table:  "auctions",
          filter: `id=eq.${auctionId}`,
        },
        (payload) => {
          const newStatus  = payload.new.status;
          const newEndTime = payload.new.end_time;

          // Update auction state — keep joined relations (products/sellers)
          // payload.new is flat so we only overwrite flat columns
          setAuction((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              status:            newStatus,
              highest_bid:       payload.new.highest_bid,
              highest_bidder_id: payload.new.highest_bidder_id,
              winner_id:         payload.new.winner_id,
              end_time:          newEndTime,
              paused_by:         payload.new.paused_by,
              min_increment:     payload.new.min_increment,
              auto_extend:       payload.new.auto_extend,
              approval_status:   payload.new.approval_status,
            };
          });

          // ✅ Timer logic based on new status:
          if (newStatus === "live") {
            // Live — start or restart timer (handles resume + auto-extend)
            startTimer(newEndTime);
          } else {
            // Paused or ended — stop timer immediately and clear display
            stopTimer();
            setTimeLeft(null);
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
          // Fetch new bid with buyer name — payload.new has no joined data
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
            setBids((prev) => [data, ...prev].slice(0, 20));
          }
        }
      )

      .subscribe();

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