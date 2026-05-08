// Generate random 6-digit OTP
export const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Store OTP temporarily with expiry
export const storeOTP = (email, otp) => {
  const otpData = {
    otp: otp,
    email: email,
    expiry: Date.now() + 10 * 60 * 1000 // 10 minutes
  };
  sessionStorage.setItem('otp_data', JSON.stringify(otpData));
};

// Verify OTP
export const verifyOTP = (enteredOTP) => {
  const stored = sessionStorage.getItem('otp_data');
  if (!stored) return { valid: false, message: 'OTP not found' };

  const otpData = JSON.parse(stored);

  // Check if expired
  if (Date.now() > otpData.expiry) {
    sessionStorage.removeItem('otp_data');
    return { valid: false, message: 'OTP has expired' };
  }

  // Check if matches
  if (otpData.otp !== enteredOTP) {
    return { valid: false, message: 'Invalid OTP code' };
  }

  // OTP is valid
  sessionStorage.removeItem('otp_data');
  return { valid: true, message: 'OTP verified successfully' };
};