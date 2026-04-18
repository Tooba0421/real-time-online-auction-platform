import { useState, useLayoutEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaChevronDown } from "react-icons/fa";

import Header from "../components/Header";
import Footer from "../components/Footer";
import "../styles/faq.css";
import "../styles/common.css";

const faqData = [
    {
        question: "How does bidding work?",
        answer:
            "Browse active auctions, log in, and place a bid higher than the current highest bid. If your bid is the highest when the auction ends, you win the item."
    },
    {
        question: "What should I know before placing a bid?",
        answer:
            "A bid is a commitment to purchase the item if you win. Once placed, bids cannot be changed or canceled, so make sure before bidding."
    },
    {
        question: "How do I know if I’ve won an auction?",
        answer:
            "You will receive a notification after winning, and the item will also appear in your notification section."
    },
    {
        question: "What happens if I win an auction?",
        answer:
            "If you win, you must complete the payment within the given time period. After successful payment, we will ship the item to you."
    },
    {
        question: "How do I make a payment?",
        answer:
            "Payment instructions are shared after winning an auction. You must complete payment within 24 hours or within the specified time period, or the item may be offered to the next highest bidder."
    },
    {
        question: "What payment methods are accepted?",
        answer:
            "We support secure payment methods such as Visa."
    },
    {
        question: "Is my payment secure?",
        answer:
            "Yes. All transactions are processed securely, and your sensitive information is fully protected."
    },
    {
        question: "How long do I have to pay after winning?",
        answer:
            "You are required to complete payment within the specified time period, usually 24 hours. Delays may lead to cancellation or account restrictions."
    },
    {
        question: "What happens if I don’t pay after winning?",
        answer:
            "Failure to complete payment may result in order cancellation and possible account suspension. The item will then be offered to another bidder."
    },
    {
        question: "How long do auctions last?",
        answer:
            "Each auction has a fixed duration set by the seller. You can view the remaining time on each product listing."
    },
    {
        question: "Can an auction be canceled after it starts?",
        answer:
            "Once an auction begins, bidders cannot cancel it. However, sellers may cancel an auction in special cases, such as no bids or exceptional circumstances."
    },
    {
        question: "How does shipping work?",
        answer:
            "Shipping is handled by the admin team after the seller confirms the order. Delivery time and charges depend on the item type and delivery location."
    },
    {
        question: "What happens if I don’t receive my item?",
        answer:
            "If you do not receive your item within the expected delivery time, contact support immediately. The admin team will investigate and help resolve the issue."
    },
    {
        question: "Can I return an auction item?",
        answer:
            "No, returns are not allowed. All items are sold as final once the auction is completed. Please review the item details carefully before placing a bid."
    },
    {
        question: "How can I contact a seller?",
        answer:
            "Buyers cannot contact sellers directly. All communication is handled through the admin team to ensure safety and proper handling of requests."
    },
    {
        question: "Can I sell my own items?",
        answer:
            "Yes. After registering and getting approval from admin, you can list your items and start auctions on the platform."
    },
    {
        question: "How do you ensure product authenticity?",
        answer:
            "Sellers must list genuine products with accurate descriptions. Buyers are advised to review details carefully and contact sellers if they need clarification."
    }
];

const FAQ = () => {
    const [activeIndex, setActiveIndex] = useState(null);
    const navigate = useNavigate();

    useLayoutEffect(() => {
        window.scrollTo({ top: 0 });
    }, []);

    const toggleFAQ = (index) => {
        setActiveIndex(activeIndex === index ? null : index);
    };

    return (
        <>
            <Header />

            <div className="faq-container">

                {/* TITLE */}
                <div className="faq-title">
                    <h1>Frequently Asked Questions</h1>
                    <p>Find answers to common questions about bidding, payments, and selling.</p>
                </div>

                {/* FAQ LIST */}
                <div className="faq-list">
                    {faqData.map((item, index) => (
                        <div
                            key={index}
                            className={`faq-item ${activeIndex === index ? "active" : ""}`}
                        >
                            <div className="faq-question" onClick={() => toggleFAQ(index)}>
                                <h3>{item.question}</h3>
                                <FaChevronDown className="faq-icon" />
                            </div>

                            <div className="faq-answer">
                                <p>{item.answer}</p>
                            </div>
                        </div>
                    ))}
                </div>

            </div>

            <Footer />
        </>
    );
};

export default FAQ;