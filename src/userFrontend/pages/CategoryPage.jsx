import { useParams, useNavigate } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";
import { useLayoutEffect, useState, useEffect } from "react";
import { supabase } from "../../supabase/supabase";
import Header from "../components/Header";
import Footer from "../components/Footer";
import ProductCard from "../components/ProductCard";
import "../styles/categoryPage.css";
import "../styles/common.css";

// ── Normalize — reads bids?.length directly, no second query needed ──
const normalizeAuction = (auction) => {
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
    totalBids:      auction.bids?.length || 0,
    bids_count:     auction.bids?.length || 0,
    endTime:        auction.end_time,
    end_time:       auction.end_time,
    category:       product?.category,
    sellers:        auction.sellers,
  };
};

const CategoryPage = () => {
  const navigate = useNavigate();
  const { category } = useParams();
  const decodedCategory = decodeURIComponent(category);

  const [auctions, setAuctions] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, []);

  // ── Fetch — isInitial controls whether spinner shows ──────────────
  const fetchCategoryAuctions = async (isInitial = false) => {
    try {
      if (isInitial) setInitialLoading(true);

      // ✅ Single query — bids joined so no second round-trip needed
      // ✅ Category filtered server-side via eq on joined products column
      const { data, error } = await supabase
        .from("auctions")
        .select(`
          id,
          highest_bid,
          end_time,
          created_at,
          products!inner (
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
        .eq("products.category", decodedCategory);

      if (error) { return; }

      setAuctions((data || []).map((a) => normalizeAuction(a)));

    } catch (err) {
    } finally {
      if (isInitial) setInitialLoading(false);
    }
  };

  // Initial fetch when category changes
  useEffect(() => {
    fetchCategoryAuctions(true);
  }, [decodedCategory]);

  // ── Realtime subscription ─────────────────────────────────────────
  // Silent refresh — cards stay visible and update values without flicker
  useEffect(() => {
    const channel = supabase
      .channel(`category-page-${decodedCategory}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "auctions" },
        () => fetchCategoryAuctions(false)
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "bids" },
        () => fetchCategoryAuctions(false)
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [decodedCategory]); // re-subscribe when category changes

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

          {initialLoading ? (
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