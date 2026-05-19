import { useState, useEffect } from "react";
import { FaTimes, FaIdCard, FaUpload, FaCheckCircle } from "react-icons/fa";
import { supabase } from "../../supabase/supabase";
import { useAuthContext } from "../../context/AuthContext";
import toast from "react-hot-toast";
import "../styles/auth.css";

const CnicModal = ({ closeModal }) => {
  const { user } = useAuthContext();

  const [existingSubmissionId, setExistingSubmissionId] = useState(null);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [alreadyPending, setAlreadyPending] = useState(false);

  const [cnic, setCnic] = useState("");
  const [front, setFront] = useState(null);
  const [back, setBack] = useState(null);
  const [frontPreview, setFrontPreview] = useState(null);
  const [backPreview, setBackPreview] = useState(null);
  const [loading, setLoading] = useState(false);

  // Check existing submission on mount
  useEffect(() => {
    const checkExisting = async () => {
      if (!user) return;
      try {
        setCheckingStatus(true);

        const { data: existing } = await supabase
          .from("pending_cnic_submissions")
          .select("id, status, cnic_number")
          .eq("user_id", user.id)
          .maybeSingle();

        if (existing) {
          if (existing.status === "pending") {
            setAlreadyPending(true);
          } else if (existing.status === "rejected") {
            // Allow resubmission
            setExistingSubmissionId(existing.id);
            setCnic(existing.cnic_number || "");
          }
          // If approved — they are already a buyer, modal shouldn't open
        }
      } catch (err) {
        console.error(err);
      } finally {
        setCheckingStatus(false);
      }
    };

    checkExisting();
  }, [user]);

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
    if (cnic.length < 15) { toast.error("Please enter a valid CNIC number"); return; }

    try {
      setLoading(true);

      // Step 1: Upload images
      const frontPath = `buyers/${user.id}/front`;
      const { error: frontError } = await supabase.storage
        .from("cnic-images")
        .upload(frontPath, front, { upsert: true });

      if (frontError) {
        toast.error("Error uploading front image");
        console.error(frontError);
        return;
      }

      const backPath = `buyers/${user.id}/back`;
      const { error: backError } = await supabase.storage
        .from("cnic-images")
        .upload(backPath, back, { upsert: true });

      if (backError) {
        toast.error("Error uploading back image");
        console.error(backError);
        return;
      }

      const submissionPayload = {
        user_id: user.id,
        cnic_number: cnic,
        email: user.email,
        status: "pending",
      };

      // Step 2: Insert or update submission
      if (existingSubmissionId) {
        // Resubmission after rejection — update existing row
        const { error: updateError } = await supabase
          .from("pending_cnic_submissions")
          .update({ cnic_number: cnic, status: "pending" })
          .eq("id", existingSubmissionId);

        if (updateError) {
          toast.error("Error resubmitting CNIC");
          console.error(updateError);
          return;
        }
      } else {
        // Fresh submission — insert new row
        const { error: insertError } = await supabase
          .from("pending_cnic_submissions")
          .insert(submissionPayload);

        if (insertError) {
          toast.error("Error submitting CNIC");
          console.error(insertError);
          return;
        }
      }

      // Step 3: Update profile id_verified to pending
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ id_verified: "pending" })
        .eq("id", user.id);

      if (profileError) {
        toast.error("Error updating profile");
        console.error(profileError);
        return;
      }

      // Step 4: Notify admin
      const { data: adminData } = await supabase
        .from("profiles")
        .select("id")
        .eq("role", "admin")
        .maybeSingle();

      if (adminData) {
        await supabase.from("notifications").insert({
          user_id: adminData.id,
          title: existingSubmissionId
            ? "CNIC Resubmitted for Verification"
            : "New CNIC Verification Request",
          message: "A user has submitted their CNIC for verification.",
          type: "approval",
          notification_for: "admin",
          is_read: false,
        });
      }

      toast.success("CNIC submitted! Waiting for admin approval.");
      closeModal();

    } catch (err) {
      console.error(err);
      toast.error("Error submitting CNIC. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (checkingStatus) {
    return (
      <div className="auth-overlay">
        <div className="auth-modal form-modal" style={{ textAlign: "center", padding: "40px" }}>
          <p>Checking your status...</p>
        </div>
      </div>
    );
  }

  if (alreadyPending) {
    return (
      <div className="auth-overlay">
        <div className="auth-modal form-modal">
          <FaTimes className="close-icon" onClick={closeModal} />
          <div className="form-modal-header">
            <div className="form-modal-icon"><FaIdCard /></div>
            <h2>Verification Pending</h2>
            <p className="form-modal-subtitle">
              Your CNIC is already submitted and is currently under review.
              You will be notified once admin approves your identity.
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
          <div className="form-modal-icon"><FaIdCard /></div>
          <h2>
            {existingSubmissionId ? "Resubmit CNIC Verification" : "CNIC Verification"}
          </h2>
          <p className="form-modal-subtitle">
            Submit your identity documents to unlock bidding features
          </p>
          {existingSubmissionId && (
            <p style={{ color: "#ef4444", fontSize: "13px", marginTop: "6px" }}>
              Your previous submission was rejected. Please update your CNIC information and resubmit.
            </p>
          )}
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
                style={{ display: "none" }}
                onChange={(e) => handleFileChange(e, "front")} />
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
                style={{ display: "none" }}
                onChange={(e) => handleFileChange(e, "back")} />
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
            ) : existingSubmissionId ? "Resubmit for Verification" : "Submit for Verification"}
          </button>

        </form>
      </div>
    </div>
  );
};

export default CnicModal;