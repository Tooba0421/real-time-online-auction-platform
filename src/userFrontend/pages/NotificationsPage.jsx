import { useNavigate } from "react-router-dom";
import { useLayoutEffect } from "react";
import { FaArrowLeft } from "react-icons/fa";
import { products } from "../data/products";
import Header from "../components/Header";
import Footer from "../components/Footer";
import "../styles/common.css";
import "../styles/notifications.css";

const notifications = [
    {
        id: 1,
        type: "outbid",
        message: "You have been outbid on Vintage Wooden Chair",
        time: "2 minutes ago",
        productId: 1,
        actionText: "Place New Bid"
    },
    {
        id: 2,
        type: "win",
        message: "Congratulations! You won the auction for Antique Vase",
        time: "1 hour ago",
        productId: 3,
        actionText: "Go To Checkout"
    },
    {
        id: 3,
        type: "ending",
        message: "Auction ending soon: Luxury Gold Bracelet",
        time: "3 hours ago",
        productId: 9,
        actionText: "View Auction"
    },
    {
        id: 4,
        type: "shipping",
        message: "Your order has been shipped",
        time: "Yesterday",
        productId: 4,
        actionText: null
    },
    {
        id: 5,
        type: "bid-success",
        message: "Your bid is currently the highest!",
        time: "2 days ago",
        productId: 5,
        actionText: "View Auction"
    }
];

const NotificationsPage = () => {

    const navigate = useNavigate();

    useLayoutEffect(() => {
        window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }, []);

    return (
        <>
            <Header />
            <div className="notifications">
                <div className="notifications-container">

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

                        <h2 className="page-heading">Notifications</h2>

                    </div>

                    <div className="notifications-list">

                        {notifications.map((n) => (

                            <div key={n.id} className={`notification-item ${n.type}`}>

                                <div className="notification-text">
                                    <p>{n.message}</p>
                                    <span>{n.time}</span>
                                </div>

                                {n.actionText && (
                                    <button
                                        className="notification-action"
                                        onClick={() => {
                                            const product = products.find(p => p.id === n.productId);

                                            if (!product) return;

                                            if (n.type === "win") {
                                                navigate(`/checkout`, {
                                                    state: { product }
                                                });
                                            } else if (n.type === "shipping") {
                                                navigate(`/orders/${n.productId}`);
                                            } else {
                                                navigate(`/product/${n.productId}`, {
                                                    state: { product, products }
                                                });
                                            }
                                        }}
                                    >
                                        {n.actionText}
                                    </button>
                                )}

                            </div>

                        ))}

                    </div>

                </div>
            </div>

            <Footer />
        </>
    );
};

export default NotificationsPage;