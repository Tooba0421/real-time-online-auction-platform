import { useLayoutEffect, useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";
import { supabase } from "../../supabase/supabase";
import Header from "../components/Header";
import Footer from "../components/Footer";
import ProductCard from "../components/ProductCard";
import "../styles/common.css";
import "../styles/auctionsPage.css";

const normalizeAuction = (auction) => {
  const product = auction.products;
  const primaryImg =
    product?.product_images?.find((img) => img.is_primary) ||
    product?.product_images?.[0];

  return {
    id:             auction.id,
    auctionId:      auction.id,
    title:          product?.title || "—",
    seller:
      auction.sellers?.profiles?.name ||
      auction.sellers?.business_name  ||
      "—",
    image:          primaryImg?.image_url || null,
    product_images: product?.product_images || [],
    currentBid:     auction.highest_bid || 0,
    highest_bid:    auction.highest_bid || 0,
    totalBids:      auction.bids?.length || 0,
    bids_count:     auction.bids?.length || 0,
    endTime:        auction.end_time,
    end_time:       auction.end_time,
    category:       product?.category,
    sellers:        auction.sellers,
  };
};

const AuctionsPage = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [auctions, setAuctions] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, []);

  const queryParams = new URLSearchParams(location.search);
  const type = queryParams.get("type");

  let pageTitle = "All Auctions";
  if (type === "popular") pageTitle = "Popular Auctions";
  else if (type === "latest") pageTitle = "Latest Auctions";

  // ── Fetch — isInitial controls whether spinner shows ──────────
  const fetchAuctions = async (isInitial = false) => {
    try {
      if (isInitial) setInitialLoading(true);

      // Single query — bids joined so no second round-trip needed
      const { data, error } = await supabase
        .from("auctions")
        .select(`
          id,
          highest_bid,
          end_time,
          created_at,
          products (
            id,
            title,
            category,
            base_price,
            product_images ( image_url, is_primary )
          ),
          sellers (
            business_name,
            profiles ( name )
          ),
          bids ( id )
        `)
        .eq("status", "live")
        .eq("approval_status", "approved");

      if (error) { return; }

      let normalized = (data || []).map((a) => normalizeAuction(a));

      // Sort based on page type
      if (type === "popular") {
        // Most bids first
        normalized = normalized.sort((a, b) => b.totalBids - a.totalBids);
      } else if (type === "latest") {
        // Most recently created first
        normalized = normalized.sort(
          (a, b) => new Date(b.created_at) - new Date(a.created_at)
        );
      }
      // type === null → All Auctions — no sort, DB order

      setAuctions(normalized);

    } catch (err) {
    } finally {
      if (isInitial) setInitialLoading(false);
    }
  };

  // Initial fetch on mount and whenever type changes
  useEffect(() => {
    fetchAuctions(true);
  }, [type]);

  // ── Realtime subscription ─────────────────────────────────────
  // Silent refresh — no spinner, cards stay visible and update values
  useEffect(() => {
    const channel = supabase
      .channel("auctions-page-realtime")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "auctions" },
        () => fetchAuctions(false)
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "bids" },
        () => fetchAuctions(false)
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [type]); // re-subscribe when type changes so fetchAuctions closure is current

  return (
    <>
      <Header />

      <div className="auctions-page">
        <div className="page-header">
          <button
            className="back-btn"
            onClick={() => {
              if (window.history.length > 1) navigate(-1);
              else navigate("/");
            }}
          >
            <FaArrowLeft />
          </button>
          <h2 className="page-heading">{pageTitle}</h2>
        </div>

        {initialLoading ? (
          <div style={{ textAlign: "center", padding: "60px", color: "#999" }}>
            Loading auctions...
          </div>
        ) : auctions.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px", color: "#999" }}>
            No live auctions found.
          </div>
        ) : (
          <div className="auctions-grid">
            {auctions.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                products={auctions}
              />
            ))}
          </div>
        )}
      </div>

      <Footer />
    </>
  );
};

export default AuctionsPage;