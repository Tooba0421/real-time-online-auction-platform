import { useLayoutEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";
import { products } from "../data/products";
import Header from "../components/Header";
import Footer from "../components/Footer";
import ProductCard from "../components/ProductCard";
import "../styles/common.css";
import "../styles/categoryPage.css";

const SearchPage = () => {

  const navigate = useNavigate();
  const location = useLocation();

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, []);

  // ✅ GET QUERY
  const queryParams = new URLSearchParams(location.search);
  const searchQuery = queryParams.get("q")?.toLowerCase() || "";

  // ✅ FILTER LOGIC (POWERFUL 🔥)
  const filteredProducts = products.filter((product) => {

  const query = searchQuery.trim().toLowerCase();

  // 🔥 Split search into words
  const queryWords = query.split(" ");

  // 🔥 Combine all searchable text
  const text = `
    ${product.title || ""}
    ${product.category || ""}
    ${product.seller || ""}
    ${product.description || ""}
  `.toLowerCase();

  // ✅ Check if ANY word matches
  return queryWords.some(word => text.includes(word));
});

  return (
    <>
      <Header />

      <div className="auctions-page">

        {/* HEADER */}
        <div className="page-header">

          <button
            className="back-btn"
            onClick={() => navigate(-1)}
          >
            <FaArrowLeft />
          </button>

          <h2 className="page-heading">
            Search Results for "{searchQuery}"
          </h2>

        </div>

        {/* RESULTS */}
        {filteredProducts.length > 0 ? (

          <div className="category-grid">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                products={products}
              />
            ))}
          </div>

        ) : (

          // ❌ NO RESULT UI
          <div style={{ textAlign: "center", marginTop: "60px" }}>
            <h3>No results found</h3>
            <p>Try searching something else</p>
          </div>

        )}

      </div>

      <Footer />
    </>
  );
};

export default SearchPage;