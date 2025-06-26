import Header from "./Header";
import Hero from "./Hero";
import Features from "./Features";
import Demo from "./Demo";
import CTA from "./CTA";
import Footer from "./Footer";
import { useAuth } from "../contexts/AuthContext";
import { useEffect, useRef } from "react";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          renderButton: (element: HTMLElement, options: any) => void;
          prompt: () => void;
          disableAutoSelect: () => void;
        };
      };
    };
  }
}

function Landing() {
  const { login, error } = useAuth();
  const googleButtonRef = useRef<HTMLDivElement>(null);

  const GoogleSignInButton = () => {
    return (
      <div className="mb-16">
        <div className="flex flex-col items-center space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-3 rounded-lg max-w-md">
              <div className="flex items-center">
                <svg
                  className="w-5 h-5 mr-2\"
                  fill="currentColor\"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z\"
                    clipRule="evenodd"
                  />
                </svg>
                {error}
              </div>
            </div>
          )}

        </div>
      </div>
    );
  };

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
        theme: "outline",
        size: "large",
        type: "standard",
        text: "signin_with",
        shape: "rectangular",
        logo_alignment: "left",
        width: 280,
      });
    }
  }, [login]);
  return (
    <div className="min-h-screen flex flex-col relative">
      <Header />
      <main>
        <Hero />
        <GoogleSignInButton></GoogleSignInButton>
          <Demo />
        <Features />
        <CTA />
      </main>
      <div className="text-center py-8 text-white/70">
        Made with <span className="text-red-500">{' <3 '}</span> by
        Jailbreaker 
      </div>
      <Footer />  
      <div className="fixed h-24 w-24 bottom-10 right-10 z-50">
        <a href="https://bolt.new/">
        <img 
          src="/white_circle_360x360.png" 
          alt="Recollect Logo" 
          className="h-24 w-24"
        />
        </a>
      </div>
    </div>
  );
}

export default Landing;
