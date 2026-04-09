import { useState } from "react";
import "../styles/createAuction.css";

const CreateAuction = ({ onBack }) => {
    const [form, setForm] = useState({
        title: "",
        category: "",
        shortDesc: "",
        description: "",
        condition: "",
        material: "",
        dimensions: "",
        weight: "",
        startPrice: "",
        minIncrement: "",
        reservePrice: "",
        startTime: "",
        endTime: "",
        autoExtend: false,
        location: "",
        shippingCost: "",
        dispatchTime: "",
        visibility: "public",
        agreement: false,
    });

    const [images, setImages] = useState([]);
    const [error, setError] = useState("");

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setForm({ ...form, [name]: type === "checkbox" ? checked : value });
    };

    /* MULTIPLE IMAGE HANDLER */
    const handleImageChange = (e) => {
        const files = Array.from(e.target.files);

        const totalImages = images.length + files.length;

        if (totalImages > 8) {
            setError("Maximum 8 images allowed.");
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

    const handleSubmit = (e) => {
        e.preventDefault();

        if (!form.title || !form.category || !form.startPrice) {
            setError("Please fill all required fields.");
            return;
        }

        if (images.length < 4) {
            setError("You must upload at least 4 product images.");
            return;
        }

        setError("");

        console.log("Auction Created:", form);
        console.log("Images:", images);

        onBack();
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
                            <input className="form-input" name="title" onChange={handleChange} required />                        </div>

                        <div>
                            <label>Category *</label>
                            <select className="form-select" name="category" onChange={handleChange} required>
                                <option value="">Select Category</option>
                                <option>Furniture</option>
                                <option>Antique</option>
                                <option>Electronics</option>
                                <option>Artwork</option>
                                <option>Jewelry</option>
                                <option>Luxury Watches</option>
                                <option>Interiors</option>
                                <option>Music,Movies & Cameras</option>
                                <option>Coins & Stamps</option>
                                <option>Fashion</option>
                                <option>Toys & Models</option>
                            </select>
                        </div>
                    </div>

                    <label>Short Description</label>
                    <input className="form-input" name="shortDesc" onChange={handleChange} />

                    <label>Detailed Description</label>
                    <textarea className="form-textarea" name="description" onChange={handleChange} />

                    {/* Image Upload */}
                    <label>Product Images (Minimum 4 Required)</label>
                    <input className="form-input"
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleImageChange}
                    />

                    <div className="image-grid">
                        {images.map((img, index) => (
                            <div key={index} className="image-preview-box">
                                <img src={img.preview} alt="preview" />
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

                {/* ITEM DETAILS */}
                <div className="form-card">
                    <h3>Item Specifications</h3>

                    <div className="spec-grid">
                        <div className="spec-field">
                            <label>Condition</label>
                            <select className="form-select" name="condition" onChange={handleChange}>
                                <option value="">Select</option>
                                <option>New</option>
                                <option>Used</option>
                                <option>Antique</option>
                            </select>
                        </div>

                        <div className="spec-field">
                            <label>Material</label>
                            <input className="form-input"
                                name="material"
                                placeholder="e.g. Solid Wood"
                                onChange={handleChange}
                            />
                        </div>

                        <div className="spec-field">
                            <label>Dimensions</label>
                            <input className="form-input"
                                name="dimensions"
                                placeholder="HxWxD (cm)"
                                onChange={handleChange}
                            />
                        </div>

                        <div className="spec-field">
                            <label>Weight (Optional)</label>
                            <input className="form-input"
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
                        <input className="form-input"
                            type="number"
                            name="startPrice"
                            placeholder="Starting Price *"
                            onChange={handleChange}
                            required
                        />

                        <input className="form-input"
                            type="number"
                            name="minIncrement"
                            placeholder="Min Bid Increment"
                            onChange={handleChange}
                        />

                        <input className="form-input"
                            type="number"
                            name="reservePrice"
                            placeholder="Reserve Price"
                            onChange={handleChange}
                        />
                    </div>
                </div>

                {/* TIMING */}
                <div className="form-card">
                    <h3>Auction Timing</h3>

                    <div className="grid-2">
                        <div>
                            <label>Start Time</label>
                            <input className="form-input"
                                type="datetime-local"
                                name="startTime"
                                onChange={handleChange}
                            />
                        </div>

                        <div>
                            <label>End Time</label>
                            <input className="form-input"
                                type="datetime-local"
                                name="endTime"
                                onChange={handleChange}
                            />
                        </div>
                    </div>

                    <label className="custom-checkbox">
                        <input className="form-input"
                            type="checkbox"
                            name="autoExtend"
                            checked={form.autoExtend}
                            onChange={handleChange}
                        />
                        <span className="checkmark"></span>
                        <span className="checkbox-text">Auto-extend auction</span>
                    </label>

                </div>

                {/* ACTION BUTTONS */}
                <div className="form-actions">
                    <button type="button" className="btn-secondary" onClick={onBack}>
                        Cancel
                    </button>

                    <button type="submit" className="btn-primary">
                        Create Auction
                    </button>
                </div>
            </form>
        </div>
    );
};

export default CreateAuction;
