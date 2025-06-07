import React, { useState, useEffect } from 'react';
import { Bookmark, Folder, Calendar, ExternalLink, Search, Filter, Plus, AlertCircle, RefreshCw, Database, Chrome, RotateCcw, CheckCircle, Clock, TrendingUp } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSupabaseBookmarks } from '../hooks/useSupabaseBookmarks';

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

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'title' | 'folder'>('date');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newBookmark, setNewBookmark] = useState({ title: '', url: '', folder: '' });

  // Set up connection test response handler
  useEffect(() => {
    const handleConnectionTest = (event: MessageEvent) => {
      if (event.data.source === 'bookmark-manager-extension' && 
          event.data.event === 'connectionTest') {
        console.log('🔍 BookmarkManager received connection test from extension');
        // Respond to connection test
        window.postMessage({
          source: 'bookmark-manager-webapp',
          type: 'connectionTestResponse',
          data: { timestamp: Date.now(), responsive: true }
        }, window.location.origin);
      }
    };

    window.addEventListener('message', handleConnectionTest);
    
    return () => {
      window.removeEventListener('message', handleConnectionTest);
    };
  }, []);

  // Set up sync completion notification
  useEffect(() => {
    // Make sync completion function globally available
    (window as any).notifyExtensionSyncComplete = function(data: any) {
      console.log('📤 Notifying extension of sync completion:', data);
      window.postMessage({
        source: 'bookmark-manager-webapp',
        type: 'syncComplete',
        data: data
      }, window.location.origin);
    };

    return () => {
      delete (window as any).notifyExtensionSyncComplete;
    };
  }, []);

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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getFolderNames = () => {
    const folderNames = Array.from(new Set(bookmarks.map(b => b.folder).filter(Boolean)));
    return folderNames.sort();
  };

  const handleAddBookmark = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBookmark.title || !newBookmark.url) return;

    try {
      await addBookmark(
        newBookmark.title, 
        newBookmark.url, 
        newBookmark.folder || undefined
      );
      setNewBookmark({ title: '', url: '', folder: '' });
      setShowAddForm(false);
    } catch (err) {
      console.error('Failed to add bookmark:', err);
    }
  };

  const handleRemoveBookmark = async (id: string) => {
    if (window.confirm('Are you sure you want to remove this bookmark?')) {
      try {
        await removeBookmark(id);
      } catch (err) {
        console.error('Failed to remove bookmark:', err);
      }
    }
  };

  const handleSyncWithExtension = async () => {
    try {
      await syncWithExtension();
    } catch (err) {
      console.error('Failed to sync with extension:', err);
    }
  };

  const handleRefresh = async () => {
    try {
      await refreshBookmarks();
    } catch (err) {
      console.error('Failed to refresh bookmarks:', err);
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
        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* Database Status */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <div className="flex items-start">
              <Database className="w-6 h-6 mt-0.5 mr-3 flex-shrink-0 text-blue-600" />
              <div>
                <h3 className="text-lg font-semibold mb-2 text-blue-800">
                  Database Connected
                </h3>
                <p className="text-blue-700">
                  Your bookmarks are stored securely in Supabase. Use the refresh button to reload data or sync with Chrome extension.
                </p>
              </div>
            </div>
          </div>

          {/* Extension Status */}
          <div className={`rounded-lg p-6 ${extensionAvailable ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
            <div className="flex items-start">
              <Chrome className={`w-6 h-6 mt-0.5 mr-3 flex-shrink-0 ${extensionAvailable ? 'text-green-600' : 'text-amber-600'}`} />
              <div>
                <h3 className={`text-lg font-semibold mb-2 ${extensionAvailable ? 'text-green-800' : 'text-amber-800'}`}>
                  {extensionAvailable ? 'Chrome Extension Active' : 'Chrome Extension Optional'}
                </h3>
                <p className={extensionAvailable ? 'text-green-700' : 'text-amber-700'}>
                  {extensionAvailable 
                    ? 'Chrome extension is connected. Use the sync button to import your Chrome bookmarks.'
                    : 'Install the Chrome extension to sync your browser bookmarks with the database.'
                  }
                </p>
              </div>
            </div>
          </div>

          {/* Sync Status */}
          {lastSyncResult && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
              <div className="flex items-start">
                <TrendingUp className="w-6 h-6 mt-0.5 mr-3 flex-shrink-0 text-purple-600" />
                <div>
                  <h3 className="text-lg font-semibold mb-2 text-purple-800">
                    Last Sync Results
                  </h3>
                  <div className="text-purple-700 space-y-1">
                    <div className="flex justify-between">
                      <span>Added:</span>
                      <span className="font-medium">{lastSyncResult.inserted}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Updated:</span>
                      <span className="font-medium">{lastSyncResult.updated}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Removed:</span>
                      <span className="font-medium">{lastSyncResult.removed}</span>
                    </div>
                    <div className="flex justify-between border-t border-purple-200 pt-1">
                      <span>Total:</span>
                      <span className="font-medium">{lastSyncResult.total}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Debug Information */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mb-8 bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 mb-2">Debug Information</h4>
            <div className="text-sm text-gray-600 space-y-1">
              <div>Supabase URL: {import.meta.env.VITE_SUPABASE_URL ? '✅ Set' : '❌ Missing'}</div>
              <div>Supabase Key: {import.meta.env.VITE_SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing'}</div>
              <div>User ID: {user?.id || 'Not logged in'}</div>
              <div>Extension Available: {extensionAvailable ? 'Yes' : 'No'}</div>
              <div>Extension Flag: {(window as any).bookmarkExtensionAvailable ? 'Set' : 'Not Set'}</div>
              <div>Bookmarks Count: {bookmarks.length}</div>
              <div>Loading: {loading ? 'Yes' : 'No'}</div>
              <div>Error: {error || 'None'}</div>
              <div>Sync Status: {syncStatus || 'None'}</div>
            </div>
          </div>
        )}

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

        {/* Controls */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search bookmarks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Folder Filter */}
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <select
                value={selectedFolder}
                onChange={(e) => setSelectedFolder(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
              >
                <option value="all">All Folders</option>
                {getFolderNames().map(folder => (
                  <option key={folder} value={folder}>{folder}</option>
                ))}
              </select>
            </div>

            {/* Sort */}
            <div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'date' | 'title' | 'folder')}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="date">Sort by Date Added</option>
                <option value="title">Sort by Title</option>
                <option value="folder">Sort by Folder</option>
              </select>
            </div>

            {/* Add Bookmark */}
            <div>
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center"
              >
                <Plus className="w-5 h-5 mr-2" />
                Add Bookmark
              </button>
            </div>
          </div>

          {/* Add Bookmark Form */}
          {showAddForm && (
            <form onSubmit={handleAddBookmark} className="mt-6 p-4 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
                  <input
                    type="text"
                    value={newBookmark.title}
                    onChange={(e) => setNewBookmark(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Bookmark title"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">URL</label>
                  <input
                    type="url"
                    value={newBookmark.url}
                    onChange={(e) => setNewBookmark(prev => ({ ...prev, url: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="https://example.com"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Folder (Optional)</label>
                  <input
                    type="text"
                    value={newBookmark.folder}
                    onChange={(e) => setNewBookmark(prev => ({ ...prev, folder: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Folder name"
                  />
                </div>
              </div>
              <div className="mt-4 flex space-x-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  Add Bookmark
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Bookmarks Grid */}
        {filteredBookmarks.length === 0 ? (
          <div className="text-center py-12">
            <Bookmark className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No bookmarks found</h3>
            <p className="text-gray-500 mb-4">
              {searchTerm || selectedFolder !== 'all' 
                ? 'Try adjusting your search or filter criteria'
                : 'Add your first bookmark or sync with Chrome extension'
              }
            </p>
            {extensionAvailable && (
              <button
                onClick={handleSyncWithExtension}
                disabled={loading}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Sync Chrome Bookmarks
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredBookmarks.map((bookmark) => (
              <div
                key={bookmark.id}
                className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-all duration-300 hover:transform hover:-translate-y-1"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center flex-1 min-w-0">
                    <div className="flex items-center mr-3">
                      <Bookmark className="w-6 h-6 text-blue-600" />
                      {bookmark.chrome_bookmark_id && (
                        <Chrome className="w-4 h-4 text-gray-400 ml-1\" title="Synced with Chrome" />
                      )}
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 truncate">
                      {bookmark.title}
                    </h3>
                  </div>
                  <div className="flex items-center space-x-2 ml-2">
                    <a
                      href={bookmark.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 transition-colors"
                    >
                      <ExternalLink className="w-5 h-5" />
                    </a>
                    <button
                      onClick={() => handleRemoveBookmark(bookmark.id)}
                      className="text-red-600 hover:text-red-800 transition-colors"
                    >
                      ×
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-600 break-all">{bookmark.url}</p>
                  </div>

                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 mr-1" />
                      <span>{formatDate(bookmark.date_added)}</span>
                    </div>
                    
                    {bookmark.folder && (
                      <div className="flex items-center">
                        <Folder className="w-4 h-4 mr-1" />
                        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">
                          {bookmark.folder}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default BookmarkManager;