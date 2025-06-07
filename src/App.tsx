import React from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Landing from './components/Landing';
import Dashboard from './components/Dashboard';
import BookmarkManager from './components/BookmarkManager';

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-lg text-gray-600">Loading your secure session...</p>
        </div>
      </div>
    );
  }

  // Simple routing based on hash
  const currentHash = window.location.hash;
  
  if (!user) {
    return <Landing />;
  }

  if (currentHash === '#bookmarks') {
    return <BookmarkManager />;
  }

  return <Dashboard />;
};

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;