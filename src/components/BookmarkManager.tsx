import React, { useState, useEffect } from 'react';
import { Bookmark, RefreshCw, Chrome, TestTube, Bug, Search } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSupabaseBookmarks } from '../hooks/useSupabaseBookmarks';
import { extensionService } from '../services/extensionService';
import { BookmarkService } from '../services/bookmarkService';
import { ToastContainer, useToast } from './Toast';
import { BookmarkGrid } from './BookmarkGrid';
import { BookmarkControls } from './BookmarkControls';
import { StatusCards } from './StatusCards';
import { DebugPanel } from './DebugPanel';
import { ConnectionStatus, SortOption } from '../types';
import { Logger } from '../utils/logger';

const BookmarkManager: React.FC = () => {
  const { user } = useAuth();
  const {
    bookmarks,
    loading,
    error,
    extensionAvailable,
    extensionStatus,
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
  const [sortBy, setSortBy] = useState<SortOption>('date');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newBookmark, setNewBookmark] = useState({ title: '', url: '', folder: '' });
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('unknown');

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
          Logger.error('BookmarkManager', 'Failed to get debug info', err);
          setDebugInfo({ error: 'Failed to get debug info' });
        }
      };
      
      debugContext();
    }
  }, [user]);

  // Set up extension message listener for context search
  useEffect(() => {
    const handleExtensionMessage = (event: MessageEvent) => {
      if (event.data.source === 'bookmark-manager-extension') {
        switch (event.data.action) {
          case 'searchByKeyword':
            handleKeywordSearchRequest(event.data.keyword, event.data.requestId);
            break;
          case 'searchByPageContext':
            handlePageContextSearchRequest(event.data.context, event.data.requestId);
            break;
        }
      }
    };

    window.addEventListener('message', handleExtensionMessage);
    return () => window.removeEventListener('message', handleExtensionMessage);
  }, [user, bookmarks]);

  const handleKeywordSearchRequest = async (keyword: string, requestId: string) => {
    if (!user) {
      sendSearchResponse(requestId, false, 'User not logged in', []);
      return;
    }

    try {
      Logger.info('BookmarkManager', 'Handling keyword search request', { keyword });
      
      const results = await searchBookmarksByKeyword(keyword);
      sendSearchResponse(requestId, true, 'Search completed', results);
      
      Logger.info('BookmarkManager', `Sent ${results.length} search results for keyword: ${keyword}`);
    } catch (error) {
      Logger.error('BookmarkManager', 'Keyword search failed', error);
      sendSearchResponse(requestId, false, error instanceof Error ? error.message : 'Search failed', []);
    }
  };

  const handlePageContextSearchRequest = async (context: any, requestId: string) => {
    if (!user) {
      sendSearchResponse(requestId, false, 'User not logged in', []);
      return;
    }

    try {
      Logger.info('BookmarkManager', 'Handling page context search request', context);
      
      const results = await searchBookmarksByPageContext(context);
      sendSearchResponse(requestId, true, 'Context search completed', results);
      
      Logger.info('BookmarkManager', `Sent ${results.length} contextual search results for page: ${context.title}`);
    } catch (error) {
      Logger.error('BookmarkManager', 'Page context search failed', error);
      sendSearchResponse(requestId, false, error instanceof Error ? error.message : 'Search failed', []);
    }
  };

  const sendSearchResponse = (requestId: string, success: boolean, message: string, results: any[]) => {
    window.postMessage({
      source: 'bookmark-manager-webapp',
      action: 'searchResults',
      requestId,
      success,
      message,
      results
    }, window.location.origin);
  };

  const searchBookmarksByKeyword = async (keyword: string) => {
    const searchTerm = keyword.toLowerCase().trim();
    
    return bookmarks
      .filter(bookmark => 
        bookmark.title.toLowerCase().includes(searchTerm) ||
        bookmark.url.toLowerCase().includes(searchTerm) ||
        (bookmark.folder && bookmark.folder.toLowerCase().includes(searchTerm))
      )
      .slice(0, 10) // Limit to 10 results for extension display
      .map(bookmark => ({
        id: bookmark.id,
        title: bookmark.title,
        url: bookmark.url,
        folder: bookmark.folder,
        date_added: bookmark.date_added,
        similarity_score: calculateKeywordSimilarity(bookmark, searchTerm),
        search_type: 'keyword'
      }));
  };

  const searchBookmarksByPageContext = async (context: any) => {
    const { title, url, domain, keywords = [] } = context;
    
    // Extract search terms from page context
    const searchTerms = [
      ...title.toLowerCase().split(/\s+/).filter((word: string) => word.length > 3),
      ...keywords.map((k: string) => k.toLowerCase()),
      domain.replace(/\./g, ' ')
    ].filter(Boolean);

    // Score bookmarks based on context relevance
    const scoredBookmarks = bookmarks
      .map(bookmark => {
        const score = calculateContextSimilarity(bookmark, searchTerms, domain);
        return { ...bookmark, similarity_score: score, search_type: 'context' };
      })
      .filter(bookmark => 
        bookmark.similarity_score > 0.1 && // Minimum relevance threshold
        !bookmark.url.includes(domain) // Exclude current domain
      )
      .sort((a, b) => b.similarity_score - a.similarity_score)
      .slice(0, 8); // Limit to 8 results for extension display

    return scoredBookmarks.map(bookmark => ({
      id: bookmark.id,
      title: bookmark.title,
      url: bookmark.url,
      folder: bookmark.folder,
      date_added: bookmark.date_added,
      similarity_score: bookmark.similarity_score,
      search_type: bookmark.search_type
    }));
  };

  const calculateKeywordSimilarity = (bookmark: any, searchTerm: string): number => {
    let score = 0;
    
    // Title match (highest weight)
    if (bookmark.title.toLowerCase().includes(searchTerm)) {
      score += 0.8;
    }
    
    // URL match
    if (bookmark.url.toLowerCase().includes(searchTerm)) {
      score += 0.6;
    }
    
    // Folder match
    if (bookmark.folder && bookmark.folder.toLowerCase().includes(searchTerm)) {
      score += 0.4;
    }
    
    return Math.min(score, 1.0);
  };

  const calculateContextSimilarity = (bookmark: any, searchTerms: string[], domain: string): number => {
    let score = 0;
    const bookmarkText = `${bookmark.title} ${bookmark.url} ${bookmark.folder || ''}`.toLowerCase();
    
    // Check for term matches
    const matchingTerms = searchTerms.filter(term => bookmarkText.includes(term));
    score += (matchingTerms.length / searchTerms.length) * 0.7;
    
    // Domain similarity bonus
    const bookmarkDomain = extractDomain(bookmark.url);
    if (bookmarkDomain && bookmarkDomain.includes(domain.split('.')[0])) {
      score += 0.3;
    }
    
    // Technology/category matching
    const techKeywords = ['github', 'docs', 'api', 'tutorial', 'guide', 'documentation'];
    const hasTechMatch = techKeywords.some(tech => 
      bookmarkText.includes(tech) && searchTerms.some(term => term.includes(tech))
    );
    if (hasTechMatch) {
      score += 0.2;
    }
    
    return Math.min(score, 1.0);
  };

  const extractDomain = (url: string): string => {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  };

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
      Logger.error('BookmarkManager', 'Failed to add bookmark', err);
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
        Logger.error('BookmarkManager', 'Failed to remove bookmark', err);
      }
    }
  };

  const handleSyncWithExtension = async () => {
    Logger.info('BookmarkManager', 'Starting manual sync process');

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

      const extTest = await extensionService.testConnection();
      if (!extTest.success) {
        removeToast(loadingToastId);
        showError('Extension Error', `Failed to connect to Chrome extension: ${extTest.message}`);
        return;
      }

      // Test database connection
      updateToast(loadingToastId, { 
        title: 'Syncing Bookmarks', 
        message: 'Testing database connection...' 
      });

      const dbTest = await BookmarkService.testConnection(user!.id);
      if (!dbTest.success) {
        removeToast(loadingToastId);
        showError('Database Error', `Failed to connect to database: ${dbTest.message}`);
        return;
      }

      // Perform the actual sync
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
      Logger.error('BookmarkManager', 'Sync failed', err);
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
      Logger.error('BookmarkManager', 'Failed to refresh bookmarks', err);
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

  const handleDebugSync = async () => {
    Logger.info('BookmarkManager', 'Starting debug sync analysis');
    
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
      const extTest = await extensionService.testConnection();
      if (!extTest.success) {
        removeToast(loadingToastId);
        showError('Extension Test Failed', extTest.message);
        return;
      }
      
      const extensionBookmarks = await extensionService.getBookmarks();
      const databaseBookmarks = await BookmarkService.getBookmarks(user.id);
      const totalCount = await BookmarkService.getAllBookmarksCount();
      
      const extIds = new Set(extensionBookmarks.map(b => b.id));
      const dbChromeIds = new Set(databaseBookmarks.map(b => b.chrome_bookmark_id).filter(Boolean));
      
      const newInExtension = extensionBookmarks.filter(b => !dbChromeIds.has(b.id));
      const removedFromExtension = databaseBookmarks.filter(b => b.chrome_bookmark_id && !extIds.has(b.chrome_bookmark_id));
      
      removeToast(loadingToastId);
      showSuccess('Debug Analysis Complete', `Extension: ${extensionBookmarks.length} bookmarks, Database: ${databaseBookmarks.length} bookmarks, New: ${newInExtension.length}, Removed: ${removedFromExtension.length}. Check console for details.`);
      
    } catch (err) {
      removeToast(loadingToastId);
      showError('Debug Sync Failed', err instanceof Error ? err.message : 'Unknown error');
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
                    <span>Database</span>
                    <div className={`w-2 h-2 rounded-full ml-2 ${
                      connectionStatus === 'connected' ? 'bg-green-500' :
                      connectionStatus === 'disconnected' ? 'bg-red-500' : 'bg-yellow-500'
                    }`} />
                  </div>
                  <div className="flex items-center">
                    <Chrome className="w-4 h-4 mr-1" />
                    <span>Extension</span>
                    <div className={`w-2 h-2 rounded-full ml-2 ${
                      extensionStatus === 'available' ? 'bg-green-500' :
                      extensionStatus === 'unavailable' ? 'bg-red-500' : 'bg-yellow-500'
                    }`} />
                    <span className="ml-1 text-xs">
                      {extensionStatus === 'checking' ? 'Checking...' :
                       extensionStatus === 'available' ? 'Connected' : 'Not Available'}
                    </span>
                  </div>
                  {syncStatus && (
                    <div className="flex items-center text-blue-600">
                      <RefreshCw className="w-4 h-4 mr-1" />
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

        {/* Context Search Feature Info */}
        {extensionStatus === 'available' && bookmarks.length > 0 && (
          <div className="mb-8 bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-xl p-6">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <div className="bg-green-100 p-3 rounded-lg">
                  <Search className="w-6 h-6 text-green-600" />
                </div>
              </div>
              <div className="ml-4 flex-1">
                <h3 className="text-lg font-semibold text-green-900 mb-2">
                  🎯 Smart Context Search Active
                </h3>
                <p className="text-green-800 mb-4">
                  Your Chrome extension now provides intelligent bookmark search! Right-click any text to search your bookmarks, 
                  and get automatic suggestions based on the pages you visit.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="bg-white bg-opacity-50 p-3 rounded-lg">
                    <h4 className="font-semibold text-green-900 mb-1">📝 Context Menu Search</h4>
                    <p className="text-green-700">Select any text on a webpage, right-click, and choose "Search Bookmarks" to find related bookmarks instantly.</p>
                  </div>
                  <div className="bg-white bg-opacity-50 p-3 rounded-lg">
                    <h4 className="font-semibold text-green-900 mb-1">🤖 Auto Page Analysis</h4>
                    <p className="text-green-700">The extension automatically analyzes pages you visit and suggests relevant bookmarks from your collection.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

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
                <RefreshCw className="w-3 h-3 mr-1" />
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
          extensionAvailable={extensionStatus === 'available'}
          onSyncWithExtension={handleSyncWithExtension}
          loading={loading}
        />
      </div>
    </div>
  );
};

export default BookmarkManager;