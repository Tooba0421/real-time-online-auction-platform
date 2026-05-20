import { useState, useLayoutEffect } from "react";
import {
  FaUsers, FaShieldAlt, FaChartLine,
  FaGavel, FaBolt, FaHandshake
} from "react-icons/fa";
import toast from "react-hot-toast";
import Header from "../components/Header";
import Footer from "../components/Footer";
import SellerFormModal from "../components/SellerRegistrationModal";
import { useAuthContext } from "../../context/AuthContext";
import { supabase } from "../../supabase/supabase";
import "../styles/common.css";
import "../styles/infoPages.css";

const BecomeSeller = () => {
  const [openSellerForm, setOpenSellerForm] = useState(false);
  const [checking, setChecking] = useState(false);
  const { user, profile } = useAuthContext();

  useLayoutEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);

  const handleGetStarted = async () => {
    if (!user) {
      toast.error("Please login first to become a seller!");
      return;
    }

    if (profile?.role === "seller") {
      toast.success("You are already an approved seller!");
      return;
    }

    try {
      setChecking(true);

      // Check if seller record already exists
      const { data: existingSeller } = await supabase
        .from("sellers")
        .select("id, is_verified")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existingSeller) {
        if (existingSeller.is_verified === "pending") {
          toast("Your seller application is already under review. Please wait for admin approval.", {
            icon: "⏳",
          });
          return;
        }
        if (existingSeller.is_verified === "approved") {
          toast.success("You are already an approved seller!");
          return;
        }
        // rejected or suspended → allow resubmission
        setOpenSellerForm(true);
        return;
      }

      // No seller record → allow fresh submission
      setOpenSellerForm(true);

    } catch (err) {
      console.error(err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setChecking(false);
    }
  };

  const getButtonLabel = () => {
    if (!user) return "Login to Get Started";
    if (profile?.role === "seller") return "Already a Seller ✅";
    if (checking) return "Checking...";
    return "Get Started";
  };

  return (
    <>
      <Header />

      <div className="info-container">

        <div className="how-title">
          <h1>Why Sell With Us?</h1>
          <p>Reach more buyers, maximize your value, and sell with confidence on our platform.</p>
        </div>

        <div className="steps-container">
          <div className="step-card">
            <FaUsers className="step-icon" />
            <h3>Access to Active Buyers</h3>
            <p>Connect with a large community of buyers actively searching for unique and valuable items.</p>
          </div>
          <div className="step-card">
            <FaGavel className="step-icon" />
            <h3>Real-Time Bidding</h3>
            <p>Let competitive bidding increase your product's value and ensure fair market pricing.</p>
          </div>
          <div className="step-card">
            <FaShieldAlt className="step-icon" />
            <h3>Secure Transactions</h3>
            <p>Our platform ensures safe payments and protects both buyers and sellers throughout the process.</p>
          </div>
          <div className="step-card">
            <FaChartLine className="step-icon" />
            <h3>Grow Your Business</h3>
            <p>Track performance, analyze trends, and improve your selling strategy over time.</p>
          </div>
          <div className="step-card">
            <FaBolt className="step-icon" />
            <h3>Fast & Easy Selling</h3>
            <p>List your items quickly with a simple process and start receiving bids in no time.</p>
          </div>
          <div className="step-card">
            <FaHandshake className="step-icon" />
            <h3>Trusted Local Marketplace</h3>
            <p>Buy and sell confidently within a trusted and growing community in Pakistan.</p>
          </div>
        </div>

        <div className="cta-box">
          <h3>Start Your Selling Journey</h3>
          <p>Join our platform today and turn your items into successful auctions.</p>
          <button
            className="primary-btn"
            onClick={handleGetStarted}
            disabled={checking}
          >
            {getButtonLabel()}
          </button>
        </div>

      </div>

      {openSellerForm && (
        <SellerFormModal closeModal={() => setOpenSellerForm(false)} />
      )}

      <Footer />
    </>
  );
};

export default BecomeSeller;