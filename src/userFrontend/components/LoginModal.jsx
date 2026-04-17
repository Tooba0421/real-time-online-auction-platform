import { useState } from "react";
import { FaTimes } from "react-icons/fa";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../firebase/firebase"; // adjust path
import "../styles/auth.css";

const LoginModal = ({ closeModal, openSignup }) => {

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();

    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

      console.log("Logged in:", userCredential.user);
      closeModal(); // close modal after login

    } catch (error) {
      console.error(error.message);
      alert(error.message);
    }
  };

  return (
    <div className="auth-overlay">
      <div className="auth-modal">

        <FaTimes className="close-icon" onClick={closeModal} />

        <h2>Login</h2>

        <form className="auth-form" onSubmit={handleLogin}>

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
            placeholder="Password"
            required
            onChange={(e) => setPassword(e.target.value)}
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