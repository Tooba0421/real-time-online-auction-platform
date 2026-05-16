import { useState, useMemo, useEffect } from "react";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Doughnut } from "react-chartjs-2";
import { supabase } from "../../supabase/supabase";
import { useAuthContext } from "../../context/AuthContext";
import toast from "react-hot-toast";
import StatCard from "../../common/components/StatCard";
import StatusBadge from "../../common/components/StatusBadge";
import ActionButton from "../../common/components/ActionButton";
import "../styles/adminLayout.css";
import "../styles/productManagement.css";

ChartJS.register(ArcElement, Tooltip, Legend);

const ProductManagement = () => {

  const { user } = useAuthContext();

  const [pendingProducts, setPendingProducts] = useState([]);
  const [approvedProducts, setApprovedProducts] = useState([]);
  const [rejectedProducts, setRejectedProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedImages, setSelectedImages] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [reasonText, setReasonText] = useState("");
  const [processing, setProcessing] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("pending");

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          product_images (
            image_url,
            is_primary
          ),
          sellers (
            id,
            business_name,
            user_id,
            profiles (
              name
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        toast.error("Error fetching products");
        console.error(error);
        return;
      }

      const pending = [];
      const approved = [];
      const rejected = [];

      for (const product of data) {
        const primaryImage = product.product_images?.find(img => img.is_primary)
          || product.product_images?.[0];

        const productWithData = {
          ...product,
          sellerName: product.sellers?.profiles?.name || '—',
          businessName: product.sellers?.business_name || '—',
          sellerId: product.sellers?.user_id,
          primaryImage: primaryImage?.image_url || null,
          allImages: product.product_images || [],
        };

        if (product.status === 'pending') {
          pending.push(productWithData);
        } else if (product.status === 'active') {
          approved.push(productWithData);
        } else if (product.status === 'rejected') {
          rejected.push(productWithData);
        }
      }

      setPendingProducts(pending);
      setApprovedProducts(approved);
      setRejectedProducts(rejected);

    } catch (err) {
      console.error(err);
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  // Approve product + auction
  const handleApprove = async (product) => {
    try {
      setProcessing(true);

      // Step 1: Update product status
      const { error: productError } = await supabase
        .from('products')
        .update({ status: 'active' })
        .eq('id', product.id);

      if (productError) {
        toast.error("Error approving product");
        console.error(productError);
        return;
      }

      // Step 2: Approve linked auction
      const { error: auctionError } = await supabase
        .from('auctions')
        .update({
          approval_status: 'approved',
          status: 'scheduled'
        })
        .eq('product_id', product.id);

      if (auctionError) {
        toast.error("Error approving auction");
        console.error(auctionError);
        return;
      }

      // Step 3: Log admin action
      await supabase
        .from('admin_actions')
        .insert({
          admin_id: user.id,
          action_type: 'approve',
          target_id: product.id,
          target_table: 'products',
          remarks: 'Product and auction approved by admin'
        });

      // Step 4: Notify seller
      if (product.sellerId) {
        await supabase
          .from('notifications')
          .insert({
            user_id: product.sellerId,
            title: 'Product Approved! 🎉',
            message: `Your product "${product.title}" has been approved and the auction is now scheduled.`,
            type: 'approval',
            notification_for: 'seller',
            is_read: false
          });
      }

      toast.success(`"${product.title}" approved!`);

      // Update local state
      setPendingProducts(prev => prev.filter(p => p.id !== product.id));
      setApprovedProducts(prev => [...prev, { ...product, status: 'active' }]);

    } catch (err) {
      console.error(err);
      toast.error("Something went wrong");
    } finally {
      setProcessing(false);
    }
  };

  const openRejectModal = (product) => {
    setSelectedProduct(product);
    setReasonText("");
  };

  // Reject product + auction
  const handleConfirmReject = async () => {
    if (!reasonText.trim()) {
      toast.error("Please write a reason");
      return;
    }

    try {
      setProcessing(true);

      // Step 1: Update product status
      const { error: productError } = await supabase
        .from('products')
        .update({ status: 'rejected' })
        .eq('id', selectedProduct.id);

      if (productError) {
        toast.error("Error rejecting product");
        console.error(productError);
        return;
      }

      // Step 2: Reject linked auction
      const { error: auctionError } = await supabase
        .from('auctions')
        .update({ approval_status: 'rejected' })
        .eq('product_id', selectedProduct.id);

      if (auctionError) {
        toast.error("Error rejecting auction");
        console.error(auctionError);
        return;
      }

      // Step 3: Log admin action
      await supabase
        .from('admin_actions')
        .insert({
          admin_id: user.id,
          action_type: 'reject',
          target_id: selectedProduct.id,
          target_table: 'products',
          remarks: reasonText
        });

      // Step 4: Notify seller
      if (selectedProduct.sellerId) {
        await supabase
          .from('notifications')
          .insert({
            user_id: selectedProduct.sellerId,
            title: 'Product Rejected',
            message: `Your product "${selectedProduct.title}" was rejected. Reason: ${reasonText}`,
            type: 'approval',
            notification_for: 'seller',
            is_read: false
          });
      }

      toast.success(`"${selectedProduct.title}" rejected`);

      setPendingProducts(prev =>
        prev.filter(p => p.id !== selectedProduct.id)
      );
      setRejectedProducts(prev => [
        ...prev,
        { ...selectedProduct, status: 'rejected', reason: reasonText }
      ]);

      setSelectedProduct(null);

    } catch (err) {
      console.error(err);
      toast.error("Something went wrong");
    } finally {
      setProcessing(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-PK', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  };

  const renderEmptyRow = (colSpan, message) => (
    <tr>
      <td colSpan={colSpan} className="empty-row">{message}</td>
    </tr>
  );

  // Stats
  const totalPending = pendingProducts.length;
  const totalApproved = approvedProducts.length;
  const totalRejected = rejectedProducts.length;
  const totalProducts = totalPending + totalApproved + totalRejected;

  const statsData = [
    { title: "Total Products", value: loading ? "..." : totalProducts, subtitle: "All submitted products" },
    { title: "Pending Products", value: loading ? "..." : totalPending, subtitle: "Awaiting approval" },
    { title: "Approved Products", value: loading ? "..." : totalApproved, subtitle: "Live listings" },
    { title: "Rejected Products", value: loading ? "..." : totalRejected, subtitle: "Not approved" },
  ];

  const productStatusData = useMemo(() => ({
    labels: ["Approved", "Pending", "Rejected"],
    datasets: [{
      data: [totalApproved, totalPending, totalRejected],
      backgroundColor: ["#10B981", "#F59E0B", "#EF4444"],
    }],
  }), [totalApproved, totalPending, totalRejected]);

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "0%",
    layout: { padding: { top: 10, bottom: 30 } },
    plugins: {
      legend: {
        position: "top", align: "center",
        labels: { boxWidth: 30, padding: 15 },
      },
    },
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
            {showReason && <th>Reason</th>}
          </tr>
        </thead>
        <tbody>
          {products.length === 0
            ? renderEmptyRow(colSpan, "No products found.")
            : products.map(product => (
              <tr key={product.id}>
                <td>{product.title}</td>
                <td>{product.category}</td>
                <td>{product.sellerName}</td>
                <td>{product.businessName}</td>
                <td>PKR {product.base_price?.toLocaleString()}</td>
                <td>{product.condition}</td>
                <td>
                  <span
                    className="view-image-link"
                    onClick={() => setSelectedImages(product.allImages)}
                  >
                    View Images
                  </span>
                </td>
                <td>{formatDate(product.created_at)}</td>
                <td>
                  <StatusBadge
                    label={
                      product.status === 'active' ? 'Approved' :
                      product.status === 'pending' ? 'Pending' : 'Rejected'
                    }
                    type={
                      product.status === 'active' ? 'approved' :
                      product.status === 'pending' ? 'pending' : 'rejected'
                    }
                  />
                </td>
                {showActions && (
                  <td className="actions">
                    <ActionButton
                      label="Approve"
                      variant="success"
                      onClick={() => handleApprove(product)}
                      disabled={processing}
                    />
                    <ActionButton
                      label="Reject"
                      variant="danger"
                      onClick={() => openRejectModal(product)}
                      disabled={processing}
                    />
                  </td>
                )}
                {showReason && (
                  <td>
                    <span className="long-text" title={product.reason}>
                      {product.reason || '—'}
                    </span>
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

      {/* STAT CARDS */}
      <div className="stats-grid">
        {statsData.map((item, index) => (
          <StatCard key={index} title={item.title} value={item.value} subtitle={item.subtitle} />
        ))}
      </div>

      {/* PENDING */}
      <div className="admin-section">
        <h3 className="admin-section-heading">Pending Products</h3>
        {loading
          ? <div className="loading-state">Loading products...</div>
          : renderProductTable(pendingProducts, 10, true, false)
        }
      </div>

      {/* APPROVED */}
      <div className="admin-section">
        <h3 className="admin-section-heading">Approved Products</h3>
        {loading
          ? <div className="loading-state">Loading products...</div>
          : renderProductTable(approvedProducts, 9, false, false)
        }
      </div>

      {/* REJECTED */}
      <div className="admin-section">
        <h3 className="admin-section-heading">Rejected Products</h3>
        {loading
          ? <div className="loading-state">Loading products...</div>
          : renderProductTable(rejectedProducts, 10, false, true)
        }
      </div>

      {/* IMAGES MODAL */}
      {selectedImages && (
        <div className="image-modal-overlay" onClick={() => setSelectedImages(null)}>
          <div className="image-modal-content" onClick={e => e.stopPropagation()}>
            <button className="close-modal" onClick={() => setSelectedImages(null)}>✕</button>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", justifyContent: "center" }}>
              {selectedImages.map((img, i) => (
                <img
                  key={i}
                  src={img.image_url}
                  alt={`Product ${i + 1}`}
                  style={{ width: "200px", height: "200px", objectFit: "cover", borderRadius: "8px" }}
                />
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
            <textarea
              placeholder="Write reason here..."
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
            />
            <div className="modal-actions">
              <button
                className="cancel"
                onClick={() => setSelectedProduct(null)}
                disabled={processing}
              >
                Cancel
              </button>
              <button
                className="confirm"
                onClick={handleConfirmReject}
                disabled={processing}
              >
                {processing ? "Processing..." : "Confirm"}
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