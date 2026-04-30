import { useState } from "react";
import { FaTimes } from "react-icons/fa";
import { forgotPassword } from "../../supabase/authService";
import "../styles/auth.css";

const ForgotPasswordModal = ({ closeModal, openLogin }) => {

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setLoading(true);

      const result = await forgotPassword(email);

      if (!result.success) {
        alert(result.message);
        return;
      }

      setSent(true);

    } catch (error) {
      console.error(error);
      alert("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Success screen after email sent
  if (sent) {
    return (
      <div className="auth-overlay">
        <div className="auth-modal">

          <FaTimes className="close-icon" onClick={closeModal} />

          <div className="success-message">
            <h2>Email Sent! ✅</h2>
            <p>
              We sent a password reset link to <strong>{email}</strong>.
              Please check your inbox and click the link.
            </p>
            <p className="small-text">
              Didn't receive it? Check your spam folder.
            </p>
            <button className="auth-btn" onClick={closeModal}>
              Close
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

        <h2>Forgot Password</h2>
        <p className="auth-subtitle">
          Enter your email and we'll send you a reset link.
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>

          <input
            className="auth-input"
            type="email"
            placeholder="Enter your email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <button className="auth-btn" disabled={loading}>
            {loading ? "Sending..." : "Send Reset Link"}
          </button>

        </form>

        <p className="switch-text">
          Remember your password?
          <span onClick={openLogin}> Login</span>
        </p>

      </div>
    </div>
  );
};

export default ForgotPasswordModal;