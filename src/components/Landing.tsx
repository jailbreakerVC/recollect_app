import React, { useEffect, useRef } from 'react';
import { ArrowRight, BookmarkPlus, Search, Database, Chrome } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

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

const Landing: React.FC = () => {
  const { login, loading, error } = useAuth();
  const googleButtonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.google?.accounts?.id && googleButtonRef.current) {
      window.google.accounts.id.initialize({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || "YOUR_GOOGLE_CLIENT_ID",
        callback: (response: any) => {
          login(response.credential);
        },
        auto_select: false,
        cancel_on_tap_outside: true,
      });

      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: "filled_blue",
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
    <div className="min-h-screen bg-gradient-to-br from-primary-dark via-secondary-dark to-primary-dark">
      {/* Navigation */}
      <nav className="relative z-10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-accent to-accent-hover rounded-lg flex items-center justify-center">
              <BookmarkPlus className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-text-primary">Recollect</span>
          </div>
          
          <div className="hidden md:flex items-center space-x-8">
            <a href="#features" className="text-text-secondary hover:text-text-primary transition-colors">Features</a>
            <a href="#how-it-works" className="text-text-secondary hover:text-text-primary transition-colors">How it Works</a>
            <a href="#pricing" className="text-text-secondary hover:text-text-primary transition-colors">Pricing</a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10 px-6 py-20">
        <div className="max-w-4xl mx-auto text-center">
          <div className="mb-8">
            <h1 className="text-5xl md:text-6xl font-bold text-text-primary mb-6 leading-tight">
              Remember Everything
              <span className="block text-accent">With Recollect</span>
            </h1>
            
            <p className="text-xl text-text-secondary leading-relaxed max-w-2xl mx-auto">
              Transform your bookmarks into an intelligent discovery engine. 
              Find what you need, when you need it, with AI-powered search and context-aware suggestions.
            </p>
          </div>

          {/* Authentication Section */}
          <div className="mb-16">
            <div className="max-w-md mx-auto">
              {error && (
                <div className="mb-6 p-4 bg-red-900/20 border border-red-500/30 rounded-lg">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              <div className="bg-secondary-dark/50 backdrop-blur-sm border border-border rounded-xl p-8">
                <h3 className="text-lg font-semibold text-text-primary mb-4">
                  Get Started
                </h3>
                <p className="text-text-secondary text-sm mb-6">
                  Sign in with Google to access your personalized bookmark dashboard
                </p>

                {loading ? (
                  <div className="flex items-center justify-center p-4">
                    <div className="w-6 h-6 border-2 border-accent/20 border-t-accent rounded-full animate-spin mr-3"></div>
                    <span className="text-text-secondary">Signing you in...</span>
                  </div>
                ) : (
                  <div ref={googleButtonRef} className="flex justify-center"></div>
                )}

                <p className="text-xs text-text-secondary mt-4">
                  By signing in, you agree to our Terms of Service and Privacy Policy
                </p>
              </div>
            </div>
          </div>

          {/* Features Preview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
            <div className="bg-secondary-dark/30 backdrop-blur-sm border border-border rounded-xl p-6">
              <div className="w-12 h-12 bg-accent/20 rounded-lg flex items-center justify-center mb-4 mx-auto">
                <Search className="w-6 h-6 text-accent" />
              </div>
              <h3 className="text-lg font-semibold text-text-primary mb-2">Smart Search</h3>
              <p className="text-text-secondary text-sm">
                Find bookmarks by meaning, not just keywords. Our AI understands context and intent.
              </p>
            </div>

            <div className="bg-secondary-dark/30 backdrop-blur-sm border border-border rounded-xl p-6">
              <div className="w-12 h-12 bg-accent/20 rounded-lg flex items-center justify-center mb-4 mx-auto">
                <Chrome className="w-6 h-6 text-accent" />
              </div>
              <h3 className="text-lg font-semibold text-text-primary mb-2">Chrome Integration</h3>
              <p className="text-text-secondary text-sm">
                Seamlessly sync with your Chrome bookmarks. Right-click any text to search instantly.
              </p>
            </div>

            <div className="bg-secondary-dark/30 backdrop-blur-sm border border-border rounded-xl p-6">
              <div className="w-12 h-12 bg-accent/20 rounded-lg flex items-center justify-center mb-4 mx-auto">
                <Database className="w-6 h-6 text-accent" />
              </div>
              <h3 className="text-lg font-semibold text-text-primary mb-2">Secure Storage</h3>
              <p className="text-text-secondary text-sm">
                Your bookmarks are encrypted and stored securely. Access them from anywhere.
              </p>
            </div>
          </div>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="#features"
              className="inline-flex items-center px-6 py-3 bg-secondary-dark border border-border text-text-primary rounded-lg hover:bg-hover transition-colors"
            >
              Learn More
              <ArrowRight className="w-4 h-4 ml-2" />
            </a>
          </div>
        </div>
      </main>

      {/* Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-accent/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-accent/5 rounded-full blur-3xl"></div>
      </div>
    </div>
  );
};

export default Landing;