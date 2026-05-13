import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabase/supabase";
import ResetPasswordModal from "../components/ResetPasswordModal";

const ResetPasswordPage = () => {

  const [status, setStatus] = useState('loading');
  const navigate = useNavigate();

  useEffect(() => {
    const init = async () => {
      try {
        // Get hash from sessionStorage (saved before React loaded)
        const savedHash = sessionStorage.getItem('recovery_hash');
        const currentHash = window.location.hash;
        const hash = savedHash || currentHash;

        console.log('Saved hash:', savedHash);
        console.log('Current hash:', currentHash);
        console.log('Using hash:', hash);

        if (hash && hash.includes('type=recovery')) {
          // Parse tokens from hash
          const params = new URLSearchParams(hash.substring(1));
          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');

          console.log('Access token exists:', !!accessToken);
          console.log('Refresh token exists:', !!refreshToken);

          if (accessToken && refreshToken) {
            // Set session with tokens
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken
            });

            console.log('Set session data:', data);
            console.log('Set session error:', error);

            if (data?.session) {
              // Clear saved hash
              sessionStorage.removeItem('recovery_hash');
              setStatus('valid');
              return;
            }
          }
        }

        // No valid recovery token found
        setStatus('invalid');

      } catch (err) {
        console.error('Error:', err);
        setStatus('invalid');
      }
    };

    init();
  }, []);

  const handleClose = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (status === 'loading') {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        fontFamily: 'system-ui'
      }}>
        <p>Verifying your reset link...</p>
      </div>
    );
  }

  return (
    <ResetPasswordModal
      isValid={status === 'valid'}
      closeModal={handleClose}
    />
  );
};

export default ResetPasswordPage;