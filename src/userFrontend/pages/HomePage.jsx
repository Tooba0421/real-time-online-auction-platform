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

// ── Normalize Supabase auction to ProductCard shape ────────────────
const normalizeAuction = (auction, bidCounts) => {
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
    totalBids:      bidCounts[auction.id] || 0,
    bids_count:     bidCounts[auction.id] || 0,
    endTime:        auction.end_time,
    end_time:       auction.end_time,
    category:       product?.category,
    sellers:        auction.sellers,
  };
};

const HomePage = () => {
  const navigate     = useNavigate();
  const featuredRef  = useRef();
  const latestRef    = useRef();

  const [popularAuctions, setPopularAuctions] = useState([]);
  const [latestAuctions,  setLatestAuctions]  = useState([]);

  // FIX: Separate initial loading from background refresh
  // initialLoading = true only on first load (shows skeleton/spinner)
  // refreshing     = true on realtime updates (silent background refresh, no flicker)
  const [initialLoading, setInitialLoading] = useState(true);

  // ── Fetch auctions ─────────────────────────────────────────────
  // FIX: isInitial flag controls whether to show loading spinner
  // On realtime updates we pass isInitial=false so cards stay visible
  const fetchAuctions = async (isInitial = false) => {
    try {
      if (isInitial) setInitialLoading(true);

      // FIX: Single query — fetch auctions WITH bids count in one call
      // Supabase supports count() on related tables via select string
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
        .eq("approval_status", "approved")
        .limit(20);

      if (error) { return; }

      // Build bid counts from the joined bids array
      // bids is returned as an array so we just count the length
      const bidCounts = {};
      (data || []).forEach((a) => {
        bidCounts[a.id] = a.bids?.length || 0;
      });

      const normalized = (data || []).map((a) =>
        normalizeAuction(a, bidCounts)
      );

      // Popular = most bids first
      const popular = [...normalized]
        .sort((a, b) => b.totalBids - a.totalBids)
        .slice(0, 10);

      // Ending soon = soonest end_time first
      const latest = [...normalized]
        .sort((a, b) => new Date(a.end_time) - new Date(b.end_time))
        .slice(0, 10);

      setPopularAuctions(popular);
      setLatestAuctions(latest);

    } catch (err) {
    } finally {
      if (isInitial) setInitialLoading(false);
    }
  };

  // Initial fetch — show spinner
  useEffect(() => {
    fetchAuctions(true);
  }, []);

  // ── Realtime subscription ──────────────────────────────────────
  // FIX: Pass isInitial=false so realtime updates happen silently
  // Cards stay visible and just update their values — no flicker
  useEffect(() => {
    const channel = supabase
      .channel("home-auctions-realtime")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "auctions" },
        () => fetchAuctions(false) // silent refresh — no loading spinner
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "bids" },
        () => fetchAuctions(false) // silent refresh — no loading spinner
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  // ── Auto scroll ────────────────────────────────────────────────
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
        ) {
          featuredSlider.scrollTo({ left: 0, behavior: "smooth" });
        }
      }
      if (latestSlider) {
        latestSlider.scrollBy({ left: 320, behavior: "smooth" });
        if (
          latestSlider.scrollLeft + latestSlider.clientWidth >=
          latestSlider.scrollWidth - 10
        ) {
          latestSlider.scrollTo({ left: 0, behavior: "smooth" });
        }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [popularAuctions]);

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
            <button
              className="banner-button primary"
              onClick={() => navigate("/auctions")}
            >
              View Auctions
            </button>
            <button
              className="banner-button secondary"
              onClick={() => navigate("/auctions?type=popular")}
            >
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
              onClick={() =>
                navigate(`/category/${encodeURIComponent(category.name)}`)
              }
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
        ) : (
          <>
            <div className="slider-wrapper">
              <div className="card-slider" ref={featuredRef}>
                {popularAuctions.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    products={popularAuctions}
                  />
                ))}
              </div>
            </div>
            <div className="slider-controls">
              <button
                onClick={() =>
                  featuredRef.current?.scrollBy({ left: -320, behavior: "smooth" })
                }
              >
                <FaArrowLeft />
              </button>
              <button
                onClick={() =>
                  featuredRef.current?.scrollBy({ left: 320, behavior: "smooth" })
                }
              >
                <FaArrowRight />
              </button>
            </div>
          </>
        )}
      </section>

      {/* Ending Soon */}
      <section className="latest auction-section">
        <h2 className="auction-heading">Ending Soon</h2>

        {initialLoading ? (
          <div style={{ textAlign: "center", padding: "40px", color: "#999" }}>
            Loading auctions...
          </div>
        ) : latestAuctions.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px", color: "#999" }}>
            No live auctions available.
          </div>
        ) : (
          <>
            <div className="slider-wrapper">
              <div className="card-slider" ref={latestRef}>
                {latestAuctions.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    products={latestAuctions}
                  />
                ))}
              </div>
            </div>
            <div className="slider-controls">
              <button
                onClick={() =>
                  latestRef.current?.scrollBy({ left: -320, behavior: "smooth" })
                }
              >
                <FaArrowLeft />
              </button>
              <button
                onClick={() =>
                  latestRef.current?.scrollBy({ left: 320, behavior: "smooth" })
                }
              >
                <FaArrowRight />
              </button>
            </div>
          </>
        )}
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