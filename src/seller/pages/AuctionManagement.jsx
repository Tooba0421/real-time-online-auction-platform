import { useState, useMemo, useEffect } from "react";
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { supabase } from "../../supabase/supabase";
import { useAuthContext } from "../../context/AuthContext";
import {
  pauseAuction, resumeAuction, closeAuction, cancelAuction
} from "../../utils/auctionHelper";
import toast from "react-hot-toast";
import StatCard from "../../common/components/StatCard";
import StatusBadge from "../../common/components/StatusBadge";
import ActionButton from "../../common/components/ActionButton";
import "../styles/sellerLayout.css";
import "../styles/auctionManagement.css";

ChartJS.register(ArcElement, Tooltip, Legend);

const AuctionManagement = ({ openCreateAuction }) => {
  const { user } = useAuthContext();

  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  const [selectedResult, setSelectedResult] = useState(null);
  const [showReason, setShowReason] = useState(null);

  // Edit modal state
  const [editAuction, setEditAuction] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editImages, setEditImages] = useState([]); // existing images from DB
  const [newImages, setNewImages] = useState([]);   // newly uploaded files
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetchAuctions();
  }, [user]);

  const fetchAuctions = async () => {
    try {
      setLoading(true);

      const { data: sellerData } = await supabase
        .from("sellers")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!sellerData) return;

      const { data, error } = await supabase
        .from("auctions")
        .select(`
          *,
          products (
            id, title, category, base_price, description,
            product_images ( image_url, is_primary )
          ),
          bids ( id, bid_amount )
        `)
        .eq("seller_id", sellerData.id)
        .order("created_at", { ascending: false });

      if (error) {
        toast.error("Error fetching auctions");
        console.error(error);
        return;
      }

      // Rejection reasons
      const productIds = data?.map((a) => a.products?.id).filter(Boolean) || [];
      let reasonMap = {};
      if (productIds.length > 0) {
        const { data: actionData } = await supabase
          .from("admin_actions")
          .select("target_id, remarks")
          .in("target_id", productIds)
          .eq("action_type", "reject");
        actionData?.forEach((a) => { reasonMap[a.target_id] = a.remarks; });
      }

      // Winner names
      const endedWithWinner = data?.filter((a) => a.status === "ended" && a.winner_id) || [];
      let winnerMap = {};
      if (endedWithWinner.length > 0) {
        const winnerIds = endedWithWinner.map((a) => a.winner_id);
        const { data: winnerData } = await supabase
          .from("buyers")
          .select("id, profiles ( name )")
          .in("id", winnerIds);
        winnerData?.forEach((w) => { winnerMap[w.id] = w.profiles?.name || "—"; });
      }

      // Order info
      const auctionIds = data?.map((a) => a.id) || [];
      let orderMap = {};
      if (auctionIds.length > 0) {
        const { data: orderData } = await supabase
          .from("orders")
          .select("auction_id, order_status, payments ( status )")
          .in("auction_id", auctionIds);
        orderData?.forEach((o) => {
          orderMap[o.auction_id] = {
            orderStatus: o.order_status,
            paymentStatus: o.payments?.status,
          };
        });
      }

      setAuctions(
        (data || []).map((a) => ({
          ...a,
          rejectionReason: reasonMap[a.products?.id] || null,
          winnerName: winnerMap[a.winner_id] || null,
          orderInfo: orderMap[a.id] || null,
        }))
      );
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handlePause = async (auction) => {
    try {
      setProcessing(auction.id);
      await pauseAuction(auction.id);
      toast.success("Auction paused");
      fetchAuctions();
    } catch (err) {
      toast.error(err.message || "Failed to pause");
    } finally { setProcessing(null); }
  };

  const handleResume = async (auction) => {
    try {
      setProcessing(auction.id);
      await resumeAuction(auction.id, auction.paused_by);
      toast.success("Auction resumed");
      fetchAuctions();
    } catch (err) {
      toast.error(err.message || "Failed to resume");
    } finally { setProcessing(null); }
  };

  const handleClose = async (auction) => {
    if (!window.confirm(`Close auction for "${auction.products?.title}"?`)) return;
    try {
      setProcessing(auction.id);
      await closeAuction(auction.id);
      toast.success("Auction closed");
      fetchAuctions();
    } catch (err) {
      toast.error("Failed to close auction");
    } finally { setProcessing(null); }
  };

  const handleCancel = async (auction) => {
    if (!window.confirm(`Cancel auction for "${auction.products?.title}"? This cannot be undone.`)) return;
    try {
      setProcessing(auction.id);
      await cancelAuction(auction.id);
      toast.success("Auction cancelled");
      fetchAuctions();
    } catch (err) {
      toast.error("Failed to cancel auction");
    } finally { setProcessing(null); }
  };

  // Open edit modal — only for pending approval auctions
  const openEdit = (auction) => {
    if (auction.approval_status !== "pending") {
      toast.error("You can only edit auctions that are pending approval.");
      return;
    }
    setEditAuction(auction);
    setEditForm({
      title: auction.products?.title || "",
      category: auction.products?.category || "",
      description: auction.products?.description || "",
      start_time: auction.start_time
        ? new Date(auction.start_time).toISOString().slice(0, 16) : "",
      end_time: auction.end_time
        ? new Date(auction.end_time).toISOString().slice(0, 16) : "",
      min_increment: auction.min_increment || "",
      base_price: auction.products?.base_price || "",
    });
    // Load existing images
    setEditImages(auction.products?.product_images || []);
    setNewImages([]);
  };

  const handleNewImageChange = (e) => {
    const files = Array.from(e.target.files);
    const totalAfter = editImages.length + newImages.length + files.length;
    if (totalAfter > 6) {
      toast.error("Maximum 6 images allowed.");
      return;
    }
    const previews = files.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setNewImages((prev) => [...prev, ...previews]);
  };

  const removeExistingImage = (index) => {
    const remaining = editImages.filter((_, i) => i !== index);
    if (remaining.length + newImages.length < 4) {
      toast.error("You must have at least 4 images.");
      return;
    }
    setEditImages(remaining);
  };

  const removeNewImage = (index) => {
    const remaining = newImages.filter((_, i) => i !== index);
    if (editImages.length + remaining.length < 4) {
      toast.error("You must have at least 4 images.");
      return;
    }
    setNewImages(remaining);
  };

  const handleSaveEdit = async () => {
    if (!editForm.title.trim()) { toast.error("Title is required"); return; }
    if (!editForm.category) { toast.error("Category is required"); return; }
    if (!editForm.start_time || !editForm.end_time) { toast.error("Start and end time are required"); return; }
    if (new Date(editForm.end_time) <= new Date(editForm.start_time)) {
      toast.error("End time must be after start time"); return;
    }
    const totalImages = editImages.length + newImages.length;
    if (totalImages < 4) { toast.error("At least 4 images are required"); return; }

    try {
      setSaving(true);

      const productId = editAuction.products?.id;
      const auctionId = editAuction.id;

      // Step 1: Update product fields
      const { error: productError } = await supabase
        .from("products")
        .update({
          title: editForm.title,
          category: editForm.category,
          description: editForm.description,
          base_price: parseFloat(editForm.base_price) || 0,
        })
        .eq("id", productId);

      if (productError) {
        toast.error("Error updating product");
        console.error(productError);
        return;
      }

      // Step 2: Update auction fields
      const { error: auctionError } = await supabase
        .from("auctions")
        .update({
          start_time: new Date(editForm.start_time).toISOString(),
          end_time: new Date(editForm.end_time).toISOString(),
          min_increment: parseFloat(editForm.min_increment) || 0,
        })
        .eq("id", auctionId);

      if (auctionError) {
        toast.error("Error updating auction timing");
        console.error(auctionError);
        return;
      }

      // Step 3: Upload new images to storage
      const uploadedImages = [];
      for (let i = 0; i < newImages.length; i++) {
        const img = newImages[i];
        const filePath = `products/${productId}/image_edit_${Date.now()}_${i}`;
        const { error: uploadError } = await supabase.storage
          .from("auction-images")
          .upload(filePath, img.file, { upsert: true });

        if (uploadError) {
          toast.error(`Error uploading image ${i + 1}`);
          console.error(uploadError);
          return;
        }

        const { data: urlData } = supabase.storage
          .from("auction-images")
          .getPublicUrl(filePath);

        uploadedImages.push({ image_url: urlData.publicUrl, is_primary: false });
      }

      // Step 4: Replace all product_images — delete old ones, insert current set
      await supabase.from("product_images").delete().eq("product_id", productId);

      const allImages = [
        ...editImages.map((img, i) => ({
          product_id: productId,
          image_url: img.image_url,
          is_primary: i === 0,
        })),
        ...uploadedImages.map((img, i) => ({
          product_id: productId,
          image_url: img.image_url,
          is_primary: editImages.length === 0 && i === 0,
        })),
      ];

      // Ensure first image is always primary
      if (allImages.length > 0) {
        allImages[0].is_primary = true;
        for (let i = 1; i < allImages.length; i++) allImages[i].is_primary = false;
      }

      const { error: imgInsertError } = await supabase
        .from("product_images")
        .insert(allImages);

      if (imgInsertError) {
        toast.error("Error saving images");
        console.error(imgInsertError);
        return;
      }

      toast.success("Auction updated successfully");
      setEditAuction(null);
      setNewImages([]);
      setEditImages([]);
      fetchAuctions();

    } catch (err) {
      console.error(err);
      toast.error("Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const filteredAuctions = auctions.filter((a) => {
    const title = a.products?.title?.toLowerCase() || "";
    const matchesSearch =
      title.includes(search.toLowerCase()) ||
      a.id.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === "all" || a.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const stats = useMemo(() => ({
    total: auctions.length,
    live: auctions.filter((a) => a.status === "live").length,
    pending: auctions.filter((a) => a.approval_status === "pending").length,
    rejected: auctions.filter((a) => a.approval_status === "rejected").length,
  }), [auctions]);

  const statsData = [
    { title: "Total Auctions", value: loading ? "..." : stats.total, subtitle: "All created auctions" },
    { title: "Live Auctions", value: loading ? "..." : stats.live, subtitle: "Currently running" },
    { title: "Pending Approval", value: loading ? "..." : stats.pending, subtitle: "Awaiting admin review" },
    { title: "Rejected", value: loading ? "..." : stats.rejected, subtitle: "Declined by admin" },
  ];

  const statusChartData = useMemo(() => ({
    labels: ["Live", "Paused", "Scheduled", "Ended", "Cancelled"],
    datasets: [{
      data: [
        auctions.filter((a) => a.status === "live").length,
        auctions.filter((a) => a.status === "paused").length,
        auctions.filter((a) => a.status === "scheduled").length,
        auctions.filter((a) => a.status === "ended").length,
        auctions.filter((a) => a.status === "cancelled").length,
      ],
      backgroundColor: ["#22c55e", "#facc15", "#3b82f6", "#6b7280", "#ef4444"],
    }],
  }), [auctions]);

  const doughnutOptions = {
    responsive: true, maintainAspectRatio: false, cutout: "0%",
    layout: { padding: { top: 10, bottom: 30 } },
    plugins: { legend: { position: "top", align: "center", labels: { boxWidth: 30, padding: 15 } } },
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-PK", {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  };

  return (
    <div className="seller-page">

      {/* STAT CARDS */}
      <div className="stats-grid">
        {statsData.map((item, index) => (
          <StatCard key={index} title={item.title} value={item.value} subtitle={item.subtitle} />
        ))}
      </div>

      {/* CREATE BUTTON */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "1rem" }}>
        <button className="create-btn" onClick={openCreateAuction}>+ Create Auction</button>
      </div>

      {/* TABLE */}
      <div className="seller-section">
        <h3 className="seller-section-heading">All Auctions</h3>
        <div className="page-controls">
          <input
            type="text"
            placeholder="Search by product name or auction ID"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="all">All Status</option>
            <option value="live">Live</option>
            <option value="scheduled">Scheduled</option>
            <option value="paused">Paused</option>
            <option value="ended">Ended</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {loading ? (
          <div className="loading-state">Loading auctions...</div>
        ) : (
          <div className="table-wrapper">
            <table className="seller-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Base Price</th>
                  <th>Highest Bid</th>
                  <th>Total Bids</th>
                  <th>Start Time</th>
                  <th>End Time</th>
                  <th>Status</th>
                  <th>Approval</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAuctions.length === 0 ? (
                  <tr><td colSpan="10" className="no-data">No auctions found</td></tr>
                ) : (
                  filteredAuctions.map((a) => (
                    <tr key={a.id}>
                      <td>{a.products?.title || "—"}</td>
                      <td>{a.products?.category || "—"}</td>
                      <td>PKR {a.products?.base_price?.toLocaleString() || "—"}</td>
                      <td>PKR {a.highest_bid?.toLocaleString() || 0}</td>
                      <td>{a.bids?.length || 0}</td>
                      <td>{formatDate(a.start_time)}</td>
                      <td>{formatDate(a.end_time)}</td>
                      <td>
                        <StatusBadge
                          label={a.status.charAt(0).toUpperCase() + a.status.slice(1)}
                          type={a.status}
                        />
                      </td>
                      <td>
                        <StatusBadge
                          label={a.approval_status.charAt(0).toUpperCase() + a.approval_status.slice(1)}
                          type={a.approval_status}
                        />
                      </td>
                      <td className="actions">

                        {/* Pending approval → can edit or cancel */}
                        {a.approval_status === "pending" && (
                          <>
                            <ActionButton label="Edit" variant="secondary"
                              onClick={() => openEdit(a)} disabled={processing === a.id} />
                            <ActionButton label="Cancel" variant="danger"
                              onClick={() => handleCancel(a)} disabled={processing === a.id} />
                          </>
                        )}

                        {/* Live */}
                        {a.status === "live" && a.approval_status === "approved" && (
                          <>
                            <ActionButton label="Pause" variant="secondary"
                              onClick={() => handlePause(a)} disabled={processing === a.id} />
                            <ActionButton label="Close" variant="danger"
                              onClick={() => handleClose(a)} disabled={processing === a.id} />
                          </>
                        )}

                        {/* Paused */}
                        {a.status === "paused" && a.approval_status === "approved" && (
                          <>
                            {a.paused_by !== "admin" && (
                              <ActionButton label="Resume" variant="success"
                                onClick={() => handleResume(a)} disabled={processing === a.id} />
                            )}
                            <ActionButton label="Close" variant="danger"
                              onClick={() => handleClose(a)} disabled={processing === a.id} />
                          </>
                        )}

                        {/* Scheduled + approved → can only cancel */}
                        {a.status === "scheduled" && a.approval_status === "approved" && (
                          <ActionButton label="Cancel" variant="danger"
                            onClick={() => handleCancel(a)} disabled={processing === a.id} />
                        )}

                        {/* Ended */}
                        {a.status === "ended" && (
                          <ActionButton label="View Result" variant="secondary"
                            onClick={() => setSelectedResult(a)} />
                        )}

                        {/* Rejected */}
                        {a.approval_status === "rejected" && (
                          <ActionButton label="View Reason" variant="danger"
                            onClick={() => setShowReason(a.rejectionReason || "No reason provided")} />
                        )}

                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CHART */}
      <div className="overview-grid chart-space">
        <div className="chart-box">
          <h3 className="admin-section-heading">Auction Status Overview</h3>
          <div className="chart-container">
            <Doughnut data={statusChartData} options={doughnutOptions} />
          </div>
        </div>
      </div>

      {/* VIEW RESULT MODAL */}
      {selectedResult && (
        <div className="modal-overlay" onClick={() => setSelectedResult(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3>Auction Result</h3>
            <div className="result-info">
              {[
                ["Product", selectedResult.products?.title || "—"],
                ["Winner", selectedResult.winnerName || "No winner"],
                ["Final Bid", `PKR ${selectedResult.highest_bid?.toLocaleString() || 0}`],
                ["Total Bids", selectedResult.bids?.length || 0],
                ["Ended At", formatDate(selectedResult.end_time)],
                ["Order Status", selectedResult.orderInfo?.orderStatus || "No order yet"],
                ["Payment Status", selectedResult.orderInfo?.paymentStatus || "No payment yet"],
              ].map(([label, value]) => (
                <div className="result-row" key={label}>
                  <span className="result-label">{label}</span>
                  <span className="result-value">{value}</span>
                </div>
              ))}
            </div>
            <button className="create-btn" onClick={() => setSelectedResult(null)}>Close</button>
          </div>
        </div>
      )}

      {/* EDIT MODAL — full edit, only when approval_status === 'pending' */}
      {editAuction && (
        <div className="modal-overlay" onClick={() => setEditAuction(null)}>
          <div className="modal-box modal-box-wide" onClick={(e) => e.stopPropagation()}>
            <h3>Edit Auction — {editAuction.products?.title}</h3>
            <p className="modal-subtitle">
              You can edit all details since this auction is still pending admin approval.
            </p>

            <div className="edit-form">

              {/* Title */}
              <div className="edit-field">
                <label>Title *</label>
                <input type="text" className="form-input" value={editForm.title}
                  onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))} />
              </div>

              {/* Category */}
              <div className="edit-field">
                <label>Category *</label>
                <select className="form-select" value={editForm.category}
                  onChange={(e) => setEditForm((p) => ({ ...p, category: e.target.value }))}>
                  <option value="">Select Category</option>
                  <option value="Artwork">Artwork</option>
                  <option value="Electronics">Electronics</option>
                  <option value="Jewelry">Jewelry</option>
                  <option value="Antiques">Antiques</option>
                  <option value="Furniture">Furniture</option>
                  <option value="Interiors">Interiors</option>
                  <option value="Music">Music</option>
                  <option value="Movies & Cameras">Movies & Cameras</option>
                  <option value="Coins & Stamps">Coins & Stamps</option>
                  <option value="Fashion">Fashion</option>
                  <option value="Toys & Models">Toys & Models</option>
                  <option value="Luxury Watches">Luxury Watches</option>
                </select>
              </div>

              {/* Description */}
              <div className="edit-field">
                <label>Description</label>
                <textarea className="form-textarea" value={editForm.description} rows={3}
                  onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))} />
              </div>

              {/* Base Price */}
              <div className="edit-field">
                <label>Starting Price (PKR)</label>
                <input type="number" className="form-input" value={editForm.base_price}
                  onChange={(e) => setEditForm((p) => ({ ...p, base_price: e.target.value }))} />
              </div>

              {/* Timing */}
              <div className="edit-field">
                <label>Start Time *</label>
                <input type="datetime-local" className="form-input" value={editForm.start_time}
                  onChange={(e) => setEditForm((p) => ({ ...p, start_time: e.target.value }))} />
              </div>
              <div className="edit-field">
                <label>End Time *</label>
                <input type="datetime-local" className="form-input" value={editForm.end_time}
                  onChange={(e) => setEditForm((p) => ({ ...p, end_time: e.target.value }))} />
              </div>

              {/* Min Increment */}
              <div className="edit-field">
                <label>Min Bid Increment (PKR)</label>
                <input type="number" className="form-input" value={editForm.min_increment}
                  onChange={(e) => setEditForm((p) => ({ ...p, min_increment: e.target.value }))} />
              </div>

              {/* Images */}
              <div className="edit-field">
                <label>Product Images (Min 4, Max 6)</label>
                <input type="file" accept="image/*" multiple className="form-input"
                  onChange={handleNewImageChange} />

                <div className="image-grid" style={{ marginTop: "10px" }}>
                  {/* Existing images */}
                  {editImages.map((img, i) => (
                    <div key={`existing-${i}`} className="image-preview-box">
                      <img src={img.image_url} alt={`existing ${i}`} />
                      {i === 0 && <span className="primary-badge">Primary</span>}
                      <button type="button" className="remove-img"
                        onClick={() => removeExistingImage(i)}>x</button>
                    </div>
                  ))}
                  {/* New images */}
                  {newImages.map((img, i) => (
                    <div key={`new-${i}`} className="image-preview-box">
                      <img src={img.preview} alt={`new ${i}`} />
                      <span className="primary-badge" style={{ background: "#3b82f6" }}>New</span>
                      <button type="button" className="remove-img"
                        onClick={() => removeNewImage(i)}>x</button>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: "12px", color: "#999", marginTop: "6px" }}>
                  Total: {editImages.length + newImages.length} image(s) — min 4, max 6
                </p>
              </div>

            </div>

            <div className="modal-actions">
              <button className="close-btn" onClick={() => setEditAuction(null)} disabled={saving}>
                Cancel
              </button>
              <button className="create-btn" onClick={handleSaveEdit} disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REJECTION REASON MODAL */}
      {showReason && (
        <div className="modal-overlay" onClick={() => setShowReason(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3>Rejection Reason</h3>
            <p style={{ color: "#555", lineHeight: "1.6" }}>{showReason}</p>
            <button className="create-btn" onClick={() => setShowReason(null)}>Close</button>
          </div>
        </div>
      )}

    </div>
  );
};

export default AuctionManagement;