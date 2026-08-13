import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

// Public referral landing. A parent shares a link like
// https://<host>/r/AKU-A1B2C3 with another family. This page captures
// the code, stashes it in localStorage, and redirects to /interes so
// the target family fills out the form as usual. The submit-interest
// edge function resolves the code to the referring student when the
// form is submitted, so an invalid code is silently ignored.
export default function PublicReferralLanding() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (typeof window !== 'undefined' && code) {
      const clean = code.trim().toUpperCase();
      if (clean) {
        try {
          window.localStorage.setItem('aku_referral_code', clean);
        } catch { /* private mode, ignore */ }
      }
    }
    navigate('/interes', { replace: true });
  }, [code, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
      Un momento…
    </div>
  );
}
