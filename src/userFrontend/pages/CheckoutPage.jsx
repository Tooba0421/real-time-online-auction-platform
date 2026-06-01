import { useLayoutEffect, useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FaArrowLeft, FaArrowRight } from "react-icons/fa";
import { supabase } from "../../supabase/supabase";
import { useAuthContext } from "../../context/AuthContext";
import toast from "react-hot-toast";
import Header from "../components/Header";
import Footer from "../components/Footer";
import "../styles/common.css";
import "../styles/checkout.css";

const CheckoutPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile } = useAuthContext();

  // Auction data passed from ProductDetailPage via navigate state
  const {
    auctionId, title, sellerName, sellerId, sellerUserId,
    endDate, totalBids, winningBid, image,
  } = location.state || {};

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, []);

  const [shippingForm, setShippingForm] = useState({
    fullName:   "",
    email:      "",
    phone:      "",
    address:    "",
    city:       "",
    postalCode: "",
  });

  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [alreadyPaid, setAlreadyPaid] = useState(false);

  // ── On mount: pre-fill form from profiles + buyers table ─────────
  useEffect(() => {
    if (!user || !auctionId) { setLoading(false); return; }
    fetchBuyerData();
    checkAlreadyPaid();
  }, [user, auctionId]);

  const fetchBuyerData = async () => {
    try {
      // Fetch buyer record (phone, address, city, postal_code)
      const { data: buyerData } = await supabase
        .from("buyers")
        .select("phone_no, address, city, postal_code")
        .eq("user_id", user.id)
        .single();

      // Pre-fill form — name and email from profile/auth, rest from buyers
      setShippingForm({
        fullName:   profile?.name  || "",
        email:      user?.email    || "",
        phone:      buyerData?.phone_no    || "",
        address:    buyerData?.address     || "",
        city:       buyerData?.city        || "",
        postalCode: buyerData?.postal_code || "",
      });
    } catch (err) {
      console.error("fetchBuyerData error:", err);
    } finally {
      setLoading(false);
    }
  };

  const checkAlreadyPaid = async () => {
    const { data } = await supabase
      .from("orders")
      .select("id")
      .eq("auction_id", auctionId)
      .maybeSingle();
    if (data) setAlreadyPaid(true);
  };

  const handleFormChange = (field) => (e) =>
    setShippingForm((prev) => ({ ...prev, [field]: e.target.value }));

  // ── Continue to Payment ───────────────────────────────────────────
  const handleContinue = async () => {
    const { fullName, email, phone, address, city, postalCode } = shippingForm;

    // Validate all fields
    if (!fullName || !email || !phone || !address || !city || !postalCode) {
      toast.error("Please fill all shipping fields");
      return;
    }

    try {
      setSaving(true);

      // ✅ Save/update phone, address, city, postal_code in buyers table
      const { error } = await supabase
        .from("buyers")
        .update({
          phone_no:    phone.trim(),
          address:     address.trim(),
          city:        city.trim(),
          postal_code: postalCode.trim(),
        })
        .eq("user_id", user.id);

      if (error) {
        toast.error("Error saving shipping info. Please try again.");
        console.error("Buyer update error:", error);
        return;
      }

      // ✅ Navigate to payment page — pass all auction + shipping data
      navigate("/payment", {
        state: {
          auctionId,
          title,
          sellerName,
          sellerId,
          sellerUserId,
          endDate,
          totalBids,
          winningBid,
          image,
          shippingName:   fullName,
          shippingEmail:  email,
          shippingPhone:  phone,
          shippingAddress: address,
          shippingCity:   city,
          shippingPostal: postalCode,
        },
      });

    } catch (err) {
      console.error(err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // ── Guards ────────────────────────────────────────────────────────
  if (!auctionId || !winningBid) {
    return (
      <>
        <Header />
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <button className="back-btn"
            onClick={() => window.history.length > 1 ? navigate(-1) : navigate("/")}>
            <FaArrowLeft />
          </button>
          <h2 style={{ marginTop: "20px" }}>No checkout data found</h2>
          <p style={{ color: "#888", marginTop: "10px" }}>Please go back and try again.</p>
        </div>
        <Footer />
      </>
    );
  }

  if (!loading && alreadyPaid) {
    return (
      <>
        <Header />
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <h2 style={{ marginTop: "20px" }}>Already Paid</h2>
          <p style={{ color: "#888", marginTop: "10px" }}>
            You have already completed payment for this auction.
          </p>
          <button className="place-bid-btn" style={{ marginTop: "20px" }}
            onClick={() => navigate("/notifications")}>
            View Notifications
          </button>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header />

      <div className="checkout-page">

        {/* Page header */}
        <div className="page-header">
          <button className="back-btn"
            onClick={() => window.history.length > 1 ? navigate(-1) : navigate("/")}>
            <FaArrowLeft />
          </button>
          <h2 className="page-heading">Checkout</h2>
        </div>

        {/* Win banner */}
        <div className="auction-win-banner">
          🎉 Congratulations! You won this auction.
          <span>Please complete your shipping details to proceed to payment.</span>
        </div>

        <div className="checkout-grid">

          {/* ── LEFT ── */}
          <div className="checkout-left">

            {/* Winning item */}
            <div className="card">
              <h3>Winning Item</h3>
              <div className="order-product">
                {image && <img src={image} alt={title} />}
                <div>
                  <p className="product-name">{title}</p>
                  <p>Seller: {sellerName}</p>
                  {endDate && (
                    <p>Auction Ended: {new Date(endDate).toLocaleDateString()}</p>
                  )}
                  <p>Total Bids: {totalBids || 0}</p>
                  <p>Winning Bid: <strong>PKR {winningBid?.toLocaleString()}</strong></p>
                </div>
              </div>
            </div>

            {/* Shipping form */}
            <div className="card">
              <h3>Shipping Information</h3>
              <p style={{ fontSize: "12px", color: "#888", marginBottom: "16px" }}>
                This information will be saved to your account and shared with the seller for delivery.
              </p>

              {loading ? (
                <div style={{ textAlign: "center", padding: "30px", color: "#999" }}>
                  Loading your information...
                </div>
              ) : (
                <>
                  <div className="checkout-form-grid">
                    {/* Full Name — read only from profile */}
                    <div className="form-group">
                      <label>Full Name <span className="compulsory">*</span></label>
                      <input
                        type="text"
                        value={shippingForm.fullName}
                        onChange={handleFormChange("fullName")}
                        placeholder="Your full name"
                        required
                      />
                    </div>

                    {/* Email — read only from auth */}
                    <div className="form-group">
                      <label>Email <span className="compulsory">*</span></label>
                      <input
                        type="email"
                        value={shippingForm.email}
                        readOnly
                        style={{ background: "#f9f9f9", cursor: "not-allowed" }}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Phone Number <span className="compulsory">*</span></label>
                    <input
                      type="text"
                      value={shippingForm.phone}
                      onChange={handleFormChange("phone")}
                      placeholder="03XX-XXXXXXX"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Address <span className="compulsory">*</span></label>
                    <input
                      type="text"
                      value={shippingForm.address}
                      onChange={handleFormChange("address")}
                      placeholder="House no, Street, Area"
                      required
                    />
                  </div>

                  <div className="checkout-form-grid">
                    <div className="form-group">
                      <label>City <span className="compulsory">*</span></label>
                      <input
                        type="text"
                        value={shippingForm.city}
                        onChange={handleFormChange("city")}
                        placeholder="City"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Postal Code <span className="compulsory">*</span></label>
                      <input
                        type="text"
                        value={shippingForm.postalCode}
                        onChange={handleFormChange("postalCode")}
                        placeholder="Postal code"
                        required
                      />
                    </div>
                  </div>
                </>
              )}
            </div>

          </div>

          {/* ── RIGHT ── */}
          <div className="checkout-right card">
            <div className="order-summary">
              <h3>Order Summary</h3>

              <div className="summary-row">
                <span>Winning Bid</span>
                <span>PKR {winningBid?.toLocaleString()}</span>
              </div>
              <div className="summary-row">
                <span>Shipping Fee (TCS)</span>
                <span>PKR 250</span>
              </div>
              <div className="summary-row">
                <span>Service Tax (2%)</span>
                <span>PKR {Math.round(winningBid * 0.02).toLocaleString()}</span>
              </div>
              <hr />
              <div className="summary-row total">
                <span>Total</span>
                <span>PKR {(winningBid + 250 + Math.round(winningBid * 0.02)).toLocaleString()}</span>
              </div>

              <button
                className="place-order"
                onClick={handleContinue}
                disabled={saving || loading}
                style={{ marginTop: "24px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
              >
                {saving ? "Saving..." : (
                  <>
                    Continue to Payment <FaArrowRight />
                  </>
                )}
              </button>

              <p style={{ fontSize: "11px", color: "#aaa", textAlign: "center", marginTop: "10px" }}>
                Your shipping info will be saved to your account.
              </p>
            </div>
          </div>

        </div>
      </div>

      <Footer />
    </>
  );
};

export default CheckoutPage;