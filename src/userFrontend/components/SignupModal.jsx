import { useState } from "react";
import { FaTimes } from "react-icons/fa";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "../../firebase/firebase";
import { addDoc, collection } from "firebase/firestore";
import "../styles/auth.css";

const SignupModal = ({ closeModal, openLogin }) => {

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleSignup = async (e) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      alert("Passwords do not match");
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      const user = userCredential.user;

      // 🔥 Save user in Firestore
      await addDoc(collection(db, "users"), {
        uid: user.uid,
        name: name,
        email: user.email,
        role: "user",

        // 🔥 ADD THIS
        idVerified: "not_submitted",

        status: "active",
        joinDate: new Date()
      });

      console.log("User created:", user);
      closeModal();

    } catch (error) {
      console.error(error.message);
      alert(error.message);
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
            placeholder="Password"
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