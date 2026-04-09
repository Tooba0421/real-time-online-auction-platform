import { useLayoutEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";
import Header from "../components/Header";
import Footer from "../components/Footer";
import "../styles/common.css";
import "../styles/checkout.css";


const CheckoutPage = () => {

  const navigate = useNavigate();
  const location = useLocation();
  const { product } = location.state || {};

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, []);

  if (!product) {
    return (
      <>
        <Header />
        <h2 style={{ textAlign: "center", marginTop: "50px" }}>
          No checkout data found
        </h2>
        <Footer />
      </>
    );
  }

  /* -------------------------
     Dummy Auction Data
  ------------------------- */

  const auctionData = {
    id: product.id,
    title: product.title,
    seller: product.seller,
    endDate: new Date(product.endTime).toLocaleDateString(),
    totalBids: product.totalBids,
    winningBid: product.currentBid,
    shippingFee: 100,
    tax: 40,
    image: product.image
  };

  if (!auctionData) {
    return (
      <>
        <Header />
        <h2 style={{ textAlign: "center", marginTop: "30px", minHeight: "30vh" }}>
          No checkout data found
        </h2>
        <Footer />
      </>
    );
  }

  /* -------------------------
     Payment Method State
  ------------------------- */

  const [paymentMethod, setPaymentMethod] = useState("bank");

  /* -------------------------
     Calculate Total
  ------------------------- */

  const totalPayment =
    auctionData.winningBid +
    auctionData.shippingFee +
    auctionData.tax;

  /* -------------------------
     Handle Payment
  ------------------------- */

  const handlePayment = (e) => {
    e.preventDefault();

    alert(
      `Payment successful for ${auctionData.title}\nTotal Paid: ${totalPayment} PKR`
    );
  };

  return (
    <>
      <Header />

      <div className="checkout-page">

        <div className="page-header">

          <button
            className="back-btn"
            onClick={() => {
              if (window.history.length > 1) {
                navigate(-1);
              } else {
                navigate("/");
              }
            }}
          >
            <FaArrowLeft />
          </button>

          <h2 className="page-heading">Auction Payment</h2>

        </div>
        {/* WIN MESSAGE */}

        <div className="auction-win-banner">
          🎉 Congratulations! You won this auction.
          <span>Please complete payment within 24 hours.</span>
        </div>

        <form onSubmit={handlePayment}>

          <div className="checkout-grid">

            {/* LEFT SIDE */}

            <div className="checkout-left">

              {/* WINNING ITEM */}

              <div className="card">

                <h3>Winning Item</h3>

                <div className="order-product">

                  <img
                    src={auctionData.image}
                    alt={auctionData.title}
                  />

                  <div>

                    <p className="product-name">
                      {auctionData.title}
                    </p>

                    <p>
                      Seller: {auctionData.seller}
                    </p>

                    <p>
                      Auction Ended: {auctionData.endDate}
                    </p>

                    <p>
                      Total Bids: {auctionData.totalBids}
                    </p>

                    <p>
                      Winning Bid: {auctionData.winningBid} PKR
                    </p>

                  </div>

                </div>

              </div>


              {/* SHIPPING ADDRESS */}

              <div className="card">

                <h3>Shipping Address</h3>

                <div className="form-grid">

                  <div className="form-group">
                    <label>
                      Full Name <span className="compulsory">*</span>
                    </label>
                    <input type="text" required />
                  </div>

                  <div className="form-group">
                    <label>
                      Email <span className="compulsory">*</span>
                    </label>
                    <input type="email" required />
                  </div>

                  <div className="form-group">
                    <label>
                      Phone <span className="compulsory">*</span>
                    </label>
                    <input type="text" required />
                  </div>

                  <div className="form-group">
                    <label>
                      Country <span className="compulsory">*</span>
                    </label>
                    <input type="text" required />
                  </div>

                </div>

                <div className="form-group">
                  <label>
                    Address <span className="compulsory">*</span>
                  </label>
                  <input type="text" required />
                </div>

                <div className="form-grid">

                  <div className="form-group">
                    <label>
                      City <span className="compulsory">*</span>
                    </label>
                    <input type="text" required />
                  </div>

                  <div className="form-group">
                    <label>
                      Postal Code <span className="compulsory">*</span>
                    </label>
                    <input type="text" required />
                  </div>

                </div>

              </div>


              {/* PAYMENT METHOD */}

              <div className="card">

                <h3>Payment Method</h3>

                <label className="radio">

                  <input
                    type="radio"
                    name="payment"
                    value="bank"
                    checked={paymentMethod === "bank"}
                    onChange={(e) =>
                      setPaymentMethod(e.target.value)
                    }
                  />

                  Bank Transfer

                </label>

                <label className="radio">

                  <input
                    type="radio"
                    name="payment"
                    value="card"
                    checked={paymentMethod === "card"}
                    onChange={(e) =>
                      setPaymentMethod(e.target.value)
                    }
                  />

                  Credit / Debit Card

                </label>

              </div>

            </div>


            {/* RIGHT SIDE */}

            <div className="checkout-right card">

              <div className="order-summary">

                <h3>Payment Summary</h3>

                <div className="summary-row">
                  <span>Winning Bid</span>
                  <span>{auctionData.winningBid} PKR</span>
                </div>

                <div className="summary-row">
                  <span>Shipping Fee</span>
                  <span>{auctionData.shippingFee} PKR</span>
                </div>

                <div className="summary-row">
                  <span>Tax</span>
                  <span>{auctionData.tax} PKR</span>
                </div>

                <hr />

                <div className="summary-row total">
                  <span>Total Payment</span>
                  <span>{totalPayment} PKR</span>
                </div>

                <button
                  type="submit"
                  className="place-order"
                >
                  Pay {totalPayment} PKR
                </button>

              </div>

            </div>

          </div>

        </form>

      </div>

      <Footer />
    </>
  );
};

export default CheckoutPage;