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
        // ✅ Wait briefly for Supabase to process the token
        await new Promise(resolve => setTimeout(resolve, 800));

        // ✅ Check current session first
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
          setStatus("valid");
          return;
        }

        // ✅ Try from saved hash in sessionStorage (captured in index.html)
        const savedHash = sessionStorage.getItem('recovery_hash');
        if (savedHash && savedHash.includes('type=recovery')) {
          const params = new URLSearchParams(savedHash.substring(1));
          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');

          if (accessToken && refreshToken) {
            const { data } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken
            });

            if (data?.session) {
              sessionStorage.removeItem('recovery_hash');
              setStatus("valid");
              return;
            }
          }
        }

        setStatus("invalid");

      } catch (err) {
        console.error(err);
        setStatus("invalid");
      }
    };

    checkRecoverySession();
  }, []);

  const handleClose = async () => {
    await supabase.auth.signOut();
    sessionStorage.removeItem('recovery_hash');
    navigate("/");
  };

  if (status === "loading") {
    return (
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        fontFamily: "system-ui"
      }}>
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