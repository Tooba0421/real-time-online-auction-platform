import { useState } from "react";
import { useNavigate } from "react-router-dom";
import ResetPasswordModal from "../components/ResetPasswordModal";

const ResetPasswordPage = () => {
  const [showModal, setShowModal] = useState(true);
  const navigate = useNavigate();

  const handleClose = () => {
    setShowModal(false);
    navigate("/"); // go to home when modal closes
  };

  return (
    <div>
      {showModal && (
        <ResetPasswordModal
          closeModal={handleClose}
        />
      )}
    </div>
  );
};

export default ResetPasswordPage;