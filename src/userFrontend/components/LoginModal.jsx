import { FaTimes } from "react-icons/fa";
import "../styles/auth.css";

const LoginModal = ({ closeModal, openSignup }) => {

  return (
    <div className="auth-overlay">

      <div className="auth-modal">

        <FaTimes className="close-icon" onClick={closeModal} />

        <h2>Login</h2>

        <form className="auth-form">

          <input className="auth-input"
            type="text"
            placeholder="Email or Phone Number"
            required
          />

          <input  className="auth-input"
            type="password"
            placeholder="Password"
            required
          />

          <button className="auth-btn">Login</button>

        </form>

        <p className="switch-text">
          Don't have an account?
          <span onClick={openSignup}> Sign Up</span>
        </p>

      </div>

    </div>
  );
};

export default LoginModal;