import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaHeart, FaRegHeart } from "react-icons/fa";
import { useFavorites } from "../components/FavoritesContext";
import "../styles/productcard.css";

const ProductCard = ({ product, products }) => {
  const navigate = useNavigate();
  const [timeLeft, setTimeLeft] = useState({});
  const { toggleFavorite, isFavorite } = useFavorites();

  // ── Normalize both fake data and real Supabase auction data ──
  const isRealAuction = !!product.auctionId || !!product.end_time;

  const title = product.title || "—";
  const seller =
    product.seller ||
    product.sellerName ||
    product.sellers?.profiles?.name ||
    product.sellers?.business_name ||
    "—";

  const currentBid = product.currentBid ?? product.highest_bid ?? 0;
  const totalBids = product.totalBids ?? product.bids_count ?? 0;

  // Image — real auction uses product_images array, fake uses product.image
  const primaryImg = product.product_images?.find((img) => img.is_primary)
    || product.product_images?.[0];
  const image = product.image || primaryImg?.image_url || null;

  // End time
  const endTime = product.endTime || product.end_time;

  // Slug for real auction navigation
  const toSlug = (t) =>
    t?.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "";

  useEffect(() => {
    if (!endTime) return;

    const calculateTimeLeft = () => {
      const difference = new Date(endTime) - new Date();
      if (difference <= 0) return {};
      return {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60),
      };
    };

    setTimeLeft(calculateTimeLeft());
    const timer = setInterval(() => setTimeLeft(calculateTimeLeft()), 1000);
    return () => clearInterval(timer);
  }, [endTime]);

  const goToDetail = () => {
    if (isRealAuction) {
      // Navigate using product title slug for real auctions
      navigate(`/auction/${toSlug(title)}`);
    } else {
      // Old fake data navigation
      navigate(`/product/${product.id}`, {
        state: { product, products },
      });
    }
  };

  return (
    <div className="product-card">

      <div className="image-wrapper">

        <div
          className="favorite-icon"
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorite(product);
          }}
        >
          {isFavorite(product.id) ? (
            <FaHeart className="heart filled" />
          ) : (
            <FaRegHeart className="heart" />
          )}
        </div>

        {image ? (
          <img src={image} alt={title} onClick={goToDetail} />
        ) : (
          <div
            onClick={goToDetail}
            style={{
              width: "100%",
              height: "200px",
              background: "#f0f0f0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#999",
              cursor: "pointer",
              borderRadius: "8px",
            }}
          >
            No Image
          </div>
        )}

        <div className="timer">
          <div>
            <strong>{timeLeft.days || 0}</strong>
            <span>Days</span>
          </div>
          <div>
            <strong>{timeLeft.hours || 0}</strong>
            <span>Hours</span>
          </div>
          <div>
            <strong>{timeLeft.minutes || 0}</strong>
            <span>Minutes</span>
          </div>
          <div>
            <strong>{timeLeft.seconds || 0}</strong>
            <span>Seconds</span>
          </div>
        </div>

      </div>

      <div className="card-content">

        <h3>{title}</h3>
        <p className="seller">By {seller}</p>

        <div className="bid-section">
          <div className="bid-info">
            <p className="bid-label">Current Bid</p>
            <p className="bid-price">
              PKR {currentBid.toLocaleString()}
              <span className="bid-count">({totalBids} bids)</span>
            </p>
          </div>
          <button className="bid-btn" onClick={goToDetail}>
            Place Bid
          </button>
        </div>

      </div>
    </div>
  );
};

export default ProductCard;