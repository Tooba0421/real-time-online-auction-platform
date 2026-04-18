import { useState } from "react";
import { FaTimes } from "react-icons/fa";
import "../styles/auth.css";

const SellerRegistrationModal = ({ closeModal }) => {

    const [formData, setFormData] = useState({
        sellerName: "",
        phone: "",
        city: "",
        postalCode: "",
        category: "",
        address: "",
        description: "",
        cnicFront: null,
        cnicBack: null,
    });

    const handleChange = (e) => {
        const { name, value, files } = e.target;

        if (files) {
            setFormData({ ...formData, [name]: files[0] });
        } else {
            setFormData({ ...formData, [name]: value });
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        console.log("Seller Data:", formData);

        // You can send this to Firebase / backend
        closeModal();
    };

    return (
        <div className="auth-overlay">
            <div className="auth-modal seller-modal">

                <FaTimes className="close-icon" onClick={closeModal} />

                <h2>Seller Registration</h2>

                <form className="auth-form seller-form" onSubmit={handleSubmit}>

                    {/* Row 1 */}
                    <div className="seller-row">
                        <div className="input-front">
                            <label>Full Name</label>
                            <input
                                className="auth-input"
                                type="text"
                                name="sellerName"
                                placeholder="e.g. Ali Khan"
                                required
                                onChange={handleChange}
                            />
                        </div>

                        <div className="input-front">
                            <label>Email Address</label>
                            <input
                                className="auth-input"
                                type="email"
                                name="email"
                                placeholder="e.g. ali@gmail.com"
                                required
                                onChange={handleChange}
                            />
                        </div>
                    </div>

                    {/* Row 2 */}
                    <div className="seller-row">
                        <div className="input-front">
                            <label>Phone Number</label>
                            <input
                                className="auth-input"
                                type="text"
                                name="phone"
                                placeholder="03XX-XXXXXXX"
                                required
                                onChange={handleChange}
                            />
                        </div>

                        <div className="input-front">
                            <label>CNIC Number</label>
                            <input
                                className="auth-input"
                                type="text"
                                name="cnic"
                                placeholder="XXXXX-XXXXXXX-X"
                                required
                                onChange={handleChange}
                            />
                        </div>
                    </div>

                    {/* Row 3 */}
                    <div className="seller-row">
                        <div className="input-front">
                            <label>City</label>
                            <input
                                className="auth-input"
                                type="text"
                                name="city"
                                placeholder="e.g. Karachi"
                                required
                                onChange={handleChange}
                            />
                        </div>

                        <div className="input-front">
                            <label>Postal Code</label>
                            <input
                                className="auth-input"
                                type="text"
                                name="postalCode"
                                placeholder="e.g. 75400"
                                required
                                onChange={handleChange}
                            />
                        </div>
                    </div>

                    {/* Address */}
                    <div className="input-front">
                        <label>Full Address</label>
                        <input
                            className="auth-input"
                            type="text"
                            name="address"
                            placeholder="House #, Street, Area, City"
                            required
                            onChange={handleChange}
                        />
                    </div>

                    {/* File Upload */}
                    <div className="seller-row">
                        <div className="file-box">
                            <label>CNIC Front Image</label>
                            <input type="file" name="cnicFront" required onChange={handleChange} />
                        </div>

                        <div className="file-box">
                            <label>CNIC Back Image</label>
                            <input type="file" name="cnicBack" required onChange={handleChange} />
                        </div>
                    </div>

                    <button className="auth-btn">Submit for Approval</button>

                </form>

            </div>
        </div>
    );
};

export default SellerRegistrationModal;