import { useState, useEffect } from "react";
import { FaCheckCircle, FaUpload, FaTimes, FaStore } from "react-icons/fa";
import { supabase } from "../../supabase/supabase";
import { useAuthContext } from "../../context/AuthContext";
import toast from "react-hot-toast";
import "../styles/auth.css";

const SellerRegistrationModal = ({ closeModal }) => {
  const { user, profile } = useAuthContext();

  const [existingSellerId, setExistingSellerId] = useState(null);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [alreadyPending, setAlreadyPending] = useState(false);

  const [formData, setFormData] = useState({
    businessName: "",
    phone: "",
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

  // Check existing seller record on mount
  useEffect(() => {
    const checkExisting = async () => {
      if (!user) return;
      try {
        setCheckingStatus(true);

        const { data: existing } = await supabase
          .from("sellers")
          .select("id, is_verified")
          .eq("user_id", user.id)
          .maybeSingle();

        if (existing) {
          if (existing.is_verified === "pending") {
            setAlreadyPending(true);
          } else if (existing.is_verified === "rejected" || existing.is_verified === "suspended") {
            // Allow resubmission — store the existing id to update instead of insert
            setExistingSellerId(existing.id);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setCheckingStatus(false);
      }
    };

    checkExisting();
  }, [user]);

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

    if (!user) { toast.error("Please login first"); return; }
    if (!formData.cnicFront || !formData.cnicBack) {
      toast.error("Please upload both CNIC images");
      return;
    }
    if (cnic.length < 15) {
      toast.error("Please enter a valid CNIC number");
      return;
    }

    try {
      setLoading(true);

      // Step 1: Upload CNIC front
      const frontPath = `sellers/${user.id}/front`;
      const { error: frontError } = await supabase.storage
        .from("cnic-images")
        .upload(frontPath, formData.cnicFront, { upsert: true });

      if (frontError) {
        toast.error("Error uploading CNIC front image");
        console.error(frontError);
        return;
      }

      // Step 2: Upload CNIC back
      const backPath = `sellers/${user.id}/back`;
      const { error: backError } = await supabase.storage
        .from("cnic-images")
        .upload(backPath, formData.cnicBack, { upsert: true });

      if (backError) {
        toast.error("Error uploading CNIC back image");
        console.error(backError);
        return;
      }

      const sellerPayload = {
        business_name: formData.businessName,
        address: formData.address,
        city: formData.city,
        postal_code: formData.postalCode,
        phone_no: formData.phone,
        description: formData.description,
        cnic_number: cnic,
        cnic_front: `sellers/${user.id}/front`,
        cnic_back: `sellers/${user.id}/back`,
        is_verified: "pending",
      };

      // Step 3: Insert or update seller record
      if (existingSellerId) {
        // Resubmission after rejection — update existing row
        const { error: updateError } = await supabase
          .from("sellers")
          .update(sellerPayload)
          .eq("id", existingSellerId);

        if (updateError) {
          toast.error("Error resubmitting seller form");
          console.error(updateError);
          return;
        }
      } else {
        // Fresh submission — insert new row
        const { error: insertError } = await supabase
          .from("sellers")
          .insert({ user_id: user.id, ...sellerPayload });

        if (insertError) {
          toast.error("Error submitting seller form");
          console.error(insertError);
          return;
        }
      }

      // Step 4: Notify admin
      const { data: adminData } = await supabase
        .from("profiles")
        .select("id")
        .eq("role", "admin")
        .single();

      if (adminData) {
        await supabase.from("notifications").insert({
          user_id: adminData.id,
          title: existingSellerId
            ? "Seller Resubmitted Application"
            : "New Seller Registration",
          message: `${profile?.name || user?.email} has submitted a seller registration form.`,
          type: "approval",
          notification_for: "admin",
          is_read: false,
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

  // Loading state while checking
  if (checkingStatus) {
    return (
      <div className="auth-overlay">
        <div className="auth-modal form-modal" style={{ textAlign: "center", padding: "40px" }}>
          <p>Checking your status...</p>
        </div>
      </div>
    );
  }

  // Already pending
  if (alreadyPending) {
    return (
      <div className="auth-overlay">
        <div className="auth-modal form-modal">
          <FaTimes className="close-icon" onClick={closeModal} />
          <div className="form-modal-header">
            <div className="form-modal-icon"><FaStore /></div>
            <h2>Application Pending</h2>
            <p className="form-modal-subtitle">
              Your seller application is already under review. Please wait for admin approval.
              You will be notified once a decision is made.
            </p>
          </div>
          <button className="auth-btn" onClick={closeModal} style={{ marginTop: "20px" }}>
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-overlay">
      <div className="auth-modal form-modal">

        <FaTimes className="close-icon" onClick={closeModal} />

        <div className="form-modal-header">
          <div className="form-modal-icon"><FaStore /></div>
          <h2>
            {existingSellerId ? "Resubmit Seller Application" : "Seller Registration"}
          </h2>
          <p className="form-modal-subtitle">
            Registering as <strong>{profile?.email || user?.email}</strong>
          </p>
          {existingSellerId && (
            <p style={{ color: "#ef4444", fontSize: "13px", marginTop: "6px" }}>
              Your previous application was rejected. Please update your information and resubmit.
            </p>
          )}
        </div>

        <form className="auth-form form-grid" onSubmit={handleSubmit}>

          <div className="form-row">
            <div className="form-field">
              <label className="form-label">Business Name</label>
              <input
                className="auth-input"
                type="text"
                name="businessName"
                required
                onChange={handleChange}
              />
            </div>
            <div className="form-field">
              <label className="form-label">Phone Number</label>
              <input
                className="auth-input"
                type="text"
                name="phone"
                required
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-field">
              <label className="form-label">City</label>
              <input
                className="auth-input"
                type="text"
                name="city"
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
              required
              onChange={handleChange}
            />
          </div>

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

          <div className="form-field">
            <label className="form-label">CNIC Number</label>
            <input
              className="auth-input"
              type="text"
              value={cnic}
              onChange={handleCnicChange}
              maxLength={15}
              placeholder="XXXXX-XXXXXXX-X"
            />
          </div>

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
            ) : existingSellerId ? "Resubmit Application" : "Submit for Approval"}
          </button>

        </form>
      </div>
    </div>
  );
};

export default SellerRegistrationModal;