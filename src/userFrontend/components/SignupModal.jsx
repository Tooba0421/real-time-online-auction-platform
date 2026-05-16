import { useState } from "react";
import { FaTimes } from "react-icons/fa";
import { supabase } from "../../supabase/supabase";
import toast from "react-hot-toast";
import OTPVerificationModal from "./OTPVerificationModal";
import { generateOTP, storeOTP } from "../../utils/otpHelper";
import { sendOTPEmail } from "../../utils/emailHelper";
import "../styles/auth.css";

const SignupModal = ({ closeModal, openLogin }) => {

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showOTP, setShowOTP] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");

  const handleSignup = async (e) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    try {
      setLoading(true);

      // Step 1: Generate and send OTP FIRST (before creating account)
      const otp = generateOTP();
      storeOTP(email, otp);

      const emailResult = await sendOTPEmail(email, name, otp);
      if (!emailResult.success) {
        toast.error("Failed to send OTP email. Please try again.");
        return;
      }

      // Step 2: Store signup data temporarily (only in memory via sessionStorage)
      sessionStorage.setItem("pending_signup", JSON.stringify({ name, email, password }));

      toast.success("OTP sent to your email!");
      setRegisteredEmail(email);
      setShowOTP(true);

    } catch (error) {
      console.error(error);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerified = async () => {
    try {
      const raw = sessionStorage.getItem("pending_signup");
      if (!raw) {
        toast.error("Signup session expired. Please try again.");
        return;
      }

      const { name, email, password } = JSON.parse(raw);

      // ✅ Create Supabase account ONLY after OTP verified
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name } }
      });

      // ✅ Always clear sessionStorage after use
      sessionStorage.removeItem("pending_signup");

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success("Account created and verified successfully!");
      closeModal();

    } catch (err) {
      console.error(err);
      sessionStorage.removeItem("pending_signup");
      toast.error("Something went wrong. Please try again.");
    }
  };

  if (showOTP) {
    return (
      <OTPVerificationModal
        email={registeredEmail}
        closeModal={() => {
          setShowOTP(false);
          sessionStorage.removeItem("pending_signup");
        }}
        onVerified={handleVerified}
      />
    );
  }

  return (
    <div className="auth-overlay">
      <div className="auth-modal">

        <FaTimes className="close-icon" onClick={closeModal} />

        <h2>Create Account</h2>

        <form className="auth-form" onSubmit={handleSignup}>
          <input
            className="auth-input"
            type="text"
            placeholder="Full Name"
            required
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="auth-input"
            type="email"
            placeholder="Email"
            required
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="auth-input"
            type="password"
            placeholder="Password (min 6 characters)"
            required
            onChange={(e) => setPassword(e.target.value)}
          />
          <input
            className="auth-input"
            type="password"
            placeholder="Confirm Password"
            required
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          <button className="auth-btn" disabled={loading}>
            {loading ? "Processing..." : "Continue"}
          </button>
        </form>

        <p className="switch-text">
          Already have an account?
          <span onClick={openLogin}> Login</span>
        </p>

      </div>
    </div>
  );
};

export default SignupModal;