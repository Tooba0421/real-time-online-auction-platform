import { useState } from "react";
import { FaTimes } from "react-icons/fa";
import { generateOTP, storeOTP, verifyOTP } from "../../utils/otpHelper";
import { sendOTPEmail } from "../../utils/emailHelper";
import toast from "react-hot-toast";
import "../styles/auth.css";

const OTPVerificationModal = ({ email, closeModal, onVerified }) => {

  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [verified, setVerified] = useState(false); // 🔥 prevent double submit

  const handleVerify = async (e) => {
    e.preventDefault();

    if (loading || verified) return; // 🔥 prevent double clicks

    if (otp.length !== 6) {
      toast.error("Please enter a valid 6-digit code");
      return;
    }

    try {
      setLoading(true);

      const result = verifyOTP(otp);

      if (!result.valid) {
        toast.error(result.message);
        return;
      }

      toast.success("Email verified successfully!");

      setVerified(true); // 🔥 lock modal

      await onVerified(); // ensure async safety

    } catch (err) {
      console.error(err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {

    if (resending) return;

    try {
      setResending(true);

      const newOtp = generateOTP();

      storeOTP(email, newOtp);

      const result = await sendOTPEmail(email, '', newOtp);

      if (!result.success) {
        toast.error("Failed to resend OTP. Please try again.");
        return;
      }

      toast.success("New OTP sent! Check your email.");

      setOtp(""); // 🔥 clear input on resend

    } catch (err) {
      console.error(err);
      toast.error("Something went wrong.");
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
            disabled={loading || verified}  // 🔥 lock after success
            onChange={(e) => {
              const val = e.target.value.replace(/[^0-9]/g, '');
              setOtp(val);
            }}
            required
          />

          <button
            className="auth-btn"
            disabled={loading || verified}
          >
            {loading ? "Verifying..." : verified ? "Verified" : "Verify Email"}
          </button>

        </form>

        <p className="switch-text">
          Didn't receive the code?

          <span
            onClick={handleResend}
            style={{
              opacity: resending ? 0.5 : 1,
              pointerEvents: resending ? 'none' : 'auto'
            }}
          >
            {resending ? " Resending..." : " Resend Code"}
          </span>
        </p>

      </div>
    </div>
  );
};

export default OTPVerificationModal;