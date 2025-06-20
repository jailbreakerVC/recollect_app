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
  const { login, loading, error } = useAuth();
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

          <div className="relative">
            <div className="absolute inset-0 bg-white rounded-lg shadow-2xl blur-sm transform scale-105 opacity-50"></div>
            <div className="relative bg-white p-8 rounded-lg shadow-xl border border-gray-100">
              <div className="text-center mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Welcome Back
                </h3>
                <p className="text-gray-600">
                  Sign in to continue to your account
                </p>
              </div>

              {loading ? (
                <div className="flex items-center justify-center p-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-3 text-gray-600">Signing you in...</span>
                </div>
              ) : (
                <div
                  ref={googleButtonRef}
                  className="flex justify-center"
                ></div>
              )}

              <p className="text-sm text-gray-500 mt-6 text-center">
                By signing in, you agree to our Terms of Service and Privacy
                Policy
              </p>
            </div>
          </div>
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
    <div className="min-h-screen flex flex-col">
      <Header />
      <main>
        <Hero />
        <GoogleSignInButton></GoogleSignInButton>
        <Features />
        <Demo />
        <CTA />
      </main>
      <div className="text-center py-8 text-white/70">
        Made with <span className="text-red-500">❤️</span> in delhi by
        Jailbreaker
      </div>
      <Footer />
    </div>
  );
}

export default Landing;
