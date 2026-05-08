import emailjs from '@emailjs/browser';

const SERVICE_ID = 'service_ogbjpw6';      // from EmailJS
const TEMPLATE_ID = 'template_g0x72ju';    // from EmailJS
const PUBLIC_KEY = 'XbDr1fJb0w_84aAWs';      // from EmailJS

export const sendOTPEmail = async (toEmail, toName, otpCode) => {
    try {
        const templateParams = {
            to_email: toEmail,
            to_name: toName || 'User',
            otp_code: otpCode,
            name: toName || 'Real-Time Auction Platform', 
            email: toEmail,                               
        };

        const response = await emailjs.send(
            SERVICE_ID,
            TEMPLATE_ID,
            templateParams,
            PUBLIC_KEY
        );

        console.log('Email sent successfully:', response);
        return { success: true };

    } catch (error) {
        console.error('Email sending failed:', error);
        return { success: false, message: error.message };
    }
};