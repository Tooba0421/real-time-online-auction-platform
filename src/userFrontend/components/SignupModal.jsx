import { useState } from "react";
import { FaTimes } from "react-icons/fa";
import { supabase } from "../../supabase/supabase";
import toast from "react-hot-toast";
import "../styles/auth.css";

const SignupModal = ({ closeModal, openLogin }) => {

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

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

      const { data, error } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: {
          data: {
            name: name,
          }
        }
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      console.log("User created successfully:", data.user);
      toast.success("Account created successfully!");
      closeModal();

    } catch (error) {
      console.error(error.message);
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

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
            {loading ? "Creating Account..." : "Sign Up"}
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