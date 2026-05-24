import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabase/supabase";
import { useAuthContext } from "../../context/AuthContext";
import { useSellerContext } from "../../context/SellerContext";
import toast from "react-hot-toast";
import "../styles/createAuction.css";

const CATEGORIES = [
  "Artwork","Electronics","Jewelry","Antiques","Furniture",
  "Interiors","Music","Movies & Cameras","Coins & Stamps",
  "Fashion","Toys & Models","Luxury Watches",
];

const CreateAuction = () => {
  const navigate = useNavigate();
  const { user } = useAuthContext();
  // ✅ Use sellerId from context — no need to fetch it again
  const { sellerId, refetchAll } = useSellerContext();

  const [form, setForm] = useState({
    title: "", category: "", description: "", condition: "",
    material: "", dimension: "", weight: "", startPrice: "",
    minIncrement: "", reservePrice: "", startTime: "", endTime: "",
    autoExtend: false, agreement: false,
  });
  const [images, setImages] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm({ ...form, [name]: type === "checkbox" ? checked : value });
  };

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    if (images.length + files.length > 6) {
      setError("Maximum 6 images allowed."); return;
    }
    setImages([
      ...images,
      ...files.map((file) => ({ file, preview: URL.createObjectURL(file) })),
    ]);
    setError("");
  };

  const removeImage = (index) => setImages(images.filter((_, i) => i !== index));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.category || !form.startPrice) {
      setError("Please fill all required fields."); return;
    }
    if (images.length < 4) {
      setError("You must upload at least 4 product images."); return;
    }
    if (!form.startTime || !form.endTime) {
      setError("Please set auction start and end time."); return;
    }
    if (new Date(form.endTime) <= new Date(form.startTime)) {
      setError("End time must be after start time."); return;
    }
    if (!form.agreement) {
      setError("Please agree to the terms and conditions."); return;
    }

    setError("");

    try {
      setLoading(true);

      // ✅ sellerId already available from context — no extra query
      if (!sellerId) {
        toast.error("Seller account not found. Please contact support.");
        return;
      }

      // Insert product
      const { data: productData, error: productError } = await supabase
        .from("products")
        .insert({
          seller_id: sellerId,
          title: form.title,
          description: form.description,
          category: form.category,
          condition: form.condition || null,
          material: form.material || null,
          dimension: form.dimension || null,
          weight: form.weight ? parseFloat(form.weight) : null,
          base_price: parseFloat(form.startPrice),
          reserved_price: form.reservePrice ? parseFloat(form.reservePrice) : null,
          status: "pending",
        })
        .select()
        .single();

      if (productError) {
        toast.error("Error creating product listing."); return;
      }

      // Upload images
      const imageURLs = [];
      for (let i = 0; i < images.length; i++) {
        const filePath = `products/${productData.id}/image_${i + 1}`;
        const { error: uploadError } = await supabase.storage
          .from("auction-images")
          .upload(filePath, images[i].file, { upsert: true });
        if (uploadError) { toast.error(`Error uploading image ${i + 1}`); return; }
        const { data: urlData } = supabase.storage
          .from("auction-images").getPublicUrl(filePath);
        imageURLs.push({ url: urlData.publicUrl, isPrimary: i === 0 });
      }

      // Insert images
      const { error: imageError } = await supabase.from("product_images").insert(
        imageURLs.map((img) => ({
          product_id: productData.id,
          image_url: img.url,
          is_primary: img.isPrimary,
        }))
      );
      if (imageError) { toast.error("Error saving product images."); return; }

      // Create auction
      const { error: auctionError } = await supabase.from("auctions").insert({
        product_id: productData.id,
        seller_id: sellerId,
        start_time: new Date(form.startTime).toISOString(),
        end_time: new Date(form.endTime).toISOString(),
        min_increment: parseFloat(form.minIncrement) || 0,
        highest_bid: 0,
        status: "scheduled",
        approval_status: "pending",
        auto_extend: form.autoExtend,
      });
      if (auctionError) { toast.error("Error creating auction."); return; }

      // Notify admin
      const { data: adminData } = await supabase
        .from("profiles").select("id").eq("role", "admin").single();
      if (adminData) {
        await supabase.from("notifications").insert({
          user_id: adminData.id,
          title: "New Auction Created",
          message: `A new auction "${form.title}" has been submitted for approval.`,
          type: "approval",
          notification_for: "admin",
          is_read: false,
        });
      }

      toast.success("Auction created successfully! Waiting for admin approval.");

      // ✅ Trigger context refresh so all pages see the new auction immediately
      refetchAll();

      // Navigate back to auction management
      navigate("/seller/auction-management");

    } catch (err) {
      console.error(err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="create-auction">
      <div className="page-header">
        <h2>Create New Auction</h2>
        <p>Fill in the details below to list your item for auction.</p>
      </div>

      <form onSubmit={handleSubmit}>

        {/* BASIC INFORMATION */}
        <div className="form-card">
          <h3>Basic Information</h3>
          <div className="grid-2">
            <div>
              <label>Title *</label>
              <input className="form-input" name="title" onChange={handleChange} required />
            </div>
            <div>
              <label>Category *</label>
              <select className="form-select" name="category" onChange={handleChange} required>
                <option value="">Select Category</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <label>Description</label>
          <textarea className="form-textarea" name="description" onChange={handleChange} />

          <label>Product Images (Min 4, Max 6)</label>
          <input className="form-input" type="file" accept="image/*" multiple onChange={handleImageChange} />
          <div className="image-grid">
            {images.map((img, index) => (
              <div key={index} className="image-preview-box">
                <img src={img.preview} alt="preview" />
                {index === 0 && <span className="primary-badge">Primary</span>}
                <button type="button" className="remove-img" onClick={() => removeImage(index)}>x</button>
              </div>
            ))}
          </div>
        </div>

        {/* ITEM SPECIFICATIONS */}
        <div className="form-card">
          <h3>Item Specifications</h3>
          <div className="spec-grid">
            <div className="spec-field">
              <label>Condition</label>
              <select className="form-select" name="condition" onChange={handleChange}>
                <option value="">Select</option>
                <option value="new">New</option>
                <option value="used">Used</option>
                <option value="antique">Antique</option>
              </select>
            </div>
            <div className="spec-field">
              <label>Material</label>
              <input className="form-input" name="material" placeholder="e.g. Solid Wood" onChange={handleChange} />
            </div>
            <div className="spec-field">
              <label>Dimension</label>
              <input className="form-input" name="dimension" placeholder="HxW (cm)" onChange={handleChange} />
            </div>
            <div className="spec-field">
              <label>Weight (Optional)</label>
              <input className="form-input" name="weight" placeholder="Weight in kg" onChange={handleChange} />
            </div>
          </div>
        </div>

        {/* PRICING */}
        <div className="form-card">
          <h3>Pricing & Rules</h3>
          <div className="grid-3">
            <input className="form-input" type="number" name="startPrice"
              placeholder="Starting Price (PKR) *" onChange={handleChange} required />
            <input className="form-input" type="number" name="minIncrement"
              placeholder="Min Bid Increment (PKR)" onChange={handleChange} />
            <input className="form-input" type="number" name="reservePrice"
              placeholder="Reserve Price (PKR)" onChange={handleChange} />
          </div>
        </div>

        {/* TIMING */}
        <div className="form-card">
          <h3>Auction Timing</h3>
          <div className="grid-2">
            <div>
              <label>Start Time *</label>
              <input className="form-input" type="datetime-local" name="startTime"
                onChange={handleChange} required />
            </div>
            <div>
              <label>End Time *</label>
              <input className="form-input" type="datetime-local" name="endTime"
                onChange={handleChange} required />
            </div>
          </div>
          <label className="custom-checkbox">
            <input type="checkbox" name="autoExtend" checked={form.autoExtend} onChange={handleChange} />
            <span className="checkmark"></span>
            <span className="checkbox-text">
              Auto-extend auction by 5 minutes if bid placed in last 2 minutes
            </span>
          </label>
        </div>

        {/* AGREEMENT */}
        <div className="form-card">
          <label className="custom-checkbox">
            <input type="checkbox" name="agreement" checked={form.agreement}
              onChange={handleChange} required />
            <span className="checkmark"></span>
            <span className="checkbox-text">
              I agree to the terms and conditions of this platform
            </span>
          </label>
        </div>

        {error && <p className="form-error">{error}</p>}

        <div className="form-actions">
          <button type="button" className="btn-secondary"
            onClick={() => navigate("/seller/auction-management")} disabled={loading}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Creating Auction..." : "Create Auction"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateAuction;