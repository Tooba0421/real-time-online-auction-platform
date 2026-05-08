import { useState } from "react";
import { FaTimes, FaIdCard, FaUpload, FaCheckCircle } from "react-icons/fa";
import { supabase } from "../../supabase/supabase";
import { useAuthContext } from "../../context/AuthContext";
import toast from "react-hot-toast";
import "../styles/auth.css";

const CnicModal = ({ closeModal }) => {
  const { user } = useAuthContext();

  const [cnic, setCnic] = useState("");
  const [front, setFront] = useState(null);
  const [back, setBack] = useState(null);
  const [frontPreview, setFrontPreview] = useState(null);
  const [backPreview, setBackPreview] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e, side) => {
    const file = e.target.files[0];
    if (!file) return;
    const preview = URL.createObjectURL(file);
    if (side === "front") { setFront(file); setFrontPreview(preview); }
    else { setBack(file); setBackPreview(preview); }
  };

  const handleCnicChange = (e) => {
    let val = e.target.value.replace(/[^0-9]/g, "");
    if (val.length > 5 && val.length <= 12) val = val.slice(0, 5) + "-" + val.slice(5);
    else if (val.length > 12) val = val.slice(0, 5) + "-" + val.slice(5, 12) + "-" + val.slice(12, 13);
    setCnic(val);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) { toast.error("User not logged in"); return; }
    if (!front || !back) { toast.error("Please upload both CNIC images"); return; }

    try {
      setLoading(true);

      const frontPath = `buyers/${user.id}/front`;
      const { error: frontError } = await supabase.storage
        .from("cnic-images").upload(frontPath, front, { upsert: true });
      if (frontError) { toast.error("Error uploading front image"); return; }

      const backPath = `buyers/${user.id}/back`;
      const { error: backError } = await supabase.storage
        .from("cnic-images").upload(backPath, back, { upsert: true });
      if (backError) { toast.error("Error uploading back image"); return; }

      const { data: frontURLData } = supabase.storage.from("cnic-images").getPublicUrl(frontPath);
      const { data: backURLData } = supabase.storage.from("cnic-images").getPublicUrl(backPath);

      const { data: existingBuyer } = await supabase
        .from("buyers").select("id").eq("user_id", user.id).single();

      const buyerPayload = {
        cnic_number: cnic,
        cnic_front: frontURLData.publicUrl,
        cnic_back: backURLData.publicUrl,
        is_verified: "pending"
      };

      if (existingBuyer) {
        const { error } = await supabase.from("buyers").update(buyerPayload).eq("user_id", user.id);
        if (error) { toast.error("Error saving CNIC data"); return; }
      } else {
        const { error } = await supabase.from("buyers").insert({ user_id: user.id, ...buyerPayload });
        if (error) { toast.error("Error saving CNIC data"); return; }
      }

      const { error: profileError } = await supabase
        .from("profiles").update({ id_verified: "pending" }).eq("id", user.id);
      if (profileError) { toast.error("Error updating profile"); return; }

      const { data: adminData } = await supabase
        .from("profiles").select("id").eq("role", "admin").single();
      if (adminData) {
        await supabase.from("notifications").insert({
          user_id: adminData.id,
          title: "New CNIC Verification Request",
          message: "A buyer has submitted their CNIC for verification.",
          type: "approval",
          notification_for: "admin",
          is_read: false
        });
      }

      toast.success("CNIC submitted! Waiting for admin approval.");
      closeModal();

    } catch (err) {
      console.error(err);
      toast.error("Error submitting CNIC");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-overlay">
      <div className="auth-modal form-modal">

        <FaTimes className="close-icon" onClick={closeModal} />

        <div className="form-modal-header">
          <div className="form-modal-icon">
            <FaIdCard />
          </div>
          <h2>CNIC Verification</h2>
          <p className="form-modal-subtitle">
            Submit your identity documents to unlock bidding features
          </p>
        </div>

        <form className="auth-form form-grid" onSubmit={handleSubmit}>

          <div className="form-field">
            <label className="form-label">CNIC Number</label>
            <input
              className="auth-input cnic-number-input"
              type="text"
              placeholder="XXXXX-XXXXXXX-X"
              required
              value={cnic}
              onChange={handleCnicChange}
              maxLength={15}
            />
          </div>

          <div className="form-upload-row">

            <div className="form-upload-box">
              <label className="form-label">Front Side</label>
              <label className="form-upload-area" htmlFor="cnic-front">
                {frontPreview ? (
                  <>
                    <img src={frontPreview} alt="Front preview" className="form-upload-preview" />
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
              <input id="cnic-front" type="file" accept="image/*"
                style={{ display: "none" }} onChange={(e) => handleFileChange(e, "front")} />
            </div>

            <div className="form-upload-box">
              <label className="form-label">Back Side</label>
              <label className="form-upload-area" htmlFor="cnic-back">
                {backPreview ? (
                  <>
                    <img src={backPreview} alt="Back preview" className="form-upload-preview" />
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
              <input id="cnic-back" type="file" accept="image/*"
                style={{ display: "none" }} onChange={(e) => handleFileChange(e, "back")} />
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
            ) : "Submit for Verification"}
          </button>

        </form>
      </div>
    </div>
  );
};

export default CnicModal;