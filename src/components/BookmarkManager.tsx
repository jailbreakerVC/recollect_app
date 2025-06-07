import React, { useState, useEffect } from 'react';
import { Bookmark, Folder, Calendar, ExternalLink, Search, Filter, Plus, AlertCircle, RefreshCw, Database, Chrome, RotateCcw, CheckCircle, Clock, TrendingUp, Bug, TestTube, Wifi, Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSupabaseBookmarks } from '../hooks/useSupabaseBookmarks';
import { ExtensionService } from '../services/extensionService';
import { BookmarkService } from '../services/bookmarkService';
import { SemanticSearchService, SemanticSearchResult } from '../services/semanticSearchService';
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
  const [extensionStatus, setExtensionStatus] = useState<'checking' | 'available' | 'unavailable'>('checking');
  const [semanticSearchResults, setSemanticSearchResults] = useState<SemanticSearchResult[]>([]);
  const [useSemanticResults, setUseSemanticResults] = useState(false);

  // Initialize extension service
  useEffect(() => {
    ExtensionService.initialize();
    
    return () => {
      // Cleanup handled by service
    };
  }, []);

  // Enhanced extension availability detection
  useEffect(() => {
    let mounted = true;
    
    const checkExtensionStatus = async () => {
      setExtensionStatus('checking');
      
      try {
        // Force check extension availability
        const available = await ExtensionService.forceCheckAvailability();
        
        if (mounted) {
          setExtensionStatus(available ? 'available' : 'unavailable');
        }
      } catch (error) {
        console.error('❌ Extension status check failed:', error);
        if (mounted) {
          setExtensionStatus('unavailable');
        }
      }
    };

    // Check immediately
    checkExtensionStatus();

    // Set up periodic checks
    const interval = setInterval(checkExtensionStatus, 3000);

    // Listen for extension ready events
    const handleExtensionReady = () => {
      if (mounted) {
        setExtensionStatus('available');
      }
    };

    window.addEventListener('bookmarkExtensionReady', handleExtensionReady);

    return () => {
      mounted = false;
      clearInterval(interval);
      window.removeEventListener('bookmarkExtensionReady', handleExtensionReady);
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

  // Update embeddings when bookmarks change
  useEffect(() => {
    if (user && bookmarks.length > 0) {
      const updateEmbeddings = async () => {
        try {
          await SemanticSearchService.updateUserEmbeddings(user.id);
        } catch (error) {
          // Silent fail for embeddings
        }
      };

      // Update embeddings after a short delay to avoid blocking UI
      const timeoutId = setTimeout(updateEmbeddings, 2000);
      return () => clearTimeout(timeoutId);
    }
  }, [user, bookmarks.length]);

  const filteredBookmarks = useSemanticResults && semanticSearchResults.length > 0
    ? semanticSearchResults.map(result => {
        // Find the full bookmark data
        const fullBookmark = bookmarks.find(b => b.id === result.id);
        return fullBookmark ? {
          ...fullBookmark,
          _semanticScore: result.similarity_score,
          _searchType: result.search_type
        } : null;
      }).filter(Boolean)
    : bookmarks
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
    if (extensionStatus !== 'available') {
      showError('Extension Not Available', 'Chrome extension is not installed or not responding. Please install the extension and refresh the page.');
      return;
    }

    const loadingToastId = showLoading('Syncing Bookmarks', 'Initializing sync...');

    try {
      // Test extension connection first
      updateToast(loadingToastId, { 
        title: 'Syncing Bookmarks', 
        message: 'Testing extension connection...' 
      });

      let extensionBookmarks;
      try {
        extensionBookmarks = await ExtensionService.getBookmarks();
      } catch (extError) {
        console.error('❌ Extension connection failed:', extError);
        removeToast(loadingToastId);
        showError('Extension Error', `Failed to connect to Chrome extension: ${extError instanceof Error ? extError.message : 'Unknown error'}`);
        return;
      }

      // Test database connection
      updateToast(loadingToastId, { 
        title: 'Syncing Bookmarks', 
        message: 'Testing database connection...' 
      });

      try {
        const dbTest = await BookmarkService.testConnection(user!.id);
        if (!dbTest.success) {
          throw new Error(dbTest.message);
        }
      } catch (dbError) {
        console.error('❌ Database connection failed:', dbError);
        removeToast(loadingToastId);
        showError('Database Error', `Failed to connect to database: ${dbError instanceof Error ? dbError.message : 'Unknown error'}`);
        return;
      }

      // Now perform the actual sync
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

        // Update embeddings for new bookmarks
        if (result.inserted > 0) {
          try {
            await SemanticSearchService.updateUserEmbeddings(user!.id);
          } catch (embError) {
            // Silent fail for embeddings
          }
        }
      } else {
        showSuccess('Sync Complete', 'Your bookmarks are already up to date');
      }
    } catch (err) {
      removeToast(loadingToastId);
      const message = err instanceof Error ? err.message : 'Failed to sync with extension';
      console.error('❌ Sync failed with error:', err);
      showError('Sync Failed', message);
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

  // Debug sync button for development
  const handleDebugSync = async () => {
    // Check prerequisites
    if (!user) {
      showError('Debug Sync Failed', 'User not logged in');
      return;
    }
    
    if (extensionStatus !== 'available') {
      showError('Debug Sync Failed', `Chrome extension not available (status: ${extensionStatus})`);
      return;
    }

    const loadingToastId = showLoading('Debug Sync', 'Analyzing sync data...');
    
    try {
      // Test extension connection first
      const extTest = await ExtensionService.testConnection();
      
      if (!extTest.success) {
        removeToast(loadingToastId);
        showError('Extension Test Failed', extTest.message);
        return;
      }
      
      // Get extension bookmarks
      const extensionBookmarks = await ExtensionService.getBookmarks();
      
      // Get database bookmarks
      const databaseBookmarks = await BookmarkService.getBookmarks(user.id);
      
      // Get total database count
      const totalCount = await BookmarkService.getAllBookmarksCount();
      
      // Analyze differences
      const extIds = new Set(extensionBookmarks.map(b => b.id));
      const dbChromeIds = new Set(databaseBookmarks.map(b => b.chrome_bookmark_id).filter(Boolean));
      
      const newInExtension = extensionBookmarks.filter(b => !dbChromeIds.has(b.id));
      const removedFromExtension = databaseBookmarks.filter(b => b.chrome_bookmark_id && !extIds.has(b.chrome_bookmark_id));
      
      removeToast(loadingToastId);
      showSuccess('Debug Analysis Complete', `Extension: ${extensionBookmarks.length} bookmarks, Database: ${databaseBookmarks.length} bookmarks, New: ${newInExtension.length}, Removed: ${removedFromExtension.length}. Check console for details.`);
      
    } catch (err) {
      console.error('🐛 Debug sync failed:', err);
      removeToast(loadingToastId);
      showError('Debug Sync Failed', err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const handleSemanticSearchResult = (result: SemanticSearchResult) => {
    // Perform a semantic search to get related results
    if (user) {
      SemanticSearchService.searchBookmarks(result.title, {
        userId: user.id,
        maxResults: 20,
        similarityThreshold: 0.2
      }).then(results => {
        setSemanticSearchResults(results);
        setUseSemanticResults(true);
      }).catch(error => {
        console.error('❌ Semantic search failed:', error);
        setUseSemanticResults(false);
      });
    }
  };

  const handleTestSemanticSearch = async () => {
    if (!user) return;
    
    const loadingToastId = showLoading('Testing Semantic Search', 'Running semantic search test...');
    
    try {
      const result = await SemanticSearchService.testSemanticSearch(user.id);
      removeToast(loadingToastId);
      
      if (result.success) {
        showSuccess('Semantic Search Test', result.message);
      } else {
        showError('Semantic Search Test Failed', result.message);
      }
    } catch (err) {
      removeToast(loadingToastId);
      const message = err instanceof Error ? err.message : 'Semantic search test failed';
      showError('Semantic Search Test Error', message);
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
                  <div className="flex items-center">
                    <Chrome className="w-4 h-4 mr-1" />
                    <span>Chrome Extension</span>
                    <div className={`w-2 h-2 rounded-full ml-2 ${
                      extensionStatus === 'available' ? 'bg-green-500' :
                      extensionStatus === 'unavailable' ? 'bg-red-500' : 'bg-yellow-500'
                    }`} />
                    <span className="ml-1 text-xs">
                      {extensionStatus === 'checking' ? 'Checking...' :
                       extensionStatus === 'available' ? 'Connected' : 'Not Available'}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <Sparkles className="w-4 h-4 mr-1" />
                    <span>AI Search</span>
                    <div className="w-2 h-2 rounded-full ml-2 bg-purple-500" />
                  </div>
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
                {useSemanticResults ? `${filteredBookmarks.length} semantic results` : `${bookmarks.length} bookmarks`}
              </div>
              {process.env.NODE_ENV === 'development' && (
                <>
                  <button
                    onClick={handleTestConnection}
                    className="inline-flex items-center px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
                    title="Test database connection"
                  >
                    <TestTube className="w-4 h-4 mr-2" />
                    Test DB
                  </button>
                  <button
                    onClick={handleTestSemanticSearch}
                    className="inline-flex items-center px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
                    title="Test semantic search"
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    Test AI
                  </button>
                  <button
                    onClick={handleDebugSync}
                    className="inline-flex items-center px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm"
                    title="Debug sync analysis"
                  >
                    <Bug className="w-4 h-4 mr-2" />
                    Debug Sync
                  </button>
                </>
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
              {extensionStatus === 'available' && (
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
          extensionAvailable={extensionStatus === 'available'}
          lastSyncResult={lastSyncResult}
        />

        <DebugPanel 
          user={user}
          extensionAvailable={extensionStatus === 'available'}
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

        {/* Semantic Search Results Indicator */}
        {useSemanticResults && semanticSearchResults.length > 0 && (
          <div className="mb-6 bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Sparkles className="w-5 h-5 text-purple-600 mr-2" />
                <span className="text-purple-800 font-medium">
                  Showing {semanticSearchResults.length} AI-powered search results
                </span>
              </div>
              <button
                onClick={() => {
                  setUseSemanticResults(false);
                  setSemanticSearchResults([]);
                  setSearchTerm('');
                }}
                className="text-purple-600 hover:text-purple-800 text-sm"
              >
                Clear search
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
          onSemanticSearchResult={handleSemanticSearchResult}
        />

        <BookmarkGrid
          bookmarks={filteredBookmarks}
          onRemoveBookmark={handleRemoveBookmark}
          extensionAvailable={extensionStatus === 'available'}
          onSyncWithExtension={handleSyncWithExtension}
          loading={loading}
        />
      </div>
    </div>
  );
};

export default BookmarkManager;