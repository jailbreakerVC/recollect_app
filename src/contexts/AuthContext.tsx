import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  id: string;
  name: string;
  email: string;
  picture: string;
}

interface AuthContextType {
  user: User | null;
  login: (credential: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check for existing session on app load
    const storedUser = localStorage.getItem('user');
    const tokenExpiry = localStorage.getItem('tokenExpiry');
    
    if (storedUser && tokenExpiry) {
      const expiryTime = parseInt(tokenExpiry, 10);
      const currentTime = Date.now();
      
      if (currentTime < expiryTime) {
        try {
          setUser(JSON.parse(storedUser));
        } catch (e) {
          console.error('Error parsing stored user data:', e);
          localStorage.removeItem('user');
          localStorage.removeItem('tokenExpiry');
        }
      } else {
        // Token expired, clear storage
        localStorage.removeItem('user');
        localStorage.removeItem('tokenExpiry');
      }
    }
    setLoading(false);
  }, []);

  const login = async (credential: string): Promise<void> => {
    setLoading(true);
    setError(null);
    
    try {
      // Decode JWT token to get user information
      const payload = JSON.parse(atob(credential.split('.')[1]));
      
      const userData: User = {
        id: payload.sub,
        name: payload.name,
        email: payload.email,
        picture: payload.picture,
      };

      // Store user data and set token expiry (1 hour from now)
      const expiryTime = Date.now() + (60 * 60 * 1000); // 1 hour
      localStorage.setItem('user', JSON.stringify(userData));
      localStorage.setItem('tokenExpiry', expiryTime.toString());
      
      setUser(userData);
    } catch (error) {
      console.error('Login error:', error);
      setError('Failed to authenticate. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setError(null);
    localStorage.removeItem('user');
    localStorage.removeItem('tokenExpiry');
    
    // Revoke Google session
    if (window.google?.accounts?.id) {
      window.google.accounts.id.disableAutoSelect();
    }
  };

  const value = {
    user,
    login,
    logout,
    loading,
    error,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};