import { useLayoutEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaArrowLeft,
  FaUserPlus,
  FaUpload,
  FaTags,
  FaGavel,
  FaChartLine
} from "react-icons/fa";

import Header from "../components/Header";
import Footer from "../components/Footer";
import "../styles/common.css";
import "../styles/infoPages.css";

const SellerGuide = () => {

  const navigate = useNavigate();

  useLayoutEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);

  return (
    <>
      <Header />

      <div className="info-container">

        {/* HEADER */}
        <div className="how-title">
          <h1>Seller Guide</h1>
          <p>
            Learn how to list products, attract buyers, and successfully manage your auctions.
          </p>
        </div>

        {/* GUIDE (ONLY CARDS) */}
        <div className="steps-container">

          <div className="step-card">
            <FaUserPlus className="step-icon" />
            <h3>Create & Verify Account</h3>
            <p>
              Sign up and complete your seller profile with accurate details
              to get approved quickly.
            </p>
          </div>

          <div className="step-card">
            <FaUpload className="step-icon" />
            <h3>List Your Item</h3>
            <p>
              Upload high-quality images and write clear descriptions to attract buyers.
            </p>
          </div>

          <div className="step-card">
            <FaTags className="step-icon" />
            <h3>Set Auction Details</h3>
            <p>
              Choose category, starting price, duration, and bid increments carefully.
            </p>
          </div>

          <div className="step-card">
            <FaGavel className="step-icon" />
            <h3>Manage Your Auction</h3>
            <p>
              Monitor your auctions in real-time. Track bids through your dashboard.
            </p>
          </div>

          <div className="step-card">
            <FaChartLine className="step-icon" />
            <h3>Complete Sale</h3>
            <p>
              After winning, coordinate payment and delivery with the buyer smoothly.
            </p>
          </div>

        </div>

      </div>

      <Footer />
    </>
  );
};

export default SellerGuide;