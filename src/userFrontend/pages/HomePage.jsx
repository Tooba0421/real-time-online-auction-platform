import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaArrowLeft, FaArrowRight,
  FaClock, FaShieldAlt, FaClipboardList
} from "react-icons/fa";
import { supabase } from "../../supabase/supabase";
import { categories } from "../data/categories";
import Header from "../components/Header";
import Footer from "../components/Footer";
import ProductCard from "../components/ProductCard";
import banner from "../../assets/banner.jpg";
import "../styles/homepage.css";

const toSlug = (title) =>
  title?.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "";

// Normalize Supabase auction row to ProductCard shape
const normalizeAuction = (auction) => {
  const product   = auction.products;
  const primaryImg =
    product?.product_images?.find((img) => img.is_primary) ||
    product?.product_images?.[0];

  return {
    id:             auction.id,
    auctionId:      auction.id,
    title:          product?.title || "—",
    slug:           toSlug(product?.title),
    seller:
      auction.sellers?.profiles?.name ||
      auction.sellers?.business_name  || "—",
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

// Shared select string
const AUCTION_SELECT = `
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
`;

const BASE_FILTER = { status: "live", approval_status: "approved" };

const HomePage = () => {
  const navigate    = useNavigate();
  const featuredRef = useRef();
  const latestRef   = useRef();

  const [popularAuctions, setPopularAuctions] = useState([]);
  const [endingSoonAuctions, setEndingSoonAuctions] = useState([]);
  const [initialLoading, setInitialLoading]   = useState(true);

  // ── Fetch popular — most bids, no specific end_time order ────────
  const fetchPopular = async () => {
    const { data, error } = await supabase
      .from("auctions")
      .select(AUCTION_SELECT)
      .eq("status", "live")
      .eq("approval_status", "approved")
      .order("highest_bid", { ascending: false })
      .limit(10);

    if (error) { console.error("fetchPopular error:", error); return; }

    const normalized = (data || []).map(normalizeAuction);
    // Sort by bid count client-side for most accurate ranking
    setPopularAuctions(
      normalized.sort((a, b) => b.totalBids - a.totalBids)
    );
  };

  // ── Fetch ending soon — ordered by end_time ascending ────────────
  // This ensures we get the 10 auctions ending soonest, not just
  // the soonest from an arbitrary 20
  const fetchEndingSoon = async () => {
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from("auctions")
      .select(AUCTION_SELECT)
      .eq("status", "live")
      .eq("approval_status", "approved")
      .gt("end_time", now)           // only auctions not yet ended
      .order("end_time", { ascending: true })  // soonest first
      .limit(10);

    if (error) { console.error("fetchEndingSoon error:", error); return; }

    setEndingSoonAuctions((data || []).map(normalizeAuction));
  };

  // ── Initial fetch ─────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      setInitialLoading(true);
      await Promise.all([fetchPopular(), fetchEndingSoon()]);
      setInitialLoading(false);
    };
    init();
  }, []);

  // ── Realtime — silent background refresh ──────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel("home-auctions-realtime")
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "auctions" },
        () => { fetchPopular(); fetchEndingSoon(); }
      )
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "bids" },
        () => { fetchPopular(); fetchEndingSoon(); }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  // ── Auto scroll ───────────────────────────────────────────────────
  useEffect(() => {
    if (popularAuctions.length === 0) return;

    const featuredSlider = featuredRef.current;
    const latestSlider   = latestRef.current;

    const interval = setInterval(() => {
      if (featuredSlider) {
        featuredSlider.scrollBy({ left: 320, behavior: "smooth" });
        if (
          featuredSlider.scrollLeft + featuredSlider.clientWidth >=
          featuredSlider.scrollWidth - 10
        ) featuredSlider.scrollTo({ left: 0, behavior: "smooth" });
      }
      if (latestSlider) {
        latestSlider.scrollBy({ left: 320, behavior: "smooth" });
        if (
          latestSlider.scrollLeft + latestSlider.clientWidth >=
          latestSlider.scrollWidth - 10
        ) latestSlider.scrollTo({ left: 0, behavior: "smooth" });
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [popularAuctions]);

  const renderSlider = (auctions, ref) => (
    <>
      <div className="slider-wrapper">
        <div className="card-slider" ref={ref}>
          {auctions.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              products={auctions}
            />
          ))}
        </div>
      </div>
      <div className="slider-controls">
        <button onClick={() => ref.current?.scrollBy({ left: -320, behavior: "smooth" })}>
          <FaArrowLeft />
        </button>
        <button onClick={() => ref.current?.scrollBy({ left: 320, behavior: "smooth" })}>
          <FaArrowRight />
        </button>
      </div>
    </>
  );

  return (
    <>
      <Header />

      {/* Banner */}
      <section className="banner-section">
        <img src={banner} alt="Banner" className="banner-image" />
        <div className="banner-overlay" />
        <div className="banner-content">
          <h1 className="banner-title">
            Bid on the finest collectibles & gold today!
          </h1>
          <p className="banner-subtext">
            Join live auctions and win exclusive items.
          </p>
          <div className="banner-buttons">
            <button className="banner-button primary" onClick={() => navigate("/auctions")}>
              View Auctions
            </button>
            <button className="banner-button secondary" onClick={() => navigate("/auctions")}>
              Start Bidding
            </button>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="category-section">
        <div className="category-container">
          {categories.map((category, index) => (
            <div
              key={index}
              className="category-card"
              onClick={() => navigate(`/category/${encodeURIComponent(category.name)}`)}
            >
              <div className="category-image">
                <img src={category.image} alt={category.name} />
              </div>
              <span className="category-name">{category.name}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Popular Auctions */}
      <section className="popular auction-section">
        <h2 className="auction-heading">Popular Auctions</h2>
        {initialLoading ? (
          <div style={{ textAlign: "center", padding: "40px", color: "#999" }}>
            Loading auctions...
          </div>
        ) : popularAuctions.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px", color: "#999" }}>
            No live auctions available.
          </div>
        ) : renderSlider(popularAuctions, featuredRef)}
      </section>

      {/* Ending Soon */}
      <section className="latest auction-section">
        <h2 className="auction-heading">Ending Soon</h2>
        {initialLoading ? (
          <div style={{ textAlign: "center", padding: "40px", color: "#999" }}>
            Loading auctions...
          </div>
        ) : endingSoonAuctions.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px", color: "#999" }}>
            No live auctions available.
          </div>
        ) : renderSlider(endingSoonAuctions, latestRef)}
      </section>

      {/* Why Choose */}
      <section className="why-section">
        <h2>Why Choose Auctions?</h2>
        <div className="why-container">
          <div className="why-card">
            <div className="why-icon"><FaClock /></div>
            <h3>Real-time Auctions</h3>
            <p>Get better offers through live bidding.</p>
          </div>
          <div className="why-card">
            <div className="why-icon"><FaShieldAlt /></div>
            <h3>Secure Bidding</h3>
            <p>Our platform ensures safe and transparent auctions for all users.</p>
          </div>
          <div className="why-card">
            <div className="why-icon"><FaClipboardList /></div>
            <h3>Easy Listing & Tracking</h3>
            <p>Tools to list and manage all your sales.</p>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
};

export default HomePage;