import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import LoginModal from "./LoginModal";
import "../styles/footer.css";
import {
  FaInstagram,
  FaLinkedin,
  FaFacebook,
  FaPhone,
  FaEnvelope,
  FaMapMarkerAlt
} from "react-icons/fa";

const Footer = () => {
  const navigate = useNavigate();

  // ✅ FIX 1: Add state
  const [showLogin, setShowLogin] = useState(false);

  return (
    <>
      <footer className="footer">

        <div className="footer-container">

          {/* COLUMN 1 */}
          <div className="footer-column">
            <img src="/Images/pt_logo.png" alt="Logo" className="footer-logo" />

            <p>
              Auctions is a real-time online auction platform where users can
              bid on artwork, interiors, antiques, and more with full
              transparency and security.
            </p>

            <div className="contact-info">
              <p><FaMapMarkerAlt /> Multan, Pakistan</p>
              <p><FaPhone /> +92 300 1234567</p>
              <p><FaEnvelope /> support@auctions.com</p>
            </div>
          </div>

          {/* COLUMN 2 */}
          <div className="footer-column">
            <h4>Explore</h4>
            <Link to="/">Home</Link>
            <Link to="/auctions?type=latest">Latest Auctions</Link>
            <Link to="/auctions?type=popular">Popular Auctions</Link>
          </div>

          {/* COLUMN 3 */}
          <div className="footer-column">
            <h4>Bidding</h4>
            <Link to="/how-to-bid">How Bidding Works</Link>
            <Link to="/auction-rules">Auction Rules</Link>
            <Link to="/buyer-protection">Buyer Protection</Link>
          </div>

          {/* COLUMN 4 */}
          <div className="footer-column">
            <h4>Selling</h4>

            <a
              href="#"
              onClick={(e) => {
                e.preventDefault(); // 🔥 IMPORTANT
                setShowLogin(true);
              }}
            >
              Seller Sign-in
            </a>

            <Link to="/seller-guide">Seller Guide</Link>
            <Link to="/become-seller">Become a Seller</Link>
          </div>

          {/* COLUMN 5 */}
          <div className="footer-column">
            <h4>Help & Support</h4>
            <a href="#">Help Center</a>
            <a href="#">Send Feedback</a>
            <Link to="/faq">FAQs</Link>

            <div className="footer-socials">
              <FaFacebook className="footer-socials-icon" />
              <FaInstagram className="footer-socials-icon" />
              <FaLinkedin className="footer-socials-icon" />
            </div>
          </div>

        </div>

        <div className="footer-bottom">
          <p>© 2026 Auctions. All rights reserved.</p>
          <div className="footer-links">
            <a href="#">Privacy Policy</a>
            <a href="#">Terms & Conditions</a>
            <a href="#">Cookie Policy</a>
          </div>
        </div>

      </footer>

      {/* ✅ FIX 3: Wrap inside fragment */}
      {showLogin && (
        <LoginModal
          closeModal={() => setShowLogin(false)}
          openSignup={() => {
            setShowLogin(false);
          }}
        />
      )}
    </>
  );
};

export default Footer;