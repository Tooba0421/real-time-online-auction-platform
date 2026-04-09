import { useLocation, useNavigate } from "react-router-dom";
import { useRef, useLayoutEffect, useState } from "react";
import { FaArrowLeft, FaArrowRight } from "react-icons/fa";
import Header from "../components/Header";
import Footer from "../components/Footer";
import ProductCard from "../components/ProductCard";
import "../styles/productDetailPage.css";
import "../styles/common.css";
import "../styles/homePage.css";

const ProductDetailPage = () => {

  const navigate = useNavigate();
  const featuredRef = useRef();

  const location = useLocation();
  const { product, products } = location.state || {};

  const [showArrows, setShowArrows] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [bidAmount, setBidAmount] = useState("");
  const [error, setError] = useState("");
  const [currentBid, setCurrentBid] = useState(product?.currentBid || 0);

  const handleBid = () => {
    const bid = Number(bidAmount);

    // Empty check
    if (!bidAmount || bidAmount.trim() === "") {
      setError("Please enter a bid amount");
      return;
    }

    // Invalid number check
    if (isNaN(bid) || bid <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    // 🔥 MAIN VALIDATION
    if (bid <= currentBid) {
      setError(`Bid must be greater than PKR ${currentBid.toLocaleString()}`);
      return;
    }

    // SUCCESS
    setError("");

    // ✅ Update bid dynamically
    setCurrentBid(bid);

    // Optional: clear input
    setBidAmount("");

    alert("Bid placed successfully!");
  };



  if (!product) {
    return (
      <>
        <Header />
        <h2 style={{ textAlign: "center", marginTop: "30px", minHeight: "30vh" }}>
          Product not found
        </h2>
        <Footer />
      </>
    );
  }

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, []);

  // 🔥 MULTIPLE IMAGES SUPPORT
  const images = product.images && product.images.length > 0
    ? product.images
    : [product.image, product.image, product.image, product.image];

  const nextImage = () => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setCurrentIndex((prev) =>
      prev === 0 ? images.length - 1 : prev - 1
    );
  };

  // RELATED ITEMS
  const relatedItems =
    products
      ?.filter(p => p.id !== product.id)
      .slice(0, 5) || [];

  useLayoutEffect(() => {
    const slider = featuredRef.current;

    if (!slider) return;

    const checkOverflow = () => {
      setShowArrows(slider.scrollWidth > slider.clientWidth);
    };

    checkOverflow();
    window.addEventListener("resize", checkOverflow);

    return () => window.removeEventListener("resize", checkOverflow);
  }, [relatedItems]);

  const scrollLeftFeatured = () => {
    featuredRef.current.scrollBy({ left: -330, behavior: "smooth" });
  };

  const scrollRightFeatured = () => {
    featuredRef.current.scrollBy({ left: 330, behavior: "smooth" });
  };

  return (
    <>
      <Header />

      <div className="product-detail">

        <div className="page-header">
          <button className="back-btn" onClick={() => navigate(-1)}>
            <FaArrowLeft />
          </button>
          <h2 className="page-heading">Product Details</h2>
        </div>

        <div className="product-detail-container">

          {/* ===== GALLERY ===== */}
          <div className="product-gallery">

            <div className="main-image-wrapper">
              <img
                src={images[currentIndex]}
                alt=""
                className="main-image"
              />

              {/* Arrows */}
              <button className="img-arrow left" onClick={prevImage}>
                <FaArrowLeft />
              </button>
              <button className="img-arrow right" onClick={nextImage}>
                <FaArrowRight />
              </button>
            </div>

            <div className="thumbnail-row">
              {images.map((img, i) => (
                <img
                  key={i}
                  src={img}
                  className={i === currentIndex ? "active-thumb" : ""}
                  onClick={() => setCurrentIndex(i)}
                />
              ))}
            </div>

          </div>

          {/* ===== PRODUCT INFO ===== */}
          <div className="product-info">

            <h1 className="product-title">{product.title}</h1>

            <div className="owner">
              <span>Seller</span>
              <h4>{product.seller}</h4>
            </div>

            <div className="info-grid">
              <p><strong>Category:</strong> {product.category || "N/A"}</p>
              <p><strong>Total Bids:</strong> {product.totalBids}</p>
            </div>

            <div className="bid-box">
              <div>
                <p className="label">Highest Bid</p>
                <h2>PKR {currentBid.toLocaleString()}</h2>
              </div>

              <div>
                <p className="label">Ends On</p>
                <p>{new Date(product.endTime).toLocaleString()}</p>
              </div>
            </div>

            <div className="bid-section">

              <input className="bid-input"
                type="number"
                placeholder="Enter your bid"
                value={bidAmount}
                onChange={(e) => {
                  setBidAmount(e.target.value);
                  setError("");
                }} />
            </div>

            {error && <p className="error-text">{error}</p>}

            <button
              className="place-bid-btn"
              onClick={handleBid}
              disabled={!bidAmount || Number(bidAmount) <= currentBid}
            >
              Place Bid
            </button>

            <p className="price-info">
              Start Price: PKR {currentBid.toLocaleString()}
            </p>

          </div>
        </div>

        {/* ===== EXTRA SECTION ===== */}
        <div className="product-extra-section">

          {/* DYNAMIC DETAILS */}
          <div className="key-info">
            <h3>Detailed Information</h3>

            <ul>
              {(product.details || [
                "High quality item",
                "Excellent condition",
                "Verified seller",
                "Fast delivery available"
              ]).map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>

          {/* DYNAMIC BID HISTORY */}
          <div className="bid-history">
            <h3>Bid History</h3>

            {(product.bids || [
              { name: "Ali", amount: product.currentBid - 50000, date: "1 Apr" },
              { name: "Ahmed", amount: product.currentBid - 20000, date: "2 Apr" },
            ]).map((bid, i) => (
              <div className="bid-item" key={i}>

                <div className="bid-user">
                  <div className="avatar">{bid.name[0]}</div>
                  <div>
                    <strong>{bid.name}</strong>
                    <p>{bid.date}</p>
                  </div>
                </div>

                <div className="bid-amount">
                  PKR {bid.amount.toLocaleString()}
                </div>

              </div>
            ))}

          </div>
        </div>
      </div>

      {/* RELATED PRODUCTS */}
      <div className="auction-section related">
        <h2 className="related-heading">Other items of interest</h2>

        <div className="related-wrapper">
          <div className="related-grid" ref={featuredRef}>
            {relatedItems.map(item => (
              <ProductCard
                key={item.id}
                product={item}
                products={products}
              />
            ))}
          </div>
        </div>

        {showArrows && (
          <div className="slider-controls">
            <button onClick={scrollLeftFeatured}><FaArrowLeft /></button>
            <button onClick={scrollRightFeatured}><FaArrowRight /></button>
          </div>
        )}
      </div>

      <Footer />
    </>
  );
};

export default ProductDetailPage;