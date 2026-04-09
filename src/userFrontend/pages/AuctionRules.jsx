import { useLayoutEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaArrowLeft,
  FaGavel,
  FaClock,
  FaCheckCircle,
  FaTimesCircle,
  FaExclamationTriangle
} from "react-icons/fa";

import Header from "../components/Header";
import Footer from "../components/Footer";
import "../styles/common.css";
import "../styles/infoPages.css";

const AuctionRules = () => {

  const navigate = useNavigate();

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, []);

  return (
    <>
      <Header />

      <div className="how-container">

        <div className="page-header">
          <button className="back-btn" onClick={() => navigate(-1)}>
            <FaArrowLeft />
          </button>
          <h2 className="page-heading">Auction Rules</h2>
        </div>

        <div className="steps-container">

          <div className="step-card">
            <FaGavel className="step-icon" />
            <h3>Minimum Bid Requirement</h3>
            <p>
              Every bid must be higher than the current highest bid.
            </p>
          </div>

          <div className="step-card">
            <FaClock className="step-icon" />
            <h3>Auction Time Limit</h3>
            <p>
              Each auction has a fixed end time. Late bids are not accepted.
            </p>
          </div>

          <div className="step-card">
            <FaCheckCircle className="step-icon" />
            <h3>Winning Responsibility</h3>
            <p>
              Winning an auction means you must complete the purchase.
            </p>
          </div>

          <div className="step-card">
            <FaTimesCircle className="step-icon" />
            <h3>Bid Cancellation</h3>
            <p>
              Bids cannot be canceled once placed.
            </p>
          </div>

          <div className="step-card">
            <FaExclamationTriangle className="step-icon" />
            <h3>Fair Use Policy</h3>
            <p>
              Misuse or fake bidding may result in account suspension.
            </p>
          </div>

        </div>

      </div>

      <Footer />
    </>
  );
};

export default AuctionRules;