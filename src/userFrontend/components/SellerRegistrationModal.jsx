import { useState } from "react";
import { FaTimes } from "react-icons/fa";
import { supabase } from "../../supabase/supabase";
import { useAuthContext } from "../../context/AuthContext";
import toast from "react-hot-toast";
import "../styles/auth.css";

const SellerRegistrationModal = ({ closeModal }) => {

  const { user } = useAuthContext();

  const [formData, setFormData] = useState({
    sellerName: "",
    phone: "",
    cnicNumber: "",
    city: "",
    postalCode: "",
    address: "",
    description: "",
    cnicFront: null,
    cnicBack: null,
  });

  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    if (files) {
      setFormData({ ...formData, [name]: files[0] });
    } else {
      setFormData({ ...formData, [name]: value });
    }
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
          email: user.email, // ✅ from auth, not form
          business_name: formData.sellerName,
          description: formData.description,
          address: formData.address,
          city: formData.city,
          postal_code: formData.postalCode,
          phone_no: formData.phone,
          cnic_number: formData.cnicNumber,
          cnic_front: frontURL,
          cnic_back: backURL,
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
      <div className="auth-modal seller-modal">

        <FaTimes className="close-icon" onClick={closeModal} />

        <h2>Seller Registration</h2>

        {/* Show verified email */}
        <div className="verified-email-banner">
          <p>Registering with: <strong>{user?.email}</strong> ✅</p>
        </div>

        <form className="auth-form seller-form" onSubmit={handleSubmit}>

          {/* Row 1 */}
          <div className="seller-row">
            <div className="input-front">
              <label>Full Name</label>
              <input
                className="auth-input"
                type="text"
                name="sellerName"
                placeholder="e.g. Ali Khan"
                required
                onChange={handleChange}
              />
            </div>

            <div className="input-front">
              <label>Phone Number</label>
              <input
                className="auth-input"
                type="text"
                name="phone"
                placeholder="03XX-XXXXXXX"
                required
                onChange={handleChange}
              />
            </div>
          </div>

          {/* Row 2 */}
          <div className="seller-row">
            <div className="input-front">
              <label>CNIC Number</label>
              <input
                className="auth-input"
                type="text"
                name="cnicNumber"
                placeholder="XXXXX-XXXXXXX-X"
                required
                onChange={handleChange}
              />
            </div>

            <div className="input-front">
              <label>City</label>
              <input
                className="auth-input"
                type="text"
                name="city"
                placeholder="e.g. Karachi"
                required
                onChange={handleChange}
              />
            </div>
          </div>

          {/* Row 3 */}
          <div className="seller-row">
            <div className="input-front">
              <label>Postal Code</label>
              <input
                className="auth-input"
                type="text"
                name="postalCode"
                placeholder="e.g. 75400"
                required
                onChange={handleChange}
              />
            </div>

            <div className="input-front">
              <label>Full Address</label>
              <input
                className="auth-input"
                type="text"
                name="address"
                placeholder="House #, Street, Area"
                required
                onChange={handleChange}
              />
            </div>
          </div>

          {/* Description */}
          <div className="input-front">
            <label>Business Description</label>
            <textarea
              className="auth-input"
              name="description"
              placeholder="Tell us about your business..."
              rows={3}
              onChange={handleChange}
            />
          </div>

          {/* File Upload */}
          <div className="seller-row">
            <div className="file-box">
              <label>CNIC Front Image</label>
              <input
                type="file"
                name="cnicFront"
                accept="image/*"
                required
                onChange={handleChange}
              />
            </div>

            <div className="file-box">
              <label>CNIC Back Image</label>
              <input
                type="file"
                name="cnicBack"
                accept="image/*"
                required
                onChange={handleChange}
              />
            </div>
          </div>

          <button className="auth-btn" disabled={loading}>
            {loading ? "Submitting..." : "Submit for Approval"}
          </button>

        </form>

      </div>
    </div>
  );
};

export default SellerRegistrationModal;