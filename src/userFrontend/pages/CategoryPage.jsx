import { useParams, useNavigate } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";
import { useLayoutEffect, useState, useEffect } from "react";
import { supabase } from "../../supabase/supabase";
import Header from "../components/Header";
import Footer from "../components/Footer";
import ProductCard from "../components/ProductCard";
import "../styles/categoryPage.css";
import "../styles/common.css";

const normalizeAuction = (auction, bidCounts) => {
  const product = auction.products;
  const primaryImg =
    product?.product_images?.find((img) => img.is_primary) ||
    product?.product_images?.[0];

  return {
    id: auction.id,
    auctionId: auction.id,
    title: product?.title || "—",
    seller:
      auction.sellers?.profiles?.name ||
      auction.sellers?.business_name ||
      "—",
    image: primaryImg?.image_url || null,
    product_images: product?.product_images || [],
    currentBid: auction.highest_bid || 0,
    highest_bid: auction.highest_bid || 0,
    totalBids: bidCounts[auction.id] || 0,
    bids_count: bidCounts[auction.id] || 0,
    endTime: auction.end_time,
    end_time: auction.end_time,
    category: product?.category,
    sellers: auction.sellers,
  };
};

const CategoryPage = () => {
  const navigate = useNavigate();
  const { category } = useParams();
  const decodedCategory = decodeURIComponent(category);

  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, []);

  useEffect(() => {
    fetchCategoryAuctions();
  }, [decodedCategory]);

  const fetchCategoryAuctions = async () => {
    try {
      setLoading(true);

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
          )
        `)
        .eq("status", "live")
        .eq("approval_status", "approved");

      if (error) { console.error(error); return; }

      // Filter by category client-side
      const filtered = (data || []).filter(
        (a) => a.products?.category === decodedCategory
      );

      const auctionIds = filtered.map((a) => a.id);
      const bidCounts = {};

      if (auctionIds.length > 0) {
        const { data: bidsData } = await supabase
          .from("bids")
          .select("auction_id")
          .in("auction_id", auctionIds);

        (bidsData || []).forEach((b) => {
          bidCounts[b.auction_id] = (bidCounts[b.auction_id] || 0) + 1;
        });
      }

      setAuctions(
        filtered.map((a) => normalizeAuction(a, bidCounts))
      );

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Header />
      <div className="categories">
        <div className="category-page">

          <div className="page-header">
            <button className="back-btn" onClick={() => navigate(-1)}>
              <FaArrowLeft />
            </button>
            <h2 className="page-heading">{decodedCategory} Auctions</h2>
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: "60px", color: "#999" }}>
              Loading auctions...
            </div>
          ) : auctions.length === 0 ? (
            <p className="no-products">
              No live auctions found in this category.
            </p>
          ) : (
            <div className="category-grid">
              {auctions.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  products={auctions}
                />
              ))}
            </div>
          )}

        </div>
      </div>
      <Footer />
    </>
  );
};

export default CategoryPage;