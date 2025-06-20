import { useEffect, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";

function GoogleSignInButton() {
  const { login } = useAuth();
  const googleButtonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.google?.accounts?.id && googleButtonRef.current) {
      window.google.accounts.id.initialize({
        client_id:
          import.meta.env.VITE_GOOGLE_CLIENT_ID || "YOUR_GOOGLE_CLIENT_ID",
        callback: (response: any) => {
          login(response.credential);
        },
        auto_select: false,
        cancel_on_tap_outside: true,
      });

      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: "filled_blue",
        size: "large",
        type: "continue",
        text: "continue_with",
        shape: "pill",
        logo_alignment: "left",
        width: 180,
      });
    }
  }, [login]);

  return (
    <div className="glass-button bg-blue-600 hover:bg-blue-500 flex items-center justify-center gap-2">
      <div ref={googleButtonRef}></div>
    </div>
  );
}

export default GoogleSignInButton;
