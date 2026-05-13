import { useState } from "react";
import { FaTimes } from "react-icons/fa";
import { supabase } from "../../supabase/supabase";
import toast from "react-hot-toast";
import "../styles/auth.css";

const ResetPasswordModal = ({ closeModal, isValid }) => {

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    try {
      setLoading(true);

      const { data, error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      setDone(true);
      toast.success("Password updated successfully!");

    } catch (err) {
      console.error(err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!isValid) {
    return (
      <div className="auth-overlay">
        <div className="auth-modal">
          <FaTimes className="close-icon" onClick={closeModal} />
          <h2>Invalid Link ❌</h2>
          <p className="auth-subtitle">
            This reset link is invalid or has expired.
            Please request a new one.
          </p>
          <button className="auth-btn" onClick={closeModal}>
            Close
          </button>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="auth-overlay">
        <div className="auth-modal">
          <FaTimes className="close-icon" onClick={closeModal} />
          <div className="success-message">
            <h2>Password Updated! ✅</h2>
            <p>Your password has been updated successfully.</p>
            <p>Please login with your new password.</p>
            <button className="auth-btn" onClick={closeModal}>
              Login Now
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-overlay">
      <div className="auth-modal">
        <FaTimes className="close-icon" onClick={closeModal} />
        <h2>Reset Password</h2>
        <p className="auth-subtitle">
          Enter your new password below.
        </p>
        <form className="auth-form" onSubmit={handleSubmit}>
          <input
            className="auth-input"
            type="password"
            placeholder="New Password (min 6 characters)"
            required
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <input
            className="auth-input"
            type="password"
            placeholder="Confirm New Password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          <button className="auth-btn" disabled={loading}>
            {loading ? "Updating..." : "Update Password"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ResetPasswordModal;