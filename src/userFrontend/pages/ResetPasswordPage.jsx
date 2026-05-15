import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabase/supabase";
import ResetPasswordModal from "../components/ResetPasswordModal";

const ResetPasswordPage = () => {

  const [status, setStatus] = useState("loading");
  const navigate = useNavigate();

  useEffect(() => {

    const checkRecoverySession = async () => {

      try {

        const {
          data: { session }
        } = await supabase.auth.getSession();

        if (session?.user) {
          setStatus("valid");
        } else {
          setStatus("invalid");
        }

      } catch (err) {
        console.error(err);
        setStatus("invalid");
      }
    };

    checkRecoverySession();

  }, []);

  const handleClose = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (status === "loading") {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          fontFamily: "system-ui"
        }}
      >
        <p>Verifying your reset link...</p>
      </div>
    );
  }

  return (
    <ResetPasswordModal
      isValid={status === "valid"}
      closeModal={handleClose}
    />
  );
};

export default ResetPasswordPage;