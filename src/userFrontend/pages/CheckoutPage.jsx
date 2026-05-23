import { useLayoutEffect, useState, useEffect } from "react";
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

// Load Stripe with your publishable key from .env
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

// ── Payment Form (inner component inside Elements) ────────────────────────
const PaymentForm = ({ auctionData, shippingForm, totalPayment, winningBid }) => {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();
  const { user } = useAuthContext();

  const [processing, setProcessing] = useState(false);
  const [cardError, setCardError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

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
      // Step 1: Create a Stripe payment method from the card element
      const { error: stripeError, paymentMethod } = await stripe.createPaymentMethod({
        type: "card",
        card: elements.getElement(CardElement),
        billing_details: {
          name: fullName,
          email: email,
        },
      });

      if (stripeError) {
        setCardError(stripeError.message);
        setProcessing(false);
        return;
      }

      // Step 2: In test mode we don't actually charge — Stripe test cards succeed immediately
      // In production you would confirm a PaymentIntent from your backend here
      // For FYP test mode, payment is considered successful after createPaymentMethod succeeds

      // Step 3: Get buyer record
      const { data: buyerData, error: buyerError } = await supabase
        .from("buyers")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (buyerError || !buyerData) {
        toast.error("Buyer record not found. Please contact support.");
        setProcessing(false);
        return;
      }

      // Step 4: Calculate amounts
      const SHIPPING_FEE = 250;
      const SERVICE_TAX = Math.round(winningBid * 0.02); // 2% tax
      const totalAmount = winningBid + SHIPPING_FEE + SERVICE_TAX;
      const platformFee = Math.round(totalAmount * 0.25);
      const sellerAmount = totalAmount - platformFee;

      // Step 5: Create order
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .insert({
          auction_id: auctionData.auctionId,
          buyer_id: buyerData.id,
          seller_id: auctionData.sellerId,
          amount: winningBid,
          service_tax: SERVICE_TAX,
          shipping_fee: SHIPPING_FEE,
          total_amount: totalAmount,
          order_status: "confirmed",
        })
        .select()
        .single();

      if (orderError) {
        toast.error("Error creating order. Please try again.");
        console.error("Order error:", orderError);
        setProcessing(false);
        return;
      }

      // Step 6: Create payment record
      const { data: paymentData, error: paymentError } = await supabase
        .from("payments")
        .insert({
          order_id: orderData.id,
          buyer_id: buyerData.id,
          seller_id: auctionData.sellerId,
          amount: winningBid,
          service_tax: SERVICE_TAX,
          shipping_fee: SHIPPING_FEE,
          total_amount: totalAmount,
          platform_fee: platformFee,
          method: "visa",
          status: "paid",
          hold_status: true,
          payment_date: new Date().toISOString(),
        })
        .select()
        .single();

      if (paymentError) {
        toast.error("Error recording payment. Please contact support.");
        console.error("Payment error:", paymentError);
        setProcessing(false);
        return;
      }

      // Step 7: Create transaction record (1 week hold)
      const holdUntil = new Date();
      holdUntil.setDate(holdUntil.getDate() + 7);

      const { error: transactionError } = await supabase
        .from("transactions")
        .insert({
          payment_id: paymentData.id,
          seller_id: auctionData.sellerId,
          seller_amount: sellerAmount,
          total_amount: totalAmount,
          status: "onhold",
          hold_until: holdUntil.toISOString(),
        });

      if (transactionError) {
        console.error("Transaction error:", transactionError);
        // Non-critical — don't block the flow
      }

      // Step 8: Update auction winner_id if not already set
      await supabase
        .from("auctions")
        .update({ winner_id: buyerData.id })
        .eq("id", auctionData.auctionId)
        .is("winner_id", null);

      // Step 9: Notify seller
      await supabase.from("notifications").insert({
        user_id: auctionData.sellerUserId,
        title: "New Order Received! 🎉",
        message: `A buyer has paid for "${auctionData.title}". Total: PKR ${totalAmount.toLocaleString()}. Please prepare the item for shipment.`,
        type: "payment",
        notification_for: "seller",
        is_read: false,
      });

      // Step 10: Notify buyer
      await supabase.from("notifications").insert({
        user_id: user.id,
        title: "Payment Successful! ✅",
        message: `Your payment of PKR ${totalAmount.toLocaleString()} for "${auctionData.title}" was successful. The seller will ship your item soon.`,
        type: "payment",
        notification_for: "buyer",
        is_read: false,
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
        {processing
          ? "Processing..."
          : `Pay PKR ${totalPayment.toLocaleString()}`
        }
      </button>

      <p style={{ fontSize: "11px", color: "#aaa", textAlign: "center", marginTop: "10px" }}>
        🔒 Secured by Stripe. Your card details are encrypted.
      </p>
    </div>
  );
};

// ── Main CheckoutPage ─────────────────────────────────────────────────────
const CheckoutPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthContext();

  // Auction data passed via navigation state
  const { auctionId, title, sellerName, sellerId, sellerUserId,
          endDate, totalBids, winningBid, image } = location.state || {};

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, []);

  const [shippingForm, setShippingForm] = useState({
    fullName: "",
    email: user?.email || "",
    phone: "",
    country: "Pakistan",
    address: "",
    city: "",
    postalCode: "",
  });

  // If no auction data provided, show error
  if (!auctionId || !winningBid) {
    return (
      <>
        <Header />
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <button
            className="back-btn"
            onClick={() => {
              if (window.history.length > 1) navigate(-1);
              else navigate("/");
            }}
          >
            <FaArrowLeft />
          </button>
          <h2 className="page-heading">Auction Payment</h2>
          <h2>No checkout data found</h2>
          <p style={{ color: "#888", marginTop: "10px" }}>
            Please go back and try again.
          </p>
        </div>
        <Footer />
      </>
    );
  }

  const SHIPPING_FEE = 250;
  const SERVICE_TAX = Math.round(winningBid * 0.02);
  const totalPayment = winningBid + SHIPPING_FEE + SERVICE_TAX;

  const auctionData = {
    auctionId,
    title,
    sellerName,
    sellerId,
    sellerUserId,
    endDate,
    totalBids,
    image,
  };

  return (
    <>
      <Header />

      <div className="checkout-page">

        <div className="page-header">
          <button
            className="back-btn"
            onClick={() => {
              if (window.history.length > 1) navigate(-1);
              else navigate("/");
            }}
          >
            <FaArrowLeft />
          </button>
          <h2 className="page-heading">Auction Payment</h2>
        </div>

        <div className="auction-win-banner">
          🎉 Congratulations! You won this auction.
          <span>Please complete payment within 24 hours.</span>
        </div>

        <div className="checkout-grid">

          {/* LEFT SIDE */}
          <div className="checkout-left">

            {/* Winning Item */}
            <div className="card">
              <h3>Winning Item</h3>
              <div className="order-product">
                {image && <img src={image} alt={title} />}
                <div>
                  <p className="product-name">{title}</p>
                  <p>Seller: {sellerName}</p>
                  {endDate && <p>Auction Ended: {new Date(endDate).toLocaleDateString()}</p>}
                  <p>Total Bids: {totalBids || 0}</p>
                  <p>Winning Bid: PKR {winningBid?.toLocaleString()}</p>
                </div>
              </div>
            </div>

            {/* Shipping Address */}
            <div className="card">
              <h3>Shipping Address</h3>
              <div className="checkout-form-grid">
                <div className="form-group">
                  <label>Full Name <span className="compulsory">*</span></label>
                  <input
                    type="text"
                    value={shippingForm.fullName}
                    onChange={(e) =>
                      setShippingForm((p) => ({ ...p, fullName: e.target.value }))
                    }
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Email <span className="compulsory">*</span></label>
                  <input
                    type="email"
                    value={shippingForm.email}
                    onChange={(e) =>
                      setShippingForm((p) => ({ ...p, email: e.target.value }))
                    }
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Phone <span className="compulsory">*</span></label>
                  <input
                    type="text"
                    value={shippingForm.phone}
                    onChange={(e) =>
                      setShippingForm((p) => ({ ...p, phone: e.target.value }))
                    }
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Country <span className="compulsory">*</span></label>
                  <input
                    type="text"
                    value={shippingForm.country}
                    onChange={(e) =>
                      setShippingForm((p) => ({ ...p, country: e.target.value }))
                    }
                    required
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Address <span className="compulsory">*</span></label>
                <input
                  type="text"
                  value={shippingForm.address}
                  onChange={(e) =>
                    setShippingForm((p) => ({ ...p, address: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="checkout-form-grid">
                <div className="form-group">
                  <label>City <span className="compulsory">*</span></label>
                  <input
                    type="text"
                    value={shippingForm.city}
                    onChange={(e) =>
                      setShippingForm((p) => ({ ...p, city: e.target.value }))
                    }
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Postal Code <span className="compulsory">*</span></label>
                  <input
                    type="text"
                    value={shippingForm.postalCode}
                    onChange={(e) =>
                      setShippingForm((p) => ({ ...p, postalCode: e.target.value }))
                    }
                    required
                  />
                </div>
              </div>
            </div>

          </div>

          {/* RIGHT SIDE */}
          <div className="checkout-right card">
            <div className="order-summary">

              <h3>Payment Summary</h3>

              <div className="summary-row">
                <span>Winning Bid</span>
                <span>PKR {winningBid?.toLocaleString()}</span>
              </div>
              <div className="summary-row">
                <span>Shipping Fee</span>
                <span>PKR {SHIPPING_FEE.toLocaleString()}</span>
              </div>
              <div className="summary-row">
                <span>Service Tax (2%)</span>
                <span>PKR {SERVICE_TAX.toLocaleString()}</span>
              </div>
              <hr />
              <div className="summary-row total">
                <span>Total Payment</span>
                <span>PKR {totalPayment.toLocaleString()}</span>
              </div>

              {/* Stripe payment form */}
              <Elements stripe={stripePromise}>
                <PaymentForm
                  auctionData={auctionData}
                  shippingForm={shippingForm}
                  totalPayment={totalPayment}
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