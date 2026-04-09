import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaHeart, FaRegHeart } from "react-icons/fa";
import { useFavorites } from "../components/FavoritesContext";
import "../styles/productcard.css";

const ProductCard = ({ product, products }) => {

  const navigate = useNavigate();
  const [timeLeft, setTimeLeft] = useState({});
  const { toggleFavorite, isFavorite } = useFavorites();

  useEffect(() => {

    const calculateTimeLeft = () => {

      const difference = new Date(product.endTime) - new Date();
      let time = {};

      if (difference > 0) {

        time = {
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60),
        };

      }

      return time;

    };

    setTimeLeft(calculateTimeLeft());

    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);

  }, [product.endTime]);

  const goToDetail = () => {

    navigate(`/product/${product.id}`, {
      state: { product, products }
    });

  };

  return (
    <div className="product-card">

      <div className="image-wrapper">

        <div className="favorite-icon" onClick={(e) => {
          e.stopPropagation(); // prevent navigation
          toggleFavorite(product);
        }}>
          {isFavorite(product.id) ? (
            <FaHeart className="heart filled" />
          ) : (
            <FaRegHeart className="heart" />
          )}
        </div>
        
        <img src={product.image} alt={product.title} onClick={goToDetail} />

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


        <h3>{product.title}</h3>
        <p className="seller">By {product.seller}</p>

        <div className="bid-section">

          <div className="bid-info">
            <p className="bid-label">Current Bid</p>

            <p className="bid-price">
              PKR {product.currentBid.toLocaleString()}
              <span className="bid-count">({product.totalBids} bids)</span>
            </p>
          </div>

          <button
            className="bid-btn"
            onClick={goToDetail}
          >
            Place Bid
          </button>

        </div>

      </div>

    </div>
  );
};

export default ProductCard;