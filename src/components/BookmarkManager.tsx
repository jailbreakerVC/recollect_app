import React, { useState, useEffect } from 'react';
import { Bookmark, Folder, Calendar, ExternalLink, Search, Filter, Plus, AlertCircle, RefreshCw, Database, Chrome, RotateCcw, CheckCircle, Clock, TrendingUp, Bug, TestTube, Wifi } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSupabaseBookmarks } from '../hooks/useSupabaseBookmarks';
import { ExtensionService } from '../services/extensionService';
import { BookmarkService } from '../services/bookmarkService';
import { ToastContainer, useToast } from './Toast';
import { BookmarkGrid } from './BookmarkGrid';
import { BookmarkControls } from './BookmarkControls';
import { StatusCards } from './StatusCards';
import { DebugPanel } from './DebugPanel';

const BookmarkManager: React.FC = () => {
  const { user } = useAuth();
  const {
    bookmarks,
    loading,
    error,
    extensionAvailable,
    syncWithExtension,
    addBookmark,
    removeBookmark,
    refreshBookmarks,
    syncStatus,
    lastSyncResult
  } = useSupabaseBookmarks();

  const { toasts, removeToast, showSuccess, showError, showLoading, updateToast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'title' | 'folder'>('date');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newBookmark, setNewBookmark] = useState({ title: '', url: '', folder: '' });
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'connected' | 'disconnected'>('unknown');

  // Initialize extension service
  useEffect(() => {
    console.log('📱 BookmarkManager: Setting up extension service');
    ExtensionService.initialize();
    
    return () => {
      console.log('📱 BookmarkManager: Component unmounting');
    };
  }, []);

  // Test database connection on mount
  useEffect(() => {
    const testConnection = async () => {
      try {
        const isConnected = await BookmarkService.testBasicConnection();
        setConnectionStatus(isConnected ? 'connected' : 'disconnected');
      } catch {
        setConnectionStatus('disconnected');
      }
    };

    testConnection();
  }, []);

  // Debug user context in development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && user) {
      const debugContext = async () => {
        try {
          const debug = await BookmarkService.debugUserContext();
          setDebugInfo(debug);
        } catch (err) {
          console.error('Failed to get debug info:', err);
          setDebugInfo({ error: 'Failed to get debug info' });
        }
      };
      
      debugContext();
    }
  }, [user]);

  const filteredBookmarks = bookmarks
    .filter(bookmark => {
      const matchesSearch = bookmark.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           bookmark.url.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFolder = selectedFolder === 'all' || bookmark.folder === selectedFolder;
      return matchesSearch && matchesFolder;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'title':
          return a.title.localeCompare(b.title);
        case 'folder':
          return (a.folder || '').localeCompare(b.folder || '');
        case 'date':
        default:
          return new Date(b.date_added).getTime() - new Date(a.date_added).getTime();
      }
    });

  const getFolderNames = () => {
    const folderNames = Array.from(new Set(bookmarks.map(b => b.folder).filter(Boolean)));
    return folderNames.sort();
  };

  const handleAddBookmark = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBookmark.title || !newBookmark.url) return;

    const loadingToastId = showLoading('Adding Bookmark', 'Creating new bookmark...');

    try {
      await addBookmark(
        newBookmark.title, 
        newBookmark.url, 
        newBookmark.folder || undefined
      );
      
      removeToast(loadingToastId);
      showSuccess('Bookmark Added', `"${newBookmark.title}" has been added successfully`);
      
      setNewBookmark({ title: '', url: '', folder: '' });
      setShowAddForm(false);
    } catch (err) {
      removeToast(loadingToastId);
      const message = err instanceof Error ? err.message : 'Failed to add bookmark';
      showError('Add Failed', message);
      console.error('Failed to add bookmark:', err);
    }
  };

  const handleRemoveBookmark = async (id: string) => {
    const bookmark = bookmarks.find(b => b.id === id);
    if (!bookmark) return;

    if (window.confirm(`Are you sure you want to remove "${bookmark.title}"?`)) {
      const loadingToastId = showLoading('Removing Bookmark', 'Deleting bookmark...');

      try {
        await removeBookmark(id);
        removeToast(loadingToastId);
        showSuccess('Bookmark Removed', `"${bookmark.title}" has been removed`);
      } catch (err) {
        removeToast(loadingToastId);
        const message = err instanceof Error ? err.message : 'Failed to remove bookmark';
        showError('Remove Failed', message);
        console.error('Failed to remove bookmark:', err);
      }
    }
  };

  const handleSyncWithExtension = async () => {
    if (!extensionAvailable) {
      showError('Extension Not Available', 'Chrome extension is not installed or not responding');
      return;
    }

    const loadingToastId = showLoading('Syncing Bookmarks', 'Checking for changes...');

    try {
      const result = await syncWithExtension((status) => {
        updateToast(loadingToastId, { 
          title: 'Syncing Bookmarks', 
          message: status 
        });
      });
      
      removeToast(loadingToastId);
      
      if (result.hasChanges) {
        const changes = [];
        if (result.inserted > 0) changes.push(`${result.inserted} added`);
        if (result.updated > 0) changes.push(`${result.updated} updated`);
        if (result.removed > 0) changes.push(`${result.removed} removed`);
        
        showSuccess(
          'Sync Complete', 
          `Successfully synced ${result.total} bookmarks. Changes: ${changes.join(', ')}`
        );
      } else {
        showSuccess('Sync Complete', 'Your bookmarks are already up to date');
      }
    } catch (err) {
      removeToast(loadingToastId);
      const message = err instanceof Error ? err.message : 'Failed to sync with extension';
      showError('Sync Failed', message);
      console.error('Sync failed:', err);
    }
  };

  const handleRefresh = async () => {
    const loadingToastId = showLoading('Refreshing', 'Loading bookmarks from database...');

    try {
      await refreshBookmarks();
      removeToast(loadingToastId);
      showSuccess('Refreshed', 'Bookmarks reloaded from database');
    } catch (err) {
      removeToast(loadingToastId);
      const message = err instanceof Error ? err.message : 'Failed to refresh bookmarks';
      showError('Refresh Failed', message);
      console.error('Failed to refresh bookmarks:', err);
    }
  };

  const handleDebugRefresh = async () => {
    if (user) {
      try {
        const debug = await BookmarkService.debugUserContext();
        setDebugInfo(debug);
        showSuccess('Debug Info Updated', 'User context debug information refreshed');
      } catch (err) {
        showError('Debug Failed', 'Failed to get debug information');
      }
    }
  };

  const handleTestConnection = async () => {
    if (!user) return;
    
    const loadingToastId = showLoading('Testing Connection', 'Testing database connection...');
    
    try {
      const result = await BookmarkService.testConnection(user.id);
      removeToast(loadingToastId);
      
      if (result.success) {
        showSuccess('Connection Test', result.message);
        setDebugInfo(result.debug);
        setConnectionStatus('connected');
      } else {
        showError('Connection Test Failed', result.message);
        setDebugInfo(result.debug);
        setConnectionStatus('disconnected');
      }
    } catch (err) {
      removeToast(loadingToastId);
      const message = err instanceof Error ? err.message : 'Connection test failed';
      showError('Connection Test Error', message);
      setConnectionStatus('disconnected');
    }
  };

  if (loading && bookmarks.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-lg text-gray-600">Loading your bookmarks...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <ToastContainer toasts={toasts} onClose={removeToast} />

      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-3 rounded-lg">
                <Bookmark className="w-8 h-8 text-white" />
              </div>
              <div className="ml-4">
                <h1 className="text-2xl font-bold text-gray-900">Bookmark Manager</h1>
                <div className="flex items-center space-x-4 text-sm text-gray-600">
                  <div className="flex items-center">
                    <Database className="w-4 h-4 mr-1" />
                    <span>Supabase Database</span>
                    <div className={`w-2 h-2 rounded-full ml-2 ${
                      connectionStatus === 'connected' ? 'bg-green-500' :
                      connectionStatus === 'disconnected' ? 'bg-red-500' : 'bg-yellow-500'
                    }`} />
                  </div>
                  {extensionAvailable && (
                    <div className="flex items-center text-green-600">
                      <Chrome className="w-4 h-4 mr-1" />
                      <span>Chrome Extension</span>
                    </div>
                  )}
                  {syncStatus && (
                    <div className="flex items-center text-blue-600">
                      <Clock className="w-4 h-4 mr-1" />
                      <span>{syncStatus}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-500">
                {bookmarks.length} bookmarks
              </div>
              {process.env.NODE_ENV === 'development' && (
                <button
                  onClick={handleTestConnection}
                  className="inline-flex items-center px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
                  title="Test database connection"
                >
                  <TestTube className="w-4 h-4 mr-2" />
                  Test DB
                </button>
              )}
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                title="Refresh bookmarks from database"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              {extensionAvailable && (
                <button
                  onClick={handleSyncWithExtension}
                  disabled={loading}
                  className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Sync Chrome
                </button>
              )}
              <button
                onClick={() => window.location.hash = ''}
                className="inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <StatusCards 
          connectionStatus={connectionStatus}
          extensionAvailable={extensionAvailable}
          lastSyncResult={lastSyncResult}
        />

        <DebugPanel 
          user={user}
          extensionAvailable={extensionAvailable}
          bookmarks={bookmarks}
          loading={loading}
          error={error}
          syncStatus={syncStatus}
          connectionStatus={connectionStatus}
          debugInfo={debugInfo}
          onTestConnection={handleTestConnection}
          onDebugRefresh={handleDebugRefresh}
        />

        {error && (
          <div className="mb-8 bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex items-center">
              <AlertCircle className="w-6 h-6 text-red-600 mr-3" />
              <div className="flex-1">
                <p className="text-red-700 font-medium">Error</p>
                <p className="text-red-600 text-sm mt-1">{error}</p>
                <p className="text-red-600 text-sm mt-2">
                  Please check your Supabase configuration and ensure your project is active.
                </p>
              </div>
              <button
                onClick={handleRefresh}
                className="ml-4 inline-flex items-center px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                Try Again
              </button>
            </div>
          </div>
        )}

        <BookmarkControls
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          selectedFolder={selectedFolder}
          setSelectedFolder={setSelectedFolder}
          sortBy={sortBy}
          setSortBy={setSortBy}
          showAddForm={showAddForm}
          setShowAddForm={setShowAddForm}
          newBookmark={newBookmark}
          setNewBookmark={setNewBookmark}
          folderNames={getFolderNames()}
          onAddBookmark={handleAddBookmark}
          loading={loading}
        />

        <BookmarkGrid
          bookmarks={filteredBookmarks}
          onRemoveBookmark={handleRemoveBookmark}
          extensionAvailable={extensionAvailable}
          onSyncWithExtension={handleSyncWithExtension}
          loading={loading}
        />
      </div>
    </div>
  );
};

export default BookmarkManager;