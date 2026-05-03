import { useState } from "react";
import { supabase } from "../../supabase/supabase";
import { useAuthContext } from "../../context/AuthContext";
import toast from "react-hot-toast";
import "../styles/createAuction.css";

const CreateAuction = ({ onBack }) => {

    const { user } = useAuthContext();

    const [form, setForm] = useState({
        title: "",
        category: "",
        description: "",
        condition: "",
        material: "",
        dimension: "",
        weight: "",
        startPrice: "",
        minIncrement: "",
        reservePrice: "",
        startTime: "",
        endTime: "",
        autoExtend: false,
        agreement: false,
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
        const totalImages = images.length + files.length;

        if (totalImages > 6) {
            setError("Maximum 6 images allowed.");
            return;
        }

        const imagePreviews = files.map((file) => ({
            file,
            preview: URL.createObjectURL(file),
        }));

        setImages([...images, ...imagePreviews]);
        setError("");
    };

    const removeImage = (index) => {
        const updated = images.filter((_, i) => i !== index);
        setImages(updated);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validations
        if (!form.title || !form.category || !form.startPrice) {
            setError("Please fill all required fields.");
            return;
        }

        if (images.length < 4) {
            setError("You must upload at least 4 product images.");
            return;
        }

        if (!form.startTime || !form.endTime) {
            setError("Please set auction start and end time.");
            return;
        }

        if (new Date(form.endTime) <= new Date(form.startTime)) {
            setError("End time must be after start time.");
            return;
        }

        if (!form.agreement) {
            setError("Please agree to the terms and conditions.");
            return;
        }

        setError("");

        try {
            setLoading(true);

            // Step 1: Get seller record
            const { data: sellerData, error: sellerError } = await supabase
                .from("sellers")
                .select("id")
                .eq("user_id", user.id)
                .eq("is_verified", "approved")
                .single();

            if (sellerError || !sellerData) {
                toast.error("You must be an approved seller to create an auction.");
                return;
            }

            // Step 2: Insert product into products table
            const { data: productData, error: productError } = await supabase
                .from("products")
                .insert({
                    seller_id: sellerData.id,
                    title: form.title,
                    description: form.description,
                    category: form.category,
                    condition: form.condition || null,
                    material: form.material || null,
                    dimension: form.dimension || null,
                    weight: form.weight ? parseFloat(form.weight) : null,
                    base_price: parseFloat(form.startPrice),
                    reserved_price: form.reservePrice ? parseFloat(form.reservePrice) : null,
                    status: "pending"
                })
                .select()
                .single();

            if (productError) {
                toast.error("Error creating product listing.");
                console.error(productError);
                return;
            }

            // Step 3: Upload images to Supabase Storage
            const imageURLs = [];

            for (let i = 0; i < images.length; i++) {
                const image = images[i];
                const filePath = `products/${productData.id}/image_${i + 1}`;

                const { error: uploadError } = await supabase.storage
                    .from("auction-images")
                    .upload(filePath, image.file, { upsert: true });

                if (uploadError) {
                    toast.error(`Error uploading image ${i + 1}`);
                    console.error(uploadError);
                    return;
                }

                const { data: urlData } = supabase.storage
                    .from("auction-images")
                    .getPublicUrl(filePath);

                imageURLs.push({
                    url: urlData.publicUrl,
                    isPrimary: i === 0 // first image is primary
                });
            }

            // Step 4: Insert images into product_images table
            const imageInserts = imageURLs.map((img) => ({
                product_id: productData.id,
                image_url: img.url,
                is_primary: img.isPrimary
            }));

            const { error: imageError } = await supabase
                .from("product_images")
                .insert(imageInserts);

            if (imageError) {
                toast.error("Error saving product images.");
                console.error(imageError);
                return;
            }

            // Step 5: Create auction
            const { data: auctionData, error: auctionError } = await supabase
                .from("auctions")
                .insert({
                    product_id: productData.id,
                    seller_id: sellerData.id,
                    start_time: new Date(form.startTime).toISOString(),
                    end_time: new Date(form.endTime).toISOString(),
                    min_increment: parseFloat(form.minIncrement) || 0,
                    highest_bid: 0,
                    status: "scheduled",
                    approval_status: "pending",
                    auto_extend: form.autoExtend
                })
                .select()
                .single();

            if (auctionError) {
                toast.error("Error creating auction.");
                console.error(auctionError);
                return;
            }

            // Step 6: Notify admin
            const { data: adminData } = await supabase
                .from("profiles")
                .select("id")
                .eq("role", "admin")
                .single();

            if (adminData) {
                await supabase
                    .from("notifications")
                    .insert({
                        user_id: adminData.id,
                        title: "New Auction Created",
                        message: `A new auction "${form.title}" has been submitted for approval.`,
                        type: "approval",
                        notification_for: "admin",
                        is_read: false
                    });
            }

            toast.success("Auction created successfully! Waiting for admin approval.");
            onBack();

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
                            <input
                                className="form-input"
                                name="title"
                                onChange={handleChange}
                                required
                            />
                        </div>

                        <div>
                            <label>Category *</label>
                            <select
                                className="form-select"
                                name="category"
                                onChange={handleChange}
                                required
                            >
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
                    </div>

                    <label>Description</label>
                    <textarea
                        className="form-textarea"
                        name="description"
                        onChange={handleChange}
                    />

                    {/* Image Upload */}
                    <label>Product Images (Min 4, Max 6)</label>
                    <input
                        className="form-input"
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleImageChange}
                    />

                    <div className="image-grid">
                        {images.map((img, index) => (
                            <div key={index} className="image-preview-box">
                                <img src={img.preview} alt="preview" />
                                {index === 0 && (
                                    <span className="primary-badge">Primary</span>
                                )}
                                <button
                                    type="button"
                                    className="remove-img"
                                    onClick={() => removeImage(index)}
                                >
                                    x
                                </button>
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
                            <select
                                className="form-select"
                                name="condition"
                                onChange={handleChange}
                            >
                                <option value="">Select</option>
                                <option value="new">New</option>
                                <option value="used">Used</option>
                                <option value="antique">Antique</option>
                            </select>
                        </div>

                        <div className="spec-field">
                            <label>Material</label>
                            <input
                                className="form-input"
                                name="material"
                                placeholder="e.g. Solid Wood"
                                onChange={handleChange}
                            />
                        </div>

                        <div className="spec-field">
                            <label>Dimension</label>
                            <input
                                className="form-input"
                                name="dimension"
                                placeholder="HxW (cm)"
                                onChange={handleChange}
                            />
                        </div>

                        <div className="spec-field">
                            <label>Weight (Optional)</label>
                            <input
                                className="form-input"
                                name="weight"
                                placeholder="Weight in kg"
                                onChange={handleChange}
                            />
                        </div>
                    </div>
                </div>

                {/* PRICING */}
                <div className="form-card">
                    <h3>Pricing & Rules</h3>

                    <div className="grid-3">
                        <input
                            className="form-input"
                            type="number"
                            name="startPrice"
                            placeholder="Starting Price (PKR) *"
                            onChange={handleChange}
                            required
                        />

                        <input
                            className="form-input"
                            type="number"
                            name="minIncrement"
                            placeholder="Min Bid Increment (PKR)"
                            onChange={handleChange}
                        />

                        <input
                            className="form-input"
                            type="number"
                            name="reservePrice"
                            placeholder="Reserve Price (PKR)"
                            onChange={handleChange}
                        />
                    </div>
                </div>

                {/* TIMING */}
                <div className="form-card">
                    <h3>Auction Timing</h3>

                    <div className="grid-2">
                        <div>
                            <label>Start Time *</label>
                            <input
                                className="form-input"
                                type="datetime-local"
                                name="startTime"
                                onChange={handleChange}
                                required
                            />
                        </div>

                        <div>
                            <label>End Time *</label>
                            <input
                                className="form-input"
                                type="datetime-local"
                                name="endTime"
                                onChange={handleChange}
                                required
                            />
                        </div>
                    </div>

                    <label className="custom-checkbox">
                        <input
                            type="checkbox"
                            name="autoExtend"
                            checked={form.autoExtend}
                            onChange={handleChange}
                        />
                        <span className="checkmark"></span>
                        <span className="checkbox-text">
                            Auto-extend auction by 5 minutes if bid placed in last 2 minutes
                        </span>
                    </label>
                </div>

                {/* AGREEMENT */}
                <div className="form-card">
                    <label className="custom-checkbox">
                        <input
                            type="checkbox"
                            name="agreement"
                            checked={form.agreement}
                            onChange={handleChange}
                            required
                        />
                        <span className="checkmark"></span>
                        <span className="checkbox-text">
                            I agree to the terms and conditions of this platform
                        </span>
                    </label>
                </div>

                {/* ERROR MESSAGE */}
                {error && (
                    <p className="form-error">{error}</p>
                )}

                {/* ACTION BUTTONS */}
                <div className="form-actions">
                    <button
                        type="button"
                        className="btn-secondary"
                        onClick={onBack}
                        disabled={loading}
                    >
                        Cancel
                    </button>

                    <button
                        type="submit"
                        className="btn-primary"
                        disabled={loading}
                    >
                        {loading ? "Creating Auction..." : "Create Auction"}
                    </button>
                </div>

            </form>
        </div>
    );
};

export default CreateAuction;