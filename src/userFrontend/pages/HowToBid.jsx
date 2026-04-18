import { useLayoutEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaArrowLeft,
  FaUserPlus,
  FaSearch,
  FaGavel,
  FaTrophy,
  FaCreditCard
} from "react-icons/fa";

import Header from "../components/Header";
import Footer from "../components/Footer";
import "../styles/common.css";
import "../styles/infoPages.css";

const HowToBid = () => {

  const navigate = useNavigate();

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, []);

  return (
    <>
      <Header />

      <div className="how-container">

        {/* HEADER */}
        <div className="how-title">
          <h1>How to Place a Bid</h1>
          <p>
            Follow simple steps to start bidding, win auctions, and secure your desired items easily.
          </p>
        </div>

        {/* STEPS */}
        <div className="steps-container">

          <div className="step-card">
            <FaSearch className="step-icon" />
            <h3>Explore Auctions</h3>
            <p>
              Browse or search for items you want to bid on.
            </p>
          </div>

          <div className="step-card">
            <FaUserPlus className="step-icon" />
            <h3>Create Account</h3>
            <p>
              Sign up or log in to your account to start bidding.
            </p>
          </div>

          <div className="step-card">
            <FaGavel className="step-icon" />
            <h3>Place a Bid</h3>
            <p>
              Enter an amount higher than the current highest bid.
            </p>
          </div>

          <div className="step-card">
            <FaTrophy className="step-icon" />
            <h3>Win Auction</h3>
            <p>
              If your bid remains highest when time ends, you win.
            </p>
          </div>

          <div className="step-card">
            <FaCreditCard className="step-icon" />
            <h3>Complete Payment</h3>
            <p>
              Pay securely and finalize your purchase.
            </p>
          </div>

        </div>

      </div>

      <Footer />
    </>
  );
};

export default HowToBid;