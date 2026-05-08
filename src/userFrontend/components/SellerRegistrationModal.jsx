import { useState } from "react";
import { FaCheckCircle, FaUpload, FaTimes, FaStore } from "react-icons/fa";
import { supabase } from "../../supabase/supabase";
import { useAuthContext } from "../../context/AuthContext";
import toast from "react-hot-toast";
import "../styles/auth.css";

const SellerRegistrationModal = ({ closeModal }) => {

  const { user } = useAuthContext();

  const [formData, setFormData] = useState({
    sellerName: "",
    businessName: "",
    phone: "",
    cnicNumber: "",
    city: "",
    postalCode: "",
    address: "",
    description: "",
    cnicFront: null,
    cnicBack: null,
  });

  const [cnic, setCnic] = useState("");
  const [frontPreview, setFrontPreview] = useState(null);
  const [backPreview, setBackPreview] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    if (files) {
      setFormData({ ...formData, [name]: files[0] });
      const preview = URL.createObjectURL(files[0]);
      if (name === "cnicFront") setFrontPreview(preview);
      if (name === "cnicBack") setBackPreview(preview);
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleCnicChange = (e) => {
    let val = e.target.value.replace(/[^0-9]/g, "");
    if (val.length > 5 && val.length <= 12) val = val.slice(0, 5) + "-" + val.slice(5);
    else if (val.length > 12) val = val.slice(0, 5) + "-" + val.slice(5, 12) + "-" + val.slice(12, 13);
    setCnic(val);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!user) {
      toast.error("Please login first");
      return;
    }

    if (!formData.cnicFront || !formData.cnicBack) {
      toast.error("Please upload both CNIC images");
      return;
    }

    try {
      setLoading(true);

      // Step 1: Upload CNIC front image
      const frontPath = `sellers/${user.id}/front`;
      const { error: frontError } = await supabase.storage
        .from("cnic-images")
        .upload(frontPath, formData.cnicFront, { upsert: true });

      if (frontError) {
        toast.error("Error uploading CNIC front image");
        console.error(frontError);
        return;
      }

      // Step 2: Upload CNIC back image
      const backPath = `sellers/${user.id}/back`;
      const { error: backError } = await supabase.storage
        .from("cnic-images")
        .upload(backPath, formData.cnicBack, { upsert: true });

      if (backError) {
        toast.error("Error uploading CNIC back image");
        console.error(backError);
        return;
      }

      // Step 3: Get public URLs
      const { data: frontURLData } = supabase.storage
        .from("cnic-images")
        .getPublicUrl(frontPath);

      const { data: backURLData } = supabase.storage
        .from("cnic-images")
        .getPublicUrl(backPath);

      const frontURL = frontURLData.publicUrl;
      const backURL = backURLData.publicUrl;

      // Step 4: Insert into sellers table
      const { error: sellerError } = await supabase
        .from("sellers")
        .insert({
          user_id: user.id,
          email: user.email,
          business_name: formData.businessName,
          seller_name: formData.sellerName,
          address: formData.address,
          city: formData.city,
          postal_code: formData.postalCode,
          phone_no: formData.phone,
          cnic_number: formData.cnicNumber,
          cnic_front: frontURLData.publicUrl,
          cnic_back: backURLData.publicUrl,
          is_verified: "pending"
        });

      if (sellerError) {
        toast.error("Error submitting seller form");
        console.error(sellerError);
        return;
      }

      // Step 5: Get admin id
      const { data: adminData } = await supabase
        .from("profiles")
        .select("id")
        .eq("role", "admin")
        .single();

      // Step 6: Notify admin
      if (adminData) {
        await supabase
          .from("notifications")
          .insert({
            user_id: adminData.id,
            title: "New Seller Registration",
            message: `${formData.sellerName} (${user.email}) has submitted a seller registration form.`,
            type: "approval",
            notification_for: "admin",
            is_read: false
          });
      }

      toast.success("Seller registration submitted! Waiting for admin approval.");
      closeModal();

    } catch (err) {
      console.error(err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-overlay">
      <div className="auth-modal form-modal">

        <FaTimes className="close-icon" onClick={closeModal} />

        {/* Header */}
        <div className="form-modal-header">
          <div className="form-modal-icon">
            <FaStore />
          </div>
          <h2>Seller Registration</h2>
          <p className="form-modal-subtitle">
            Registering as <strong>{user?.email}</strong>
          </p>
        </div>

        <form className="auth-form form-grid" onSubmit={handleSubmit}>

          {/* Row 1 */}
          <div className="form-row">
            <div className="form-field">
              <label className="form-label">Full Name</label>
              <input
                className="auth-input"
                type="text"
                name="sellerName"
                // placeholder="e.g. Ali Khan"
                required
                onChange={handleChange}
              />
            </div>

            <div className="form-field">
              <label className="form-label">Business Name</label>
              <input
                className="auth-input"
                type="text"
                name="businessName"
                // placeholder="e.g. Khan Traders"
                required
                onChange={handleChange} />
            </div>

          </div>

          {/* Row 2 */}
          <div className="form-row">
            <div className="form-field">
              <label className="form-label">Phone Number</label>
              <input
                className="auth-input"
                type="text"
                name="phone"
                // placeholder="03XX-XXXXXXX"
                required
                onChange={handleChange}
              />
            </div>

            <div className="form-field">
              <label className="form-label">CNIC Number</label>
              <input
                className="auth-input "
                type="text"
                name="cnicNumber"
                // placeholder="XXXXX-XXXXXXX-X"
                value={cnic}
                onChange={handleCnicChange}
                maxLength={15}
              />
            </div>
          </div>

          {/* Row 3 */}
          <div className="form-row">
            <div className="form-field">
              <label className="form-label">City</label>
              <input
                className="auth-input"
                type="text"
                name="city"
                // placeholder="e.g. Karachi"
                required
                onChange={handleChange}
              />
            </div>

            <div className="form-field">
              <label className="form-label">Postal Code</label>
              <input
                className="auth-input"
                type="text"
                name="postalCode"
                // placeholder="e.g. 75400"
                required
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-field">
            <label className="form-label">Full Address</label>
            <input
              className="auth-input"
              type="text"
              name="address"
              // placeholder="House #, Street, Area"
              required
              onChange={handleChange}
            />
          </div>

          {/* Description */}
          <div className="form-field">
            <label className="form-label">Description</label>
            <textarea
              className="auth-input"
              name="description"
              placeholder="Tell us about your business..."
              rows={3}
              onChange={handleChange}
            />
          </div>

          {/* CNIC Upload */}
          <div className="form-upload-row">

            <div className="form-upload-box">
              <label className="form-label">CNIC Front</label>
              <label className="form-upload-area" htmlFor="seller-cnic-front">
                {frontPreview ? (
                  <>
                    <img src={frontPreview} alt="Front" className="form-upload-preview" />
                    <div className="form-upload-overlay">
                      <FaCheckCircle className="form-check-icon" />
                      <span>Change</span>
                    </div>
                  </>
                ) : (
                  <>
                    <FaUpload className="form-upload-icon" />
                    <span className="form-upload-text">Upload Front</span>
                    <span className="form-upload-hint">JPG, PNG up to 5MB</span>
                  </>
                )}
              </label>
              <input id="seller-cnic-front" type="file" name="cnicFront"
                accept="image/*" style={{ display: "none" }} onChange={handleChange} />
            </div>

            <div className="form-upload-box">
              <label className="form-label">CNIC Back</label>
              <label className="form-upload-area" htmlFor="seller-cnic-back">
                {backPreview ? (
                  <>
                    <img src={backPreview} alt="Back" className="form-upload-preview" />
                    <div className="form-upload-overlay">
                      <FaCheckCircle className="form-check-icon" />
                      <span>Change</span>
                    </div>
                  </>
                ) : (
                  <>
                    <FaUpload className="form-upload-icon" />
                    <span className="form-upload-text">Upload Back</span>
                    <span className="form-upload-hint">JPG, PNG up to 5MB</span>
                  </>
                )}
              </label>
              <input id="seller-cnic-back" type="file" name="cnicBack"
                accept="image/*" style={{ display: "none" }} onChange={handleChange} />
            </div>

          </div>

          <p className="form-info-note">
            🔒 Your documents are encrypted and only reviewed by our verification team.
          </p>

          <button className="auth-btn form-submit-btn" disabled={loading}>
            {loading ? (
              <span className="form-btn-loading">
                <span className="form-btn-spinner" /> Submitting...
              </span>
            ) : "Submit for Approval"}
          </button>

        </form>

      </div>
    </div>
  );
};

export default SellerRegistrationModal;