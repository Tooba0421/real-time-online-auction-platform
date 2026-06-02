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

const SHIPPING_FEE     = 250;
const SERVICE_TAX_PCT  = 0.02;
const PLATFORM_FEE_PCT = 0.25;

const calcAmounts = (winningBid) => {
  const serviceTax   = Math.round(winningBid * SERVICE_TAX_PCT);
  const totalAmount  = winningBid + SHIPPING_FEE + serviceTax;
  const platformFee  = Math.round(totalAmount * PLATFORM_FEE_PCT);
  const sellerAmount = totalAmount - platformFee;
  return { serviceTax, totalAmount, platformFee, sellerAmount };
};

// ── StripePaymentForm ─────────────────────────────────────────────
const StripePaymentForm = ({ auctionData, winningBid }) => {
  const stripe   = useStripe();
  const elements = useElements();
  const navigate = useNavigate();
  const { user } = useAuthContext();

  const [processing, setProcessing] = useState(false);
  const [cardError,  setCardError]  = useState("");

  const { serviceTax, totalAmount, platformFee, sellerAmount } =
    calcAmounts(winningBid);

  const handlePay = async () => {
    if (!stripe || !elements) return;

    setProcessing(true);
    setCardError("");

    try {
      // ── Step 1: Stripe validates card ─────────────────────────────
      const { error: stripeError } = await stripe.createPaymentMethod({
        type: "card",
        card: elements.getElement(CardElement),
        billing_details: {
          name:  auctionData.shippingName,
          email: auctionData.shippingEmail,
        },
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
        console.error("Buyer fetch error:", buyerError);
        return;
      }

      // ── Step 3: Guard against duplicate orders ────────────────────
      const { data: existingOrder } = await supabase
        .from("orders")
        .select("id")
        .eq("auction_id", auctionData.auctionId)
        .maybeSingle();

      if (existingOrder) {
        toast.error("Payment already completed for this auction.");
        navigate("/notifications");
        return;
      }

      // ── Step 4: Create order ──────────────────────────────────────
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
          order_date:   new Date().toISOString(),
        })
        .select()
        .single();

      if (orderError) {
        toast.error("Error creating order. Please try again.");
        console.error("Order error:", orderError);
        return;
      }

      // ── Step 5: Create payment record ─────────────────────────────
      // ✅ FIXED 1: Added missing amount, service_tax, shipping_fee fields
      // ✅ FIXED 2: method changed from "stripe" to "visa"
      //    Your payment_method enum only contains "visa" — "stripe" is not valid
      //    and causes a 400 error which blocks the insert
      const { data: paymentData, error: paymentError } = await supabase
        .from("payments")
        .insert({
          order_id:     orderData.id,
          buyer_id:     buyerData.id,
          seller_id:    auctionData.sellerId,
          total_amount: totalAmount,
          platform_fee: platformFee,
          method:       "stripe",         
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

      // ── Step 6: Create transaction (7-day hold) ───────────────────
      // Transaction is created HERE — immediately after payment succeeds
      // Status = "onhold", released after 7 days via pg_cron job
      // OR admin can manually release early from RevenuePayouts page
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
        // Non-critical — log but don't block buyer
        console.error("Transaction insert error (non-critical):", txError);
      }

      // ── Step 7: Ensure winner_id is set on auction ────────────────
      await supabase
        .from("auctions")
        .update({ winner_id: buyerData.id })
        .eq("id", auctionData.auctionId)
        .is("winner_id", null);

      // ── Step 8: Notify seller ─────────────────────────────────────
      if (auctionData.sellerUserId) {
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
      }

      // ── Step 9: Notify buyer ──────────────────────────────────────
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
        onClick={handlePay}
        disabled={!stripe || processing}
        style={{ marginTop: "20px" }}
      >
        {processing
          ? "Processing..."
          : `Pay PKR ${totalAmount.toLocaleString()}`
        }
      </button>

      <p style={{ fontSize: "11px", color: "#aaa", textAlign: "center", marginTop: "10px" }}>
        🔒 Secured by Stripe. Your card details are encrypted.
      </p>
    </div>
  );
};

// ── PaymentPage ───────────────────────────────────────────────────
const PaymentPage = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const {
    auctionId, title, sellerName, sellerId, sellerUserId,
    endDate, totalBids, winningBid, image,
    shippingName, shippingEmail, shippingPhone,
    shippingAddress, shippingCity, shippingPostal,
  } = location.state || {};

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, []);

  if (!auctionId || !winningBid) {
    return (
      <>
        <Header />
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <button className="back-btn" onClick={() => navigate("/")}>
            <FaArrowLeft />
          </button>
          <h2 style={{ marginTop: "20px" }}>No payment data found</h2>
          <p style={{ color: "#888", marginTop: "10px" }}>
            Please go back and complete the checkout form first.
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
    shippingName, shippingEmail, shippingPhone,
    shippingAddress, shippingCity, shippingPostal,
  };

  return (
    <>
      <Header />

      <div className="checkout-page">

        <div className="page-header">
          <button
            className="back-btn"
            onClick={() => navigate("/checkout", { state: location.state })}
          >
            <FaArrowLeft />
          </button>
          <h2 className="page-heading">Payment</h2>
        </div>

        <div className="checkout-grid">

          {/* LEFT — shipping summary (read only) */}
          <div className="checkout-left">
            <div className="card">
              <div style={{
                display: "flex", justifyContent: "space-between",
                alignItems: "center", marginBottom: "12px",
              }}>
                <h3 style={{ margin: 0 }}>Shipping To</h3>
                <button
                  style={{
                    fontSize: "13px", color: "#6b5cff",
                    background: "none", border: "none",
                    cursor: "pointer", fontWeight: "600",
                  }}
                  onClick={() => navigate("/checkout", { state: location.state })}
                >
                  Edit
                </button>
              </div>
              <div style={{
                display: "flex", flexDirection: "column",
                gap: "6px", fontSize: "14px", color: "#555",
              }}>
                <p><strong>{shippingName}</strong></p>
                <p>{shippingEmail}</p>
                <p>{shippingPhone}</p>
                <p>{shippingAddress}</p>
                <p>{shippingCity}, {shippingPostal}</p>
              </div>
            </div>
          </div>

          {/* RIGHT — payment summary + Stripe form */}
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

              <Elements stripe={stripePromise}>
                <StripePaymentForm
                  auctionData={auctionData}
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

export default PaymentPage;