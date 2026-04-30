import { useState, useEffect } from "react";
import { FaTimes } from "react-icons/fa";
import { resetPassword } from "../../supabase/authService";
import { supabase } from "../../supabase/supabase";
import "../styles/auth.css";

const ResetPasswordModal = ({ closeModal }) => {

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [validLink, setValidLink] = useState(false);
  const [checking, setChecking] = useState(true);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Check if user came from valid reset password email link
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setValidLink(!!session);
      setChecking(false);
    }
    checkSession();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      alert("Passwords do not match");
      return;
    }

    if (newPassword.length < 6) {
      alert("Password must be at least 6 characters");
      return;
    }

    try {
      setLoading(true);

      const result = await resetPassword(newPassword);

      if (!result.success) {
        alert(result.message);
        return;
      }

      setDone(true); // show success screen

    } catch (error) {
      console.error(error);
      alert("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Still checking session
  if (checking) {
    return (
      <div className="auth-overlay">
        <div className="auth-modal">
          <p>Verifying your reset link...</p>
        </div>
      </div>
    );
  }

  // Invalid or expired link
  if (!validLink) {
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

  // Success screen after password reset
  if (done) {
    return (
      <div className="auth-overlay">
        <div className="auth-modal">

          <FaTimes className="close-icon" onClick={closeModal} />

          <div className="success-message">
            <h2>Password Reset! ✅</h2>
            <p>Your password has been updated successfully.</p>
            <button className="auth-btn" onClick={closeModal}>
              Login Now
            </button>
          </div>

        </div>
      </div>
    );
  }

  // Valid link — show reset form
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
            {loading ? "Resetting..." : "Reset Password"}
          </button>

        </form>

      </div>
    </div>
  );
};

export default ResetPasswordModal;