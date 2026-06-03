import { useState, useMemo } from "react";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { Doughnut } from "react-chartjs-2";
import { supabase } from "../../supabase/supabase";
import { useAuthContext } from "../../context/AuthContext";
import { useAdminContext } from "../../context/AdminContext";
import toast from "react-hot-toast";
import StatCard from "../../common/components/StatCard";
import StatusBadge from "../../common/components/StatusBadge";
import ActionButton from "../../common/components/ActionButton";
import "../styles/adminLayout.css";
import "../styles/productManagement.css";

ChartJS.register(ArcElement, Tooltip, Legend);

const ProductManagement = () => {
  const { user } = useAuthContext();
  const {
    pendingProducts,
    approvedProducts,
    rejectedProducts,
    productsLoading,
    refetchProducts,
  } = useAdminContext();

  const [selectedImages,  setSelectedImages]  = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [reasonText,      setReasonText]      = useState("");

  // FIX: processing stores product ID, not boolean
  // Prevents all buttons from disabling when one action runs
  const [processing, setProcessing] = useState(null);
  const [imageError,  setImageError]  = useState({});

  // ── Log admin action ──────────────────────────────────────────────
  const logAdminAction = async (actionType, targetId, remarks) => {
    try {
      await supabase.from("admin_actions").insert({
        admin_id:     user.id,
        action_type:  actionType,
        target_id:    targetId,
        target_table: "products",
        remarks:      remarks,
      });
    } catch (err) {
      console.error("Admin log error (non-critical):", err);
    }
  };

  // ── Send notification to seller ───────────────────────────────────
  const sendSellerNotification = async (sellerId, title, message) => {
    if (!sellerId) return;
    try {
      await supabase.from("notifications").insert({
        user_id:          sellerId,
        title:            title,
        message:          message,
        type:             "approval",
        notification_for: "seller",
        is_read:          false,
      });
    } catch (err) {
      console.error("Notification error (non-critical):", err);
    }
  };

  // ── Approve product + linked auction ─────────────────────────────
  const handleApprove = async (product) => {
    try {
      // FIX: use product.id not true
      setProcessing(product.id);

      const { error: productErr } = await supabase
        .from("products")
        .update({ status: "active" })
        .eq("id", product.id);

      if (productErr) {
        toast.error(`Error approving product: ${productErr.message}`);
        console.error("Product approve error:", productErr);
        return;
      }

      const { error: auctionErr } = await supabase
        .from("auctions")
        .update({ approval_status: "approved", status: "scheduled" })
        .eq("product_id", product.id);

      if (auctionErr) {
        // Rollback product status
        await supabase.from("products").update({ status: "pending" }).eq("id", product.id);
        toast.error(`Error approving auction: ${auctionErr.message}`);
        console.error("Auction approve error:", auctionErr);
        return;
      }

      await logAdminAction("approve", product.id, "Product and auction approved by admin");
      await sendSellerNotification(
        product.sellerId,
        "Product Approved! 🎉",
        `Your product "${product.title}" has been approved and the auction is now scheduled.`
      );

      toast.success(`"${product.title}" approved!`);
      await refetchProducts();

    } catch (err) {
      console.error("handleApprove unexpected error:", err);
      toast.error(`Something went wrong: ${err.message}`);
    } finally {
      // FIX: reset to null not false
      setProcessing(null);
    }
  };

  // ── Reject product + linked auction ──────────────────────────────
  const handleConfirmReject = async () => {
    if (!reasonText.trim()) { toast.error("Please write a reason"); return; }

    try {
      // FIX: use selectedProduct.id not true
      setProcessing(selectedProduct.id);

      const { error: productErr } = await supabase
        .from("products")
        .update({ status: "rejected" })
        .eq("id", selectedProduct.id);

      if (productErr) {
        toast.error(`Error rejecting product: ${productErr.message}`);
        console.error("Product reject error:", productErr);
        return;
      }

      const { error: auctionErr } = await supabase
        .from("auctions")
        .update({ approval_status: "rejected" })
        .eq("product_id", selectedProduct.id);

      if (auctionErr) {
        // Rollback product status
        await supabase.from("products").update({ status: "pending" }).eq("id", selectedProduct.id);
        toast.error(`Error rejecting auction: ${auctionErr.message}`);
        console.error("Auction reject error:", auctionErr);
        return;
      }

      // Reason stored in admin_actions — AdminContext reads it from there
      await logAdminAction("reject", selectedProduct.id, reasonText.trim());

      await supabase.from("notifications").insert({
        user_id:          selectedProduct.sellerId,
        title:            "Product Rejected",
        message:          `Your product "${selectedProduct.title}" was rejected. Reason: ${reasonText.trim()}`,
        type:             "approval",
        notification_for: "seller",
        is_read:          false,
      });

      toast.success(`"${selectedProduct.title}" rejected`);
      setSelectedProduct(null);
      setReasonText("");
      await refetchProducts();

    } catch (err) {
      console.error("handleConfirmReject unexpected error:", err);
      toast.error(`Something went wrong: ${err.message}`);
    } finally {
      // FIX: reset to null not false
      setProcessing(null);
    }
  };

  const handleImageError = (index) => {
    setImageError((prev) => ({ ...prev, [index]: true }));
  };

  const formatDate = (d) => !d ? "—" : new Date(d).toLocaleDateString("en-PK", {
    year: "numeric", month: "short", day: "numeric",
  });

  const renderEmptyRow = (colSpan, msg) => (
    <tr><td colSpan={colSpan} className="empty-row">{msg}</td></tr>
  );

  const totalPending  = pendingProducts.length;
  const totalApproved = approvedProducts.length;
  const totalRejected = rejectedProducts.length;
  const totalProducts = totalPending + totalApproved + totalRejected;

  const statsData = [
    { title: "Total Products",    value: productsLoading ? "..." : totalProducts, subtitle: "All submitted products" },
    { title: "Pending Products",  value: productsLoading ? "..." : totalPending,  subtitle: "Awaiting approval" },
    { title: "Approved Products", value: productsLoading ? "..." : totalApproved, subtitle: "Live listings" },
    { title: "Rejected Products", value: productsLoading ? "..." : totalRejected, subtitle: "Not approved" },
  ];

  const productStatusData = useMemo(() => ({
    labels: ["Approved", "Pending", "Rejected"],
    datasets: [{
      data: [totalApproved, totalPending, totalRejected],
      backgroundColor: ["#10B981", "#F59E0B", "#EF4444"],
    }],
  }), [totalApproved, totalPending, totalRejected]);

  const doughnutOptions = {
    responsive: true, maintainAspectRatio: false, cutout: "0%",
    layout: { padding: { top: 10, bottom: 30 } },
    plugins: { legend: { position: "top", align: "center", labels: { boxWidth: 30, padding: 15 } } },
  };

  const renderProductTable = (products, colSpan, showActions = false, showReason = false) => (
    <div className="table-wrapper">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Product</th>
            <th>Category</th>
            <th>Seller</th>
            <th>Business</th>
            <th>Base Price</th>
            <th>Condition</th>
            <th>Images</th>
            <th>Date</th>
            <th>Status</th>
            {showActions && <th>Actions</th>}
            {showReason  && <th>Rejection Reason</th>}
          </tr>
        </thead>
        <tbody>
          {products.length === 0
            ? renderEmptyRow(colSpan, "No products found.")
            : products.map((product) => (
              <tr key={product.id}>
                <td title={product.title}>
                  {product.title?.length > 30
                    ? product.title.substring(0, 30) + "..."
                    : product.title}
                </td>
                <td>{product.category || "—"}</td>
                <td>{product.sellerName}</td>
                <td>{product.businessName}</td>
                <td>PKR {product.base_price?.toLocaleString() || 0}</td>
                <td>{product.condition || "—"}</td>
                <td>
                  {product.allImages && product.allImages.length > 0 ? (
                    <span
                      className="view-image-link"
                      onClick={() => { setSelectedImages(product.allImages); setImageError({}); }}
                    >
                      View Images ({product.allImages.length})
                    </span>
                  ) : (
                    <span style={{ color: "#999", fontSize: "13px" }}>No images</span>
                  )}
                </td>
                <td>{formatDate(product.created_at)}</td>
                <td>
                  <StatusBadge
                    label={
                      product.status === "active"   ? "Approved" :
                      product.status === "pending"  ? "Pending"  : "Rejected"
                    }
                    type={product.status === "active" ? "approved" : product.status}
                  />
                </td>
                {showActions && (
                  <td className="actions">
                    <ActionButton
                      label="Approve"
                      variant="success"
                      onClick={() => handleApprove(product)}
                      // FIX: only disable THIS product's buttons
                      disabled={processing === product.id}
                    />
                    <ActionButton
                      label="Reject"
                      variant="danger"
                      onClick={() => { setSelectedProduct(product); setReasonText(""); }}
                      disabled={processing === product.id}
                    />
                  </td>
                )}
                {showReason && (
                  // FIX: AdminContext stores reason in product.reason not product.rejection_reason
                  <td title={product.reason}>
                    {product.reason
                      ? product.reason.length > 40
                        ? product.reason.substring(0, 40) + "..."
                        : product.reason
                      : "—"}
                  </td>
                )}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="admin-page">

      <div className="stats-grid">
        {statsData.map((item, i) => (
          <StatCard key={i} title={item.title} value={item.value} subtitle={item.subtitle} />
        ))}
      </div>

      <div className="admin-section">
        <h3 className="admin-section-heading">Pending Products</h3>
        {productsLoading
          ? <div className="loading-state">Loading products...</div>
          : renderProductTable(pendingProducts, 10, true, false)}
      </div>

      <div className="admin-section">
        <h3 className="admin-section-heading">Approved Products</h3>
        {productsLoading
          ? <div className="loading-state">Loading products...</div>
          : renderProductTable(approvedProducts, 9, false, false)}
      </div>

      <div className="admin-section">
        <h3 className="admin-section-heading">Rejected Products</h3>
        {productsLoading
          ? <div className="loading-state">Loading products...</div>
          : renderProductTable(rejectedProducts, 10, false, true)}
      </div>

      {/* IMAGES MODAL */}
      {selectedImages && (
        <div className="image-modal-overlay" onClick={() => setSelectedImages(null)}>
          <div className="image-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-modal" onClick={() => setSelectedImages(null)}>✕</button>
            {selectedImages.length === 0 ? (
              <p style={{ textAlign: "center", color: "#999", padding: "20px" }}>
                No images available for this product.
              </p>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", justifyContent: "center" }}>
                {selectedImages.map((img, i) =>
                  img?.image_url && !imageError[i] ? (
                    <img
                      key={i}
                      src={img.image_url}
                      alt={`Product ${i + 1}`}
                      style={{
                        width: "200px", height: "200px",
                        objectFit: "cover", borderRadius: "8px",
                      }}
                      onError={() => handleImageError(i)}
                    />
                  ) : null
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* REJECT REASON MODAL */}
      {selectedProduct && (
        <div className="reason-modal-overlay" onClick={() => { setSelectedProduct(null); setReasonText(""); }}>
          <div className="reason-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Reject Product</h3>
            <p style={{ fontSize: "13px", color: "#666", marginBottom: "4px" }}>
              Rejecting: <strong>{selectedProduct.title}</strong>
            </p>
            <p style={{ fontSize: "12px", color: "#888", marginBottom: "16px" }}>
              Seller: {selectedProduct.sellerName} | Business: {selectedProduct.businessName}
            </p>
            <textarea
              placeholder="Write reason here..."
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              rows="4"
              style={{
                width: "100%", padding: "10px",
                borderRadius: "6px", border: "1px solid #ccc",
                marginBottom: "16px", resize: "vertical",
              }}
            />
            <div className="modal-actions">
              <button
                className="cancel"
                onClick={() => { setSelectedProduct(null); setReasonText(""); }}
                disabled={processing === selectedProduct.id}
              >
                Cancel
              </button>
              <button
                className="confirm"
                onClick={handleConfirmReject}
                disabled={processing === selectedProduct.id}
              >
                {processing === selectedProduct.id ? "Processing..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CHART */}
      <div className="overview-grid chart-space">
        <div className="chart-box">
          <h3 className="admin-section-heading">Product Status Overview</h3>
          <div className="chart-container">
            <Doughnut data={productStatusData} options={doughnutOptions} />
          </div>
        </div>
      </div>

    </div>
  );
};

export default ProductManagement;