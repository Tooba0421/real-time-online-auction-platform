import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaArrowRight, FaClock, FaShieldAlt, FaClipboardList } from "react-icons/fa";
import { products } from "../data/products";
import { categories } from "../data/categories";
import Header from "../components/Header";
import Footer from "../components/Footer";
import ProductCard from "../components/ProductCard";
import "../styles/homepage.css";

import banner from "../../assets/banner.jpg";


const HomePage = () => {

  const navigate = useNavigate();
  const featuredRef = useRef();
  const latestRef = useRef();

  // 🔥 Popular Auctions (based on bids)
  const popularProducts = [...products]
    .sort((a, b) => b.totalBids - a.totalBids)
    .slice(0, 10);

  // 🔥 Latest Auctions (based on time)
  const latestProducts = [...products]
    .sort((a, b) => new Date(b.endTime) - new Date(a.endTime))
    .slice(0, 10);

  // Auto scroll 
  useEffect(() => {

    const featuredSlider = featuredRef.current;
    const latestSlider = latestRef.current;

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

  }, []);

  const scrollLeftFeatured = () => {
    featuredRef.current.scrollBy({ left: -320, behavior: "smooth" });
  };

  const scrollRightFeatured = () => {
    featuredRef.current.scrollBy({ left: 320, behavior: "smooth" });
  };

  const scrollLeftLatest = () => {
    latestRef.current.scrollBy({ left: -320, behavior: "smooth" });
  };

  const scrollRightLatest = () => {
    latestRef.current.scrollBy({ left: 320, behavior: "smooth" });
  };

  return (
    <>
      <Header />

      {/* Banner Section */}
      <section className="banner-section">
        <img src={banner} alt="Banner" className="banner-image" />

        {/* Overlay */}
        <div className="banner-overlay"></div>
        <div className="banner-content">
          <h1 className="banner-title">Bid on the finest collectibles & gold today!</h1>
          <p className="banner-subtext">Join live auctions and win exclusive items.</p>
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

      {/* Categories Section */}
      <section className="category-section">
        <div className="category-container">
          {categories.map((category, index) => (
            <div
              key={index}
              className="category-card"
              onClick={() =>
                navigate(`/category/${encodeURIComponent(category.name)}`, {
                  state: { products }
                })
              }
            >
              <div className="category-image">
                <img src={category.image} alt={category.name} />
              </div>
              <span className="category-name">
                {category.name}</span>
            </div>
          ))
          }
        </div>
      </section>

      <section className="popular auction-section">

        <h2 className="auction-heading">Popular Auctions</h2>

        <div className="slider-wrapper">
          <div className="card-slider" ref={featuredRef}>

            {popularProducts.map(product => (
              <ProductCard
                key={product.id}
                product={product}
                products={products}
              />
            ))}

          </div>
        </div>

        <div className="slider-controls">
          <button onClick={scrollLeftFeatured}>
            <FaArrowLeft /> </button>
          <button onClick={scrollRightFeatured}>
            <FaArrowRight /> </button>
        </div>
      </section>

      <section className="latest auction-section">

        <h2 className="auction-heading">Latest Auctions</h2>

        <div className="slider-wrapper">
          <div className="card-slider" ref={latestRef}>

            {latestProducts.map(product => (
              <ProductCard
                key={product.id}
                product={product}
                products={products}
              />
            ))}

          </div>
        </div>

        <div className="slider-controls">
          <button onClick={scrollLeftLatest}>
            <FaArrowLeft /> </button>
          <button onClick={scrollRightLatest}>
            <FaArrowRight /> </button>
        </div>
      </section>

      {/* Why Choose Section */}
      <section className="why-section">
        <h2>Why Choose Auctions?</h2>

        <div className="why-container">

          <div className="why-card">
            <div className="why-icon">
              <FaClock />
            </div>
            <h3>Real-time Auctions</h3>
            <p>Get better offers through live bidding.</p>
          </div>

          <div className="why-card">
            <div className="why-icon">
              <FaShieldAlt /> </div>
            <h3>Secure Bidding</h3>
            <p>Our platform ensures safe and transparent auctions for all users.</p>
          </div>

          <div className="why-card">
            <div className="why-icon">
              <FaClipboardList />
            </div>
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