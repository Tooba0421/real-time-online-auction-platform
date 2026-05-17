import { useState, useEffect, useRef } from "react";
import { supabase } from "../supabase/supabase";

export const useAuction = (auctionId) => {

  const [auction, setAuction] = useState(null);
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!auctionId) return;
    fetchAuction();
    fetchBids();
    setupRealtime();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [auctionId]);

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
            business_name,
            profiles ( name )
          )
        `)
        .eq("id", auctionId)
        .single();

      if (error) throw error;
      setAuction(data);
      startTimer(data.end_time);

    } catch (err) {
      console.error("Error fetching auction:", err);
    } finally {
      setLoading(false);
    }
  };

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
      console.error("Error fetching bids:", err);
    }
  };

  const startTimer = (endTime) => {
    if (timerRef.current) clearInterval(timerRef.current);

    const calculate = () => {
      const now = new Date();
      const end = new Date(endTime);
      const diff = Math.max(0, Math.floor((end - now) / 1000));

      const days = Math.floor(diff / 86400);
      const hours = Math.floor((diff % 86400) / 3600);
      const minutes = Math.floor((diff % 3600) / 60);
      const seconds = diff % 60;

      setTimeLeft({ days, hours, minutes, seconds, total: diff });
    };

    calculate();
    timerRef.current = setInterval(calculate, 1000);
  };

  const setupRealtime = () => {
    const channel = supabase
      .channel(`auction-${auctionId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "auctions",
          filter: `id=eq.${auctionId}`,
        },
        (payload) => {
          // Update auction data realtime (highest bid, status, end_time)
          setAuction((prev) => ({ ...prev, ...payload.new }));
          // Restart timer if end_time changed (auto-extend)
          startTimer(payload.new.end_time);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "bids",
          filter: `auction_id=eq.${auctionId}`,
        },
        async (payload) => {
          // Fetch full bid with buyer name
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