import { useState, useRef, useLayoutEffect, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  FaArrowLeft, FaArrowRight, FaClock,
  FaTag, FaGavel, FaBoxOpen
} from "react-icons/fa";
import toast from "react-hot-toast";
import { useAuthContext } from "../../context/AuthContext";
import { useAuction } from "../../hooks/useAuction";
import { validateBid, placeBid, fetchBuyerRecord } from "../../utils/bidHelper";
import { supabase } from "../../supabase/supabase";
import LoginModal from "../components/LoginModal";
import SignupModal from "../components/SignupModal";
import CnicModal from "../components/CnicModal";
import Header from "../components/Header";
import Footer from "../components/Footer";
import "../styles/productDetailPage.css";

// ── Slug helpers ───────────────────────────────────────────
const toSlug = (title) =>
  title
    ?.toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "";

// ── Countdown display ──────────────────────────────────────
const CountdownTimer = ({ timeLeft }) => {
  if (!timeLeft) return null;

  const isUrgent = timeLeft.total < 300;

  return (
    <div className={`countdown-grid ${isUrgent ? "urgent" : ""}`}>
      {timeLeft.days > 0 && (
        <div className="countdown-block">
          <strong>{timeLeft.days}</strong>
          <span>Days</span>
        </div>
      )}
      <div className="countdown-block">
        <strong>{String(timeLeft.hours).padStart(2, "0")}</strong>
        <span>Hours</span>
      </div>
      <div className="countdown-block">
        <strong>{String(timeLeft.minutes).padStart(2, "0")}</strong>
        <span>Min</span>
      </div>
      <div className="countdown-block">
        <strong>{String(timeLeft.seconds).padStart(2, "0")}</strong>
        <span>Sec</span>
      </div>
    </div>
  );
};

// ── useAuctionBySlug — fetch auction using product title slug ──
const useAuctionBySlug = (productSlug) => {
  const [auctionId, setAuctionId] = useState(null);
  const [slugLoading, setSlugLoading] = useState(true);

  useEffect(() => {
    if (!productSlug) return;

    const resolveAuctionId = async () => {
      try {
        setSlugLoading(true);

        // Fetch all live auctions with product titles to match slug
        const { data, error } = await supabase
          .from("auctions")
          .select(`
            id,
            products ( title )
          `)
          .eq("status", "live")
          .eq("approval_status", "approved");

        if (error || !data) return;

        const match = data.find(
          (a) => toSlug(a.products?.title) === productSlug
        );

        if (match) setAuctionId(match.id);

      } catch (err) {
        console.error("Slug resolve error:", err);
      } finally {
        setSlugLoading(false);
      }
    };

    resolveAuctionId();
  }, [productSlug]);

  return { auctionId, slugLoading };
};

// ── Related auctions ───────────────────────────────────────
const useRelatedAuctions = (auctionId, category) => {
  const [related, setRelated] = useState([]);

  useEffect(() => {
    if (!category || !auctionId) return;

    const fetchRelated = async () => {
      const { data } = await supabase
        .from("auctions")
        .select(`
          id,
          highest_bid,
          end_time,
          products (
            title,
            category,
            product_images ( image_url, is_primary )
          )
        `)
        .eq("status", "live")
        .eq("approval_status", "approved")
        .neq("id", auctionId)
        .limit(8);

      // Same category first, then others
      const sorted = (data || []).sort((a, b) => {
        const aMatch = a.products?.category === category ? -1 : 1;
        const bMatch = b.products?.category === category ? -1 : 1;
        return aMatch - bMatch;
      });

      setRelated(sorted);
    };

    fetchRelated();
  }, [auctionId, category]);

  return related;
};

// ── Main component ─────────────────────────────────────────
const ProductDetailPage = () => {

  const { productSlug, id } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuthContext();
  const featuredRef = useRef();

  // Support both old fake route (/product/:id) and new real route (/auction/:productSlug)
  const isRealAuction = !!productSlug;

  const { auctionId, slugLoading } = useAuctionBySlug(
    isRealAuction ? productSlug : null
  );

  const { auction, bids, loading, timeLeft } = useAuction(
    isRealAuction ? auctionId : null
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const [bidAmount, setBidAmount] = useState("");
  const [bidding, setBidding] = useState(false);

  const [showLogin, setShowLogin] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const [showCnic, setShowCnic] = useState(false);

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [productSlug, id]);

  const product = auction?.products;
  const seller = auction?.sellers;
  const category = product?.category;

  const relatedAuctions = useRelatedAuctions(auctionId, category);

  // Sort images — primary first
  const images = product?.product_images
    ? [...product.product_images]
        .sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0))
        .map((img) => img.image_url)
    : [];

  const nextImage = () =>
    setCurrentIndex((prev) => (prev + 1) % images.length);
  const prevImage = () =>
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));

  const minNextBid =
    (auction?.highest_bid || 0) + (auction?.min_increment || 0);

  // ── Handle bid ─────────────────────────────────────────
  const handleBid = async () => {
    // Step 1: Check login
    if (!user) {
      toast.error("Please login to place a bid");
      setShowLogin(true);
      return;
    }

    // Step 2: Check role
    if (profile?.role !== "buyer") {
      const buyerRecord = await fetchBuyerRecord(user.id);

      if (!buyerRecord) {
        toast.error("Please submit your CNIC to become a verified buyer");
        setShowCnic(true);
        return;
      }

      if (buyerRecord.is_verified === "pending") {
        toast.error("Your CNIC is under review. You can bid once approved.");
        return;
      }

      if (buyerRecord.is_verified === "rejected") {
        toast.error("Your CNIC was rejected. Please resubmit.");
        setShowCnic(true);
        return;
      }

      toast.error("You need to verify your identity before placing bids");
      setShowCnic(true);
      return;
    }

    // Step 3: Validate bid
    const validation = validateBid({
      bidAmount,
      highestBid: auction?.highest_bid || 0,
      minIncrement: auction?.min_increment || 0,
      auctionStatus: auction?.status,
      userRole: profile?.role,
      userStatus: profile?.status,
    });

    if (!validation.valid) {
      toast.error(validation.message);
      return;
    }

    // Step 4: Place bid
    try {
      setBidding(true);

      const buyerRecord = await fetchBuyerRecord(user.id);
      if (!buyerRecord) {
        toast.error("Buyer record not found. Please contact support.");
        return;
      }

      await placeBid({
        auctionId,
        buyerId: buyerRecord.id,
        bidAmount: Number(bidAmount),
      });

      toast.success(
        `Bid of PKR ${Number(bidAmount).toLocaleString()} placed successfully!`
      );
      setBidAmount("");

    } catch (err) {
      console.error("Bid error:", err);
      toast.error("Failed to place bid. Please try again.");
    } finally {
      setBidding(false);
    }
  };

  // ── Old fake data route (keep working) ─────────────────
  if (!isRealAuction) {
    return (
      <>
        <Header />
        <div className="detail-not-found">
          <h2>This product is no longer available</h2>
          <p>Browse our live auctions instead.</p>
          <button className="back-btn" onClick={() => navigate("/auctions")}>
            <FaArrowLeft /> View Live Auctions
          </button>
        </div>
        <Footer />
      </>
    );
  }

  // ── Loading ────────────────────────────────────────────
  if (slugLoading || loading) {
    return (
      <>
        <Header />
        <div className="detail-loading">
          <div className="detail-spinner" />
          <p>Loading auction...</p>
        </div>
        <Footer />
      </>
    );
  }

  // ── Not found ──────────────────────────────────────────
  if (!auction || !product) {
    return (
      <>
        <Header />
        <div className="detail-not-found">
          <h2>Auction not found</h2>
          <p>This auction may have ended or doesn't exist.</p>
          <button className="back-btn" onClick={() => navigate("/auctions")}>
            <FaArrowLeft /> View Live Auctions
          </button>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header />

      <div className="product-detail">

        {/* Back button */}
        <div className="page-header">
          <button className="back-btn" onClick={() => navigate(-1)}>
            <FaArrowLeft />
          </button>
          <h2 className="page-heading">Auction Detail</h2>
        </div>

        <div className="product-detail-container">

          {/* ── LEFT: Gallery ── */}
          <div className="product-gallery">
            {images.length > 0 ? (
              <>
                <div className="main-image-wrapper">
                  <img
                    src={images[currentIndex]}
                    alt={product.title}
                    className="main-image"
                  />
                  {images.length > 1 && (
                    <>
                      <button className="img-arrow left" onClick={prevImage}>
                        <FaArrowLeft />
                      </button>
                      <button className="img-arrow right" onClick={nextImage}>
                        <FaArrowRight />
                      </button>
                    </>
                  )}
                </div>

                <div className="thumbnail-row">
                  {images.map((img, i) => (
                    <img
                      key={i}
                      src={img}
                      alt={`${product.title} ${i + 1}`}
                      className={i === currentIndex ? "active-thumb" : ""}
                      onClick={() => setCurrentIndex(i)}
                    />
                  ))}
                </div>
              </>
            ) : (
              <div className="no-image">No images available</div>
            )}
          </div>

          {/* ── RIGHT: Product Info ── */}
          <div className="product-info">

            {/* Badges */}
            <div className="auction-status-row">
              <span className="live-badge">● Live</span>
              <span className="category-badge">
                <FaTag /> {product.category}
              </span>
              {product.condition && (
                <span className="condition-badge">
                  <FaBoxOpen /> {product.condition}
                </span>
              )}
            </div>

            {/* Title */}
            <h1 className="product-title">{product.title}</h1>

            {/* Seller */}
            <div className="seller-row">
              <div className="seller-avatar">
                {(seller?.profiles?.name || seller?.business_name || "S")
                  .charAt(0)
                  .toUpperCase()}
              </div>
              <div>
                <span className="seller-label">Sold by</span>
                <p className="seller-name">
                  {seller?.profiles?.name ||
                    seller?.business_name ||
                    "—"}
                </p>
              </div>
            </div>

            {/* Bid box */}
            <div className="bid-box">
              <div className="bid-box-left">
                <p className="label">Current Highest Bid</p>
                <h2 className="current-bid">
                  PKR {(auction.highest_bid || 0).toLocaleString()}
                </h2>
                <p className="bid-count-text">
                  <FaGavel /> {bids.length} bid
                  {bids.length !== 1 ? "s" : ""} placed
                </p>
              </div>

              <div className="bid-box-right">
                <p className="label">
                  <FaClock /> Time Remaining
                </p>
                <CountdownTimer timeLeft={timeLeft} />
              </div>
            </div>

            {/* Min bid note */}
            <p className="min-bid-note">
              Minimum next bid:{" "}
              <strong>PKR {minNextBid.toLocaleString()}</strong>
              {auction.min_increment > 0 && (
                <span className="increment-note">
                  {" "}
                  (increment: PKR {auction.min_increment.toLocaleString()})
                </span>
              )}
            </p>

            {/* Bid input */}
            <div className="bid-section">
              <div className="bid-input-wrapper">
                <span className="bid-currency">PKR</span>
                <input
                  className="bid-input"
                  type="number"
                  placeholder={`Enter bid (min ${minNextBid.toLocaleString()})`}
                  value={bidAmount}
                  onChange={(e) => setBidAmount(e.target.value)}
                  disabled={bidding}
                />
              </div>

              <button
                className="place-bid-btn"
                onClick={handleBid}
                disabled={bidding}
              >
                {bidding ? "Placing Bid..." : "Place Bid"}
              </button>
            </div>

            {/* Base price */}
            <p className="price-info">
              Starting Price: PKR {product.base_price?.toLocaleString()}
            </p>

          </div>
        </div>

        {/* ── EXTRA SECTION ── */}
        <div className="product-extra-section">

          {/* Detailed info */}
          <div className="key-info">
            <h3>Detailed Information</h3>

            {product.description && (
              <p className="product-description">{product.description}</p>
            )}

            <div className="specs-grid">
              {product.condition && (
                <div className="spec-item">
                  <span className="spec-label">Condition</span>
                  <span className="spec-value">{product.condition}</span>
                </div>
              )}
              {product.material && (
                <div className="spec-item">
                  <span className="spec-label">Material</span>
                  <span className="spec-value">{product.material}</span>
                </div>
              )}
              {product.dimension && (
                <div className="spec-item">
                  <span className="spec-label">Dimensions</span>
                  <span className="spec-value">{product.dimension}</span>
                </div>
              )}
              {product.weight && (
                <div className="spec-item">
                  <span className="spec-label">Weight</span>
                  <span className="spec-value">{product.weight} kg</span>
                </div>
              )}
              <div className="spec-item">
                <span className="spec-label">Category</span>
                <span className="spec-value">{product.category}</span>
              </div>
              <div className="spec-item">
                <span className="spec-label">Base Price</span>
                <span className="spec-value">
                  PKR {product.base_price?.toLocaleString()}
                </span>
              </div>
              {product.reserved_price && (
                <div className="spec-item">
                  <span className="spec-label">Reserve Price</span>
                  <span className="spec-value">
                    PKR {product.reserved_price?.toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Bid history */}
          <div className="bid-history">
            <h3>Bid History</h3>

            {bids.length === 0 ? (
              <p className="no-bids">No bids placed yet. Be the first!</p>
            ) : (
              bids.map((bid, i) => {
                const name =
                  bid.buyers?.profiles?.name || "Anonymous";
                const isHighest = i === 0;
                return (
                  <div
                    className={`bid-item ${isHighest ? "top-bid" : ""}`}
                    key={bid.id}
                  >
                    <div className="bid-user">
                      <div
                        className="avatar"
                        style={{
                          background: isHighest ? "#D4AF37" : "#6B7280",
                        }}
                      >
                        {name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <strong>{name}</strong>
                        <p>
                          {new Date(bid.bid_time).toLocaleString("en-PK", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                    <div
                      className={`bid-amount ${
                        isHighest ? "top-bid-amount" : ""
                      }`}
                    >
                      PKR {bid.bid_amount.toLocaleString()}
                      {isHighest && (
                        <span className="highest-tag">Highest</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ── Related Auctions ── */}
      {relatedAuctions.length > 0 && (
        <div className="auction-section related">
          <h2 className="related-heading">You Might Also Like</h2>
          <div className="related-wrapper">
            <div className="related-grid" ref={featuredRef}>
              {relatedAuctions.map((a) => {
                const primaryImg =
                  a.products?.product_images?.find(
                    (img) => img.is_primary
                  ) || a.products?.product_images?.[0];

                return (
                  <div
                    key={a.id}
                    className="related-card"
                    onClick={() =>
                      navigate(
                        `/auction/${toSlug(a.products?.title)}`
                      )
                    }
                  >
                    {primaryImg ? (
                      <img
                        src={primaryImg.image_url}
                        alt={a.products?.title}
                        className="related-card-img"
                      />
                    ) : (
                      <div className="related-no-img">No Image</div>
                    )}
                    <div className="related-card-info">
                      <p className="related-card-title">
                        {a.products?.title}
                      </p>
                      <p className="related-card-bid">
                        PKR {(a.highest_bid || 0).toLocaleString()}
                      </p>
                      <span className="related-card-category">
                        {a.products?.category}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {showLogin && (
        <LoginModal
          closeModal={() => setShowLogin(false)}
          openSignup={() => {
            setShowLogin(false);
            setShowSignup(true);
          }}
          openForgotPassword={() => setShowLogin(false)}
        />
      )}
      {showSignup && (
        <SignupModal
          closeModal={() => setShowSignup(false)}
          openLogin={() => {
            setShowSignup(false);
            setShowLogin(true);
          }}
        />
      )}
      {showCnic && (
        <CnicModal closeModal={() => setShowCnic(false)} />
      )}

      <Footer />
    </>
  );
};

export default ProductDetailPage;