import { useParams, useNavigate } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";
import { useLayoutEffect } from "react";
import { products } from "../data/products";
import Header from "../components/Header";
import Footer from "../components/Footer";
import ProductCard from "../components/ProductCard";
import "../styles/categoryPage.css";
import "../styles/common.css";

const CategoryPage = () => {

  const navigate = useNavigate();
  const { category } = useParams(); // ✅ FIXED
  const decodedCategory = decodeURIComponent(category);

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, []);

  const filteredProducts = products.filter(
    (p) => p.category === decodedCategory
  );

  return (
    <>
      <Header />
      <div className="categories">
        <div className="category-page">

          <div className="page-header">

            <button
              className="back-btn"
              onClick={() => navigate(-1)}
            >
              <FaArrowLeft />
            </button>

            <h2 className="page-heading">
              {decodedCategory} Auctions
            </h2>

          </div>

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
            <p className="no-products">
              No auctions found in this category.
            </p>
          )}

        </div>
      </div>

      <Footer />
    </>
  );
};

export default CategoryPage;