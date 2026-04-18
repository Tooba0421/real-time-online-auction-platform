import { useLayoutEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaArrowLeft,
  FaUserShield,
  FaLock,
  FaEye,
  FaHeadset
} from "react-icons/fa";

import Header from "../components/Header";
import Footer from "../components/Footer";
import "../styles/common.css";
import "../styles/infoPages.css";

const BuyerProtection = () => {

  const navigate = useNavigate();

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, []);

  return (
    <>
      <Header />

      <div className="how-container">

        <div className="how-title">
          <h1>Safe & Secure Buying</h1>
          <p>
            We ensure secure payments, verified sellers, and full support for a safe shopping experience.
          </p>
        </div>

        <div className="steps-container">

          <div className="step-card">
            <FaUserShield className="step-icon" />
            <h3>Verified Sellers</h3>
            <p>
              All sellers are verified to ensure trust and authenticity.
            </p>
          </div>

          <div className="step-card">
            <FaLock className="step-icon" />
            <h3>Secure Payments</h3>
            <p>
              Your payment information is fully protected and encrypted.
            </p>
          </div>

          <div className="step-card">
            <FaEye className="step-icon" />
            <h3>Transparent Bidding</h3>
            <p>
              All bids are visible and recorded to ensure fairness.
            </p>
          </div>

          <div className="step-card">
            <FaHeadset className="step-icon" />
            <h3>Dispute Support</h3>
            <p>
              Our support team helps resolve any issues quickly.
            </p>
          </div>

        </div>

      </div>

      <Footer />
    </>
  );
};

export default BuyerProtection;