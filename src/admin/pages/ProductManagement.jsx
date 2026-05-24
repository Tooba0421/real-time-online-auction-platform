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

  // ── UI-only local state ───────────────────────────────────────────
  const [selectedImages, setSelectedImages] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [reasonText, setReasonText] = useState("");
  const [processing, setProcessing] = useState(false);

  // ── Approve product ───────────────────────────────────────────────
  const handleApprove = async (product) => {
    try {
      setProcessing(true);

      const [{ error: productErr }, { error: auctionErr }] = await Promise.all([
        supabase.from("products").update({ status: "active" }).eq("id", product.id),
        supabase.from("auctions")
          .update({ approval_status: "approved", status: "scheduled" })
          .eq("product_id", product.id),
      ]);

      if (productErr) { toast.error("Error approving product"); return; }
      if (auctionErr) { toast.error("Error approving auction");  return; }

      // Non-critical: audit + notification in parallel, don't await sequentially
      await Promise.all([
        supabase.from("admin_actions").insert({
          admin_id: user.id, action_type: "approve",
          target_id: product.id, target_table: "products",
          remarks: "Product and auction approved by admin",
        }).catch((e) => console.error("Admin log error:", e)),
        product.sellerId
          ? supabase.from("notifications").insert({
              user_id: product.sellerId,
              title: "Product Approved! 🎉",
              message: `Your product "${product.title}" has been approved and the auction is now scheduled.`,
              type: "approval", notification_for: "seller", is_read: false,
            })
          : Promise.resolve(),
      ]);

      toast.success(`"${product.title}" approved!`);
      refetchProducts(); // ✅ context will also update via realtime
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong");
    } finally {
      setProcessing(false);
    }
  };

  // ── Reject product ────────────────────────────────────────────────
  const handleConfirmReject = async () => {
    if (!reasonText.trim()) { toast.error("Please write a reason"); return; }
    try {
      setProcessing(true);

      const [{ error: productErr }, { error: auctionErr }] = await Promise.all([
        supabase.from("products").update({ status: "rejected" }).eq("id", selectedProduct.id),
        supabase.from("auctions").update({ approval_status: "rejected" }).eq("product_id", selectedProduct.id),
      ]);

      if (productErr) { toast.error("Error rejecting product"); return; }
      if (auctionErr) { toast.error("Error rejecting auction");  return; }

      await Promise.all([
        supabase.from("admin_actions").insert({
          admin_id: user.id, action_type: "reject",
          target_id: selectedProduct.id, target_table: "products",
          remarks: reasonText,
        }).catch((e) => console.error("Admin log error:", e)),
        selectedProduct.sellerId
          ? supabase.from("notifications").insert({
              user_id: selectedProduct.sellerId,
              title: "Product Rejected",
              message: `Your product "${selectedProduct.title}" was rejected. Reason: ${reasonText}`,
              type: "approval", notification_for: "seller", is_read: false,
            })
          : Promise.resolve(),
      ]);

      toast.success(`"${selectedProduct.title}" rejected`);
      setSelectedProduct(null);
      refetchProducts(); // ✅
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong");
    } finally {
      setProcessing(false);
    }
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
            <th>Product</th><th>Category</th><th>Seller</th><th>Business</th>
            <th>Base Price</th><th>Condition</th><th>Images</th><th>Date</th><th>Status</th>
            {showActions && <th>Actions</th>}
            {showReason  && <th>Reason</th>}
          </tr>
        </thead>
        <tbody>
          {products.length === 0 ? renderEmptyRow(colSpan, "No products found.") :
            products.map((product) => (
              <tr key={product.id}>
                <td>{product.title}</td>
                <td>{product.category}</td>
                <td>{product.sellerName}</td>
                <td>{product.businessName}</td>
                <td>PKR {product.base_price?.toLocaleString()}</td>
                <td>{product.condition || "—"}</td>
                <td>
                  <span className="view-image-link" onClick={() => setSelectedImages(product.allImages)}>
                    View Images
                  </span>
                </td>
                <td>{formatDate(product.created_at)}</td>
                <td>
                  <StatusBadge
                    label={product.status === "active" ? "Approved" : product.status === "pending" ? "Pending" : "Rejected"}
                    type={product.status === "active" ? "approved" : product.status}
                  />
                </td>
                {showActions && (
                  <td className="actions">
                    <ActionButton label="Approve" variant="success" onClick={() => handleApprove(product)} disabled={processing} />
                    <ActionButton label="Reject"  variant="danger"
                      onClick={() => { setSelectedProduct(product); setReasonText(""); }} disabled={processing} />
                  </td>
                )}
                {showReason && (
                  <td><span className="long-text" title={product.reason}>{product.reason || "—"}</span></td>
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
        {productsLoading ? <div className="loading-state">Loading products...</div> : renderProductTable(pendingProducts, 10, true, false)}
      </div>

      <div className="admin-section">
        <h3 className="admin-section-heading">Approved Products</h3>
        {productsLoading ? <div className="loading-state">Loading products...</div> : renderProductTable(approvedProducts, 9, false, false)}
      </div>

      <div className="admin-section">
        <h3 className="admin-section-heading">Rejected Products</h3>
        {productsLoading ? <div className="loading-state">Loading products...</div> : renderProductTable(rejectedProducts, 10, false, true)}
      </div>

      {/* IMAGES MODAL */}
      {selectedImages && (
        <div className="image-modal-overlay" onClick={() => setSelectedImages(null)}>
          <div className="image-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-modal" onClick={() => setSelectedImages(null)}>✕</button>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", justifyContent: "center" }}>
              {selectedImages.map((img, i) => (
                <img key={i} src={img.image_url} alt={`Product ${i + 1}`}
                  style={{ width: "200px", height: "200px", objectFit: "cover", borderRadius: "8px" }} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* REJECT REASON MODAL */}
      {selectedProduct && (
        <div className="reason-modal-overlay">
          <div className="reason-modal">
            <h3>Reject Product</h3>
            <p style={{ fontSize: "13px", color: "#666", marginBottom: "8px" }}>
              Rejecting: <strong>{selectedProduct.title}</strong>
            </p>
            <textarea placeholder="Write reason here..." value={reasonText}
              onChange={(e) => setReasonText(e.target.value)} />
            <div className="modal-actions">
              <button className="cancel" onClick={() => setSelectedProduct(null)} disabled={processing}>Cancel</button>
              <button className="confirm" onClick={handleConfirmReject} disabled={processing}>
                {processing ? "Processing..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

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