import { useLayoutEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";
import { products } from "../data/products";
import Header from "../components/Header";
import Footer from "../components/Footer";
import ProductCard from "../components/ProductCard";
import "../styles/common.css";
import "../styles/auctionsPage.css";

const AuctionsPage = () => {

  const navigate = useNavigate();
  const location = useLocation();

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, []);

  // ✅ GET TYPE FROM URL
  const queryParams = new URLSearchParams(location.search);
  const type = queryParams.get("type");

  let filteredProducts = [...products];
  let pageTitle = "All Auctions";

  // ✅ APPLY FILTER
  if (type === "popular") {
    filteredProducts = [...products]
      .sort((a, b) => b.totalBids - a.totalBids);

    pageTitle = "Popular Auctions";
  }

  else if (type === "latest") {
    filteredProducts = [...products]
      .sort((a, b) => new Date(b.endTime) - new Date(a.endTime));

    pageTitle = "Latest Auctions";
  }

  return (
    <>
      <Header />

      <div className="auctions-page">

        {/* HEADER */}
        <div className="page-header">

          <button
            className="back-btn"
            onClick={() => {
              if (window.history.length > 1) {
                navigate(-1);
              } else {
                navigate("/");
              }
            }}
          >
            <FaArrowLeft />
          </button>

          <h2 className="page-heading">{pageTitle}</h2>

        </div>

        {/* GRID */}
        <div className="auctions-grid">

          {filteredProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              products={products}
            />
          ))}

        </div>

      </div>

      <Footer />
    </>
  );
};

export default AuctionsPage;