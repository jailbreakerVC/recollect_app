import React, { useState } from 'react';
import { Bookmark, Folder, Calendar, ExternalLink, Search, Filter, Plus, AlertCircle, Download, Upload, RefreshCw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useExtensionBookmarks } from '../hooks/useExtensionBookmarks';

const BookmarkManager: React.FC = () => {
  const { user } = useAuth();
  const {
    bookmarks,
    loading,
    error,
    extensionAvailable,
    refreshBookmarks,
    addBookmark,
    removeBookmark
  } = useExtensionBookmarks();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'title' | 'folder'>('date');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newBookmark, setNewBookmark] = useState({ title: '', url: '' });

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
          return new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime();
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
      await addBookmark(newBookmark.title, newBookmark.url);
      setNewBookmark({ title: '', url: '' });
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
                <p className="text-gray-600">
                  {extensionAvailable ? 'Connected to Chrome Extension' : 'Chrome Extension Required'}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-500">
                {bookmarks.length} bookmarks found
              </div>
              {extensionAvailable && (
                <button
                  onClick={refreshBookmarks}
                  disabled={loading}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Extension Status */}
        <div className={`mb-8 rounded-lg p-6 ${extensionAvailable ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
          <div className="flex items-start">
            <AlertCircle className={`w-6 h-6 mt-0.5 mr-3 flex-shrink-0 ${extensionAvailable ? 'text-green-600' : 'text-amber-600'}`} />
            <div>
              <h3 className={`text-lg font-semibold mb-2 ${extensionAvailable ? 'text-green-800' : 'text-amber-800'}`}>
                {extensionAvailable ? 'Chrome Extension Connected' : 'Chrome Extension Required'}
              </h3>
              {extensionAvailable ? (
                <p className="text-green-700">
                  Successfully connected to the Bookmark Manager Chrome extension. You can now access your real Chrome bookmarks!
                </p>
              ) : (
                <div className="text-amber-700">
                  <p className="mb-3">
                    To access your real Chrome bookmarks, you need to install the Bookmark Manager Chrome extension.
                  </p>
                  <div className="text-sm">
                    <strong>Installation steps:</strong>
                    <ol className="list-decimal list-inside mt-1 space-y-1">
                      <li>Download the extension files from the public folder</li>
                      <li>Open Chrome and go to chrome://extensions/</li>
                      <li>Enable "Developer mode" in the top right</li>
                      <li>Click "Load unpacked" and select the extension folder</li>
                      <li>Refresh this page to connect</li>
                    </ol>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-8 bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex items-center">
              <AlertCircle className="w-6 h-6 text-red-600 mr-3" />
              <p className="text-red-700">{error}</p>
            </div>
          </div>
        )}

        {extensionAvailable && (
          <>
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  </div>
                  <div className="mt-4 flex space-x-3">
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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
                <p className="text-gray-500">
                  {searchTerm || selectedFolder !== 'all' 
                    ? 'Try adjusting your search or filter criteria'
                    : 'Your Chrome bookmarks will appear here'
                  }
                </p>
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
                        <Bookmark className="w-6 h-6 text-blue-600 mr-3 flex-shrink-0" />
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
                          <span>{formatDate(bookmark.dateAdded)}</span>
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
          </>
        )}
      </div>
    </div>
  );
};

export default BookmarkManager;