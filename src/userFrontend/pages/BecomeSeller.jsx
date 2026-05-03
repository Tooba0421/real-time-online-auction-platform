import { useState, useLayoutEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
    FaUsers,
    FaShieldAlt,
    FaChartLine,
    FaGavel,
    FaBolt,
    FaHandshake
} from "react-icons/fa";
import toast from "react-hot-toast";
import Header from "../components/Header";
import Footer from "../components/Footer";
import SellerFormModal from "../components/SellerRegistrationModal";
import { useAuthContext } from "../../context/AuthContext";
import "../styles/common.css";
import "../styles/infoPages.css";

const BecomeSeller = () => {

    const navigate = useNavigate();
    const [openSellerForm, setOpenSellerForm] = useState(false);
    const { user, profile } = useAuthContext();

    useLayoutEffect(() => {
        window.scrollTo({ top: 0 });
    }, []);

    const handleGetStarted = () => {

        // Not logged in
        if (!user) {
            toast.error("Please login first to become a seller!");
            return;
        }

        // Already a seller
        if (profile?.role === 'seller') {
            toast.success("You are already registered as a seller!");
            return;
        }

        // Already submitted but pending
        if (profile?.role === 'user' && profile?.id_verified === 'pending') {
            toast("Your seller application is already under review. Please wait for admin approval.", {
                icon: '⏳',
            });
            return;
        }

        // All good → open seller form
        setOpenSellerForm(true);
    };

    return (
        <>
            <Header />

            <div className="info-container">

                {/* TITLE */}
                <div className="how-title">
                    <h1>Why Sell With Us?</h1>
                    <p>
                        Reach more buyers, maximize your value, and sell with confidence on our platform.
                    </p>
                </div>

                {/* BENEFITS */}
                <div className="steps-container">

                    <div className="step-card">
                        <FaUsers className="step-icon" />
                        <h3>Access to Active Buyers</h3>
                        <p>
                            Connect with a large community of buyers actively searching for unique and valuable items.
                        </p>
                    </div>

                    <div className="step-card">
                        <FaGavel className="step-icon" />
                        <h3>Real-Time Bidding</h3>
                        <p>
                            Let competitive bidding increase your product's value and ensure fair market pricing.
                        </p>
                    </div>

                    <div className="step-card">
                        <FaShieldAlt className="step-icon" />
                        <h3>Secure Transactions</h3>
                        <p>
                            Our platform ensures safe payments and protects both buyers and sellers throughout the process.
                        </p>
                    </div>

                    <div className="step-card">
                        <FaChartLine className="step-icon" />
                        <h3>Grow Your Business</h3>
                        <p>
                            Track performance, analyze trends, and improve your selling strategy over time.
                        </p>
                    </div>

                    <div className="step-card">
                        <FaBolt className="step-icon" />
                        <h3>Fast & Easy Selling</h3>
                        <p>
                            List your items quickly with a simple process and start receiving bids in no time.
                        </p>
                    </div>

                    <div className="step-card">
                        <FaHandshake className="step-icon" />
                        <h3>Trusted Local Marketplace</h3>
                        <p>
                            Buy and sell confidently within a trusted and growing community in Pakistan.
                        </p>
                    </div>

                </div>

                {/* CTA */}
                <div className="cta-box">
                    <h3>Start Your Selling Journey</h3>
                    <p>
                        Join our platform today and turn your items into successful auctions.
                    </p>

                    <button
                        className="primary-btn"
                        onClick={handleGetStarted}
                    >
                        {!user
                            ? "Login to Get Started"
                            : profile?.role === 'seller'
                                ? "Already a Seller ✅"
                                : "Get Started"
                        }
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