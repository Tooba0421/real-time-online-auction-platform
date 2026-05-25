import { useLayoutEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FaArrowLeft, FaLock } from "react-icons/fa";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { supabase } from "../../supabase/supabase";
import { useAuthContext } from "../../context/AuthContext";
import toast from "react-hot-toast";
import Header from "../components/Header";
import Footer from "../components/Footer";
import "../styles/common.css";
import "../styles/checkout.css";

// ── Helpers ────────────────────────────────────────────────────────
const toSlug = (title) =>
  title?.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      fontSize: "15px",
      color: "#1a1a1a",
      fontFamily: "inherit",
      "::placeholder": { color: "#aab7c4" },
    },
    invalid: { color: "#ef4444" },
  },
};

// ── Fee constants (single source of truth) ────────────────────────
const SHIPPING_FEE    = 250;
const SERVICE_TAX_PCT = 0.02; // 2%
const PLATFORM_FEE_PCT= 0.25; // 25%

const calcAmounts = (winningBid) => {
  const serviceTax   = Math.round(winningBid * SERVICE_TAX_PCT);
  const totalAmount  = winningBid + SHIPPING_FEE + serviceTax;
  const platformFee  = Math.round(totalAmount * PLATFORM_FEE_PCT);
  const sellerAmount = totalAmount - platformFee;
  return { serviceTax, totalAmount, platformFee, sellerAmount };
};

// ── PaymentForm — inner component inside <Elements> ───────────────
const PaymentForm = ({ auctionData, shippingForm, winningBid }) => {
  const stripe   = useStripe();
  const elements = useElements();
  const navigate = useNavigate();
  const { user } = useAuthContext();

  const [processing, setProcessing] = useState(false);
  const [cardError, setCardError]   = useState("");

  const { serviceTax, totalAmount, platformFee, sellerAmount } =
    calcAmounts(winningBid);

  const handleSubmit = async () => {
    if (!stripe || !elements) return;

    // Validate shipping form
    const { fullName, email, phone, country, address, city, postalCode } = shippingForm;
    if (!fullName || !email || !phone || !country || !address || !city || !postalCode) {
      toast.error("Please fill all shipping address fields");
      return;
    }

    setProcessing(true);
    setCardError("");

    try {
      // ── Step 1: Create Stripe payment method ──────────────────────
      // In FYP test mode, createPaymentMethod succeeding = payment approved.
      // In production you would confirm a PaymentIntent from your backend.
      const { error: stripeError, paymentMethod } = await stripe.createPaymentMethod({
        type: "card",
        card: elements.getElement(CardElement),
        billing_details: { name: fullName, email },
      });

      if (stripeError) {
        setCardError(stripeError.message);
        return;
      }

      // ── Step 2: Get buyer record ───────────────────────────────────
      const { data: buyerData, error: buyerError } = await supabase
        .from("buyers")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (buyerError || !buyerData) {
        toast.error("Buyer record not found. Please contact support.");
        return;
      }

      // ── Step 3: Create order ──────────────────────────────────────
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .insert({
          auction_id:   auctionData.auctionId,
          buyer_id:     buyerData.id,
          seller_id:    auctionData.sellerId,
          amount:       winningBid,
          service_tax:  serviceTax,
          shipping_fee: SHIPPING_FEE,
          total_amount: totalAmount,
          order_status: "confirmed",
        })
        .select()
        .single();

      if (orderError) {
        toast.error("Error creating order. Please try again.");
        console.error("Order error:", orderError);
        return;
      }

      // ── Step 4: Create payment record ─────────────────────────────
      const { data: paymentData, error: paymentError } = await supabase
        .from("payments")
        .insert({
          order_id:     orderData.id,
          buyer_id:     buyerData.id,
          seller_id:    auctionData.sellerId,
          amount:       winningBid,
          service_tax:  serviceTax,
          shipping_fee: SHIPPING_FEE,
          total_amount: totalAmount,
          platform_fee: platformFee,
          method:       "visa",
          status:       "paid",
          hold_status:  true,
          payment_date: new Date().toISOString(),
        })
        .select()
        .single();

      if (paymentError) {
        toast.error("Error recording payment. Please contact support.");
        console.error("Payment error:", paymentError);
        return;
      }

      // ── Step 5: Create transaction record (7-day hold) ────────────
      const holdUntil = new Date();
      holdUntil.setDate(holdUntil.getDate() + 7);

      const { error: txError } = await supabase
        .from("transactions")
        .insert({
          payment_id:    paymentData.id,
          seller_id:     auctionData.sellerId,
          seller_amount: sellerAmount,
          total_amount:  totalAmount,
          status:        "onhold",
          hold_until:    holdUntil.toISOString(),
        });

      if (txError) {
        // Non-critical — log but don't block the buyer flow
        console.error("Transaction insert error (non-critical):", txError);
      }

      // ── Step 6: Set winner_id if not already set ──────────────────
      await supabase
        .from("auctions")
        .update({ winner_id: buyerData.id })
        .eq("id", auctionData.auctionId)
        .is("winner_id", null);

      // ── Step 7: Notify seller ─────────────────────────────────────
      // Include auction_id + product_slug so seller's notification is navigable
      await supabase.from("notifications").insert({
        user_id:          auctionData.sellerUserId,
        title:            `Payment Received for "${auctionData.title}"`,
        message:          `The buyer has paid PKR ${totalAmount.toLocaleString()} for "${auctionData.title}". Please ship the item using TCS and enter the tracking number in your Orders page.`,
        type:             "payment",
        notification_for: "seller",
        auction_id:       auctionData.auctionId,
        product_slug:     toSlug(auctionData.title),
        is_read:          false,
      });

      // ── Step 8: Notify buyer ──────────────────────────────────────
      await supabase.from("notifications").insert({
        user_id:          user.id,
        title:            `Payment Successful for "${auctionData.title}"`,
        message:          `Your payment of PKR ${totalAmount.toLocaleString()} for "${auctionData.title}" was successful. The seller will ship your item soon via TCS courier.`,
        type:             "payment",
        notification_for: "buyer",
        auction_id:       auctionData.auctionId,
        product_slug:     toSlug(auctionData.title),
        is_read:          false,
      });

      toast.success("Payment successful! Your order has been placed.");
      navigate("/notifications");

    } catch (err) {
      console.error("Payment error:", err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  const { totalAmount: displayTotal } = calcAmounts(winningBid);

  return (
    <div className="stripe-form">
      <h3>
        <FaLock style={{ marginRight: "8px", fontSize: "14px" }} />
        Card Details
      </h3>
      <p style={{ fontSize: "12px", color: "#888", marginBottom: "12px" }}>
        Test card: 4242 4242 4242 4242 — any future date — any CVC
      </p>

      <div className="card-element-wrapper">
        <CardElement options={CARD_ELEMENT_OPTIONS} />
      </div>

      {cardError && (
        <p style={{ color: "#ef4444", fontSize: "13px", marginTop: "8px" }}>
          {cardError}
        </p>
      )}

      <button
        type="button"
        className="place-order"
        onClick={handleSubmit}
        disabled={!stripe || processing}
      >
        {processing ? "Processing..." : `Pay PKR ${displayTotal.toLocaleString()}`}
      </button>

      <p style={{ fontSize: "11px", color: "#aaa", textAlign: "center", marginTop: "10px" }}>
        🔒 Secured by Stripe. Your card details are encrypted.
      </p>
    </div>
  );
};

// ── CheckoutPage ───────────────────────────────────────────────────
const CheckoutPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthContext();

  // Auction data passed via navigate("/checkout", { state: { ... } })
  const {
    auctionId, title, sellerName, sellerId, sellerUserId,
    endDate, totalBids, winningBid, image,
  } = location.state || {};

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, []);

  const [shippingForm, setShippingForm] = useState({
    fullName:   "",
    email:      user?.email || "",
    phone:      "",
    country:    "Pakistan",
    address:    "",
    city:       "",
    postalCode: "",
  });

  // Guard — no auction data means user navigated here directly
  if (!auctionId || !winningBid) {
    return (
      <>
        <Header />
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <button
            className="back-btn"
            onClick={() => window.history.length > 1 ? navigate(-1) : navigate("/")}
          >
            <FaArrowLeft />
          </button>
          <h2 style={{ marginTop: "20px" }}>No checkout data found</h2>
          <p style={{ color: "#888", marginTop: "10px" }}>
            Please go back and try again.
          </p>
        </div>
        <Footer />
      </>
    );
  }

  const { serviceTax, totalAmount } = calcAmounts(winningBid);

  const auctionData = {
    auctionId, title, sellerName,
    sellerId, sellerUserId,
    endDate, totalBids, image,
  };

  const handleFormChange = (field) => (e) =>
    setShippingForm((prev) => ({ ...prev, [field]: e.target.value }));

  return (
    <>
      <Header />

      <div className="checkout-page">

        {/* Page header */}
        <div className="page-header">
          <button
            className="back-btn"
            onClick={() => window.history.length > 1 ? navigate(-1) : navigate("/")}
          >
            <FaArrowLeft />
          </button>
          <h2 className="page-heading">Auction Payment</h2>
        </div>

        {/* Win banner */}
        <div className="auction-win-banner">
          🎉 Congratulations! You won this auction.
          <span>Please complete payment within 24 hours.</span>
        </div>

        <div className="checkout-grid">

          {/* ── LEFT ──────────────────────────────────────────────── */}
          <div className="checkout-left">

            {/* Winning item summary */}
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
                  <p>Winning Bid: PKR {winningBid?.toLocaleString()}</p>
                </div>
              </div>
            </div>

            {/* Shipping address form */}
            <div className="card">
              <h3>Shipping Address</h3>
              <div className="checkout-form-grid">
                {[
                  { label: "Full Name",   field: "fullName",  type: "text"  },
                  { label: "Email",       field: "email",     type: "email" },
                  { label: "Phone",       field: "phone",     type: "text"  },
                  { label: "Country",     field: "country",   type: "text"  },
                ].map(({ label, field, type }) => (
                  <div className="form-group" key={field}>
                    <label>{label} <span className="compulsory">*</span></label>
                    <input
                      type={type}
                      value={shippingForm[field]}
                      onChange={handleFormChange(field)}
                      required
                    />
                  </div>
                ))}
              </div>

              <div className="form-group">
                <label>Address <span className="compulsory">*</span></label>
                <input
                  type="text"
                  value={shippingForm.address}
                  onChange={handleFormChange("address")}
                  required
                />
              </div>

              <div className="checkout-form-grid">
                {[
                  { label: "City",        field: "city"       },
                  { label: "Postal Code", field: "postalCode" },
                ].map(({ label, field }) => (
                  <div className="form-group" key={field}>
                    <label>{label} <span className="compulsory">*</span></label>
                    <input
                      type="text"
                      value={shippingForm[field]}
                      onChange={handleFormChange(field)}
                      required
                    />
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* ── RIGHT ─────────────────────────────────────────────── */}
          <div className="checkout-right card">
            <div className="order-summary">

              <h3>Payment Summary</h3>

              <div className="summary-row">
                <span>Winning Bid</span>
                <span>PKR {winningBid?.toLocaleString()}</span>
              </div>
              <div className="summary-row">
                <span>Shipping Fee (TCS)</span>
                <span>PKR {SHIPPING_FEE.toLocaleString()}</span>
              </div>
              <div className="summary-row">
                <span>Service Tax (2%)</span>
                <span>PKR {serviceTax.toLocaleString()}</span>
              </div>
              <hr />
              <div className="summary-row total">
                <span>Total Payment</span>
                <span>PKR {totalAmount.toLocaleString()}</span>
              </div>

              {/* Stripe payment form — must be inside <Elements> */}
              <Elements stripe={stripePromise}>
                <PaymentForm
                  auctionData={auctionData}
                  shippingForm={shippingForm}
                  winningBid={winningBid}
                />
              </Elements>

            </div>
          </div>

        </div>
      </div>

      <Footer />
    </>
  );
};

export default CheckoutPage;