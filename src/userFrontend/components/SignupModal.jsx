import { FaTimes } from "react-icons/fa";
import "../styles/auth.css";

const SignupModal = ({ closeModal, openLogin }) => {

  return (
    <div className="auth-overlay">

      <div className="auth-modal">

        <FaTimes className="close-icon" onClick={closeModal} />

        <h2>Create Account</h2>

        <form className="auth-form">

          <input className="auth-input"
            type="text"
            placeholder="Full Name"
            required
          />

          <input className="auth-input"
            type="text"
            placeholder="Email or Phone Number"
            required
          />

          <input className="auth-input"
            type="password"
            placeholder="Password"
            required
          />

          <input className="auth-input"
            type="password"
            placeholder="Confirm Password"
            required
          />

          <button className="auth-btn">Sign Up</button>

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