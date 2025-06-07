import React, { useEffect, useRef } from 'react';
import { Shield, Lock, Users, Zap } from 'lucide-react';
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
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID',
        callback: (response: any) => {
          login(response.credential);
        },
        auto_select: false,
        cancel_on_tap_outside: true,
      });

      window.google.accounts.id.renderButton(
        googleButtonRef.current,
        {
          theme: 'outline',
          size: 'large',
          type: 'standard',
          text: 'signin_with',
          shape: 'rectangular',
          logo_alignment: 'left',
          width: 280,
        }
      );
    }
  }, [login]);

  const features = [
    {
      icon: Shield,
      title: 'Secure Authentication',
      description: 'OAuth 2.0 security with Google\'s trusted infrastructure'
    },
    {
      icon: Lock,
      title: 'Privacy Protected',
      description: 'Your data is encrypted and never shared without permission'
    },
    {
      icon: Users,
      title: 'Single Sign-On',
      description: 'Use your existing Google account - no new passwords needed'
    },
    {
      icon: Zap,
      title: 'Lightning Fast',
      description: 'Instant access with just one click authentication'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/5 to-indigo-600/5"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
          <div className="text-center">
            <div className="mb-8 flex justify-center">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full blur-xl opacity-30 animate-pulse"></div>
                <div className="relative bg-gradient-to-r from-blue-600 to-indigo-600 p-4 rounded-full">
                  <Shield className="w-12 h-12 text-white" />
                </div>
              </div>
            </div>
            
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
              Secure Access
              <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent"> Portal</span>
            </h1>
            
            <p className="text-xl text-gray-600 mb-12 max-w-3xl mx-auto leading-relaxed">
              Experience seamless and secure authentication with Google OAuth 2.0. 
              Sign in instantly using your existing Google account with enterprise-grade security.
            </p>

            {/* Google Sign-In Button */}
            <div className="mb-16">
              <div className="flex flex-col items-center space-y-6">
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-3 rounded-lg max-w-md">
                    <div className="flex items-center">
                      <svg className="w-5 h-5 mr-2\" fill="currentColor\" viewBox="0 0 20 20">
                        <path fillRule="evenodd\" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z\" clipRule="evenodd" />
                      </svg>
                      {error}
                    </div>
                  </div>
                )}
                
                <div className="relative">
                  <div className="absolute inset-0 bg-white rounded-lg shadow-2xl blur-sm transform scale-105 opacity-50"></div>
                  <div className="relative bg-white p-8 rounded-lg shadow-xl border border-gray-100">
                    <div className="text-center mb-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Welcome Back</h3>
                      <p className="text-gray-600">Sign in to continue to your account</p>
                    </div>
                    
                    {loading ? (
                      <div className="flex items-center justify-center p-4">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        <span className="ml-3 text-gray-600">Signing you in...</span>
                      </div>
                    ) : (
                      <div ref={googleButtonRef} className="flex justify-center"></div>
                    )}

                    <p className="text-sm text-gray-500 mt-6 text-center">
                      By signing in, you agree to our Terms of Service and Privacy Policy
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Why Choose Our Platform?</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Built with modern security standards and designed for the best user experience
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <div 
                key={index}
                className="group text-center p-6 rounded-xl hover:bg-gradient-to-br hover:from-blue-50 hover:to-indigo-50 transition-all duration-300 hover:shadow-lg hover:transform hover:-translate-y-1"
              >
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full mb-4 group-hover:scale-110 transition-transform duration-300">
                  <feature.icon className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Trust Indicators */}
      <div className="py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h3 className="text-2xl font-bold text-gray-900 mb-8">Trusted by thousands of users worldwide</h3>
          <div className="flex items-center justify-center space-x-8 text-gray-500">
            <div className="flex items-center">
              <Shield className="w-6 h-6 mr-2 text-green-600" />
              <span className="font-medium">SSL Encrypted</span>
            </div>
            <div className="flex items-center">
              <Lock className="w-6 h-6 mr-2 text-blue-600" />
              <span className="font-medium">OAuth 2.0</span>
            </div>
            <div className="flex items-center">
              <Users className="w-6 h-6 mr-2 text-indigo-600" />
              <span className="font-medium">GDPR Compliant</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Landing;