import { useState } from "react";
import { FaTimes } from "react-icons/fa";
import { supabase } from "../../supabase/supabase";
import toast from "react-hot-toast";
import "../styles/auth.css";

const OTPVerificationModal = ({ email, closeModal, onVerified }) => {

  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const handleVerify = async (e) => {
    e.preventDefault();

    if (otp.length !== 6) {
      toast.error("Please enter a valid 6-digit code");
      return;
    }

    try {
      setLoading(true);

      const { error } = await supabase.auth.verifyOtp({
        email: email,
        token: otp,
        type: 'signup'
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success("Email verified successfully!");
      onVerified(); // callback to close everything

    } catch (err) {
      console.error(err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      setResending(true);

      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success("Verification code resent! Check your email.");

    } catch (err) {
      console.error(err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="auth-overlay">
      <div className="auth-modal">

        <FaTimes className="close-icon" onClick={closeModal} />

        <h2>Verify Your Email</h2>
        <p className="auth-subtitle">
          We sent a 6-digit code to <strong>{email}</strong>
        </p>

        <form className="auth-form" onSubmit={handleVerify}>

          <input
            className="auth-input otp-input"
            type="text"
            placeholder="Enter 6-digit code"
            maxLength={6}
            value={otp}
            onChange={(e) => {
              // Only allow numbers
              const val = e.target.value.replace(/[^0-9]/g, '');
              setOtp(val);
            }}
            required
          />

          <button className="auth-btn" disabled={loading}>
            {loading ? "Verifying..." : "Verify Email"}
          </button>

        </form>

        <p className="switch-text">
          Didn't receive the code?
          <span
            onClick={handleResend}
            style={{ opacity: resending ? 0.5 : 1, pointerEvents: resending ? 'none' : 'auto' }}
          >
            {resending ? " Resending..." : " Resend Code"}
          </span>
        </p>

      </div>
    </div>
  );
};

export default OTPVerificationModal;