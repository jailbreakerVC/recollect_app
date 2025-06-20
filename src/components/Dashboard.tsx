import React, { useState } from 'react';
import { 
  BookmarkPlus, 
  Search, 
  Settings, 
  User, 
  LogOut, 
  Menu, 
  X, 
  Chrome,
  Database,
  TrendingUp,
  RefreshCw,
  Filter,
  Grid,
  List,
  Plus
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSupabaseBookmarks } from '../hooks/useSupabaseBookmarks';
import BookmarkCard from './BookmarkCard';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import StatsCards from './StatsCards';
import { ToastContainer, useToast } from './Toast';

const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();
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

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newBookmark, setNewBookmark] = useState({ title: '', url: '', folder: '' });

  // Filter bookmarks based on search and folder
  const filteredBookmarks = bookmarks.filter(bookmark => {
    const matchesSearch = bookmark.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         bookmark.url.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFolder = selectedFolder === 'all' || bookmark.folder === selectedFolder;
    return matchesSearch && matchesFolder;
  });

  const getFolderNames = () => {
    const folderNames = Array.from(new Set(bookmarks.map(b => b.folder).filter(Boolean)));
    return folderNames.sort();
  };

  const handleSync = async () => {
    if (extensionStatus !== 'available') {
      showError('Extension Not Available', 'Chrome extension is not installed or not responding.');
      return;
    }

    const loadingToastId = showLoading('Syncing Bookmarks', 'Synchronizing with Chrome...');

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
    }
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
      }
    }
  };

  return (
    <div className="min-h-screen bg-primary-dark text-text-primary">
      <ToastContainer toasts={toasts} onClose={removeToast} />
      
      {/* Sidebar */}
      <Sidebar 
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        user={user}
        onLogout={logout}
        extensionStatus={extensionStatus}
        lastSyncResult={lastSyncResult}
        onSync={handleSync}
        loading={loading}
      />

      {/* Main Content */}
      <div className={`transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-0'}`}>
        {/* Top Bar */}
        <TopBar 
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          user={user}
        />

        {/* Main Dashboard Content */}
        <main className="p-6 space-y-6">
          {/* Stats Cards */}
          <StatsCards 
            totalBookmarks={bookmarks.length}
            extensionStatus={extensionStatus}
            lastSyncResult={lastSyncResult}
            syncStatus={syncStatus}
          />

          {/* Controls Bar */}
          <div className="bg-secondary-dark rounded-xl p-4 border border-border">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex flex-col sm:flex-row gap-3">
                {/* Folder Filter */}
                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-secondary w-4 h-4" />
                  <select
                    value={selectedFolder}
                    onChange={(e) => setSelectedFolder(e.target.value)}
                    className="bg-primary-dark border border-border rounded-lg pl-10 pr-4 py-2 text-text-primary focus:ring-2 focus:ring-accent focus:border-transparent appearance-none min-w-[150px]"
                  >
                    <option value="all">All Folders</option>
                    {getFolderNames().map(folder => (
                      <option key={folder} value={folder}>{folder}</option>
                    ))}
                  </select>
                </div>

                {/* View Mode Toggle */}
                <div className="flex bg-primary-dark rounded-lg border border-border">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-2 rounded-l-lg transition-colors ${
                      viewMode === 'grid' 
                        ? 'bg-accent text-white' 
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    <Grid className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-2 rounded-r-lg transition-colors ${
                      viewMode === 'list' 
                        ? 'bg-accent text-white' 
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowAddForm(true)}
                  className="inline-flex items-center px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Bookmark
                </button>
                
                <button
                  onClick={refreshBookmarks}
                  disabled={loading}
                  className="inline-flex items-center px-4 py-2 bg-secondary-dark border border-border text-text-primary rounded-lg hover:bg-hover transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>
            </div>
          </div>

          {/* Add Bookmark Form */}
          {showAddForm && (
            <div className="bg-secondary-dark rounded-xl p-6 border border-border">
              <h3 className="text-lg font-semibold text-text-primary mb-4">Add New Bookmark</h3>
              <form onSubmit={handleAddBookmark} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">Title</label>
                    <input
                      type="text"
                      value={newBookmark.title}
                      onChange={(e) => setNewBookmark({ ...newBookmark, title: e.target.value })}
                      className="w-full px-3 py-2 bg-primary-dark border border-border rounded-lg text-text-primary focus:ring-2 focus:ring-accent focus:border-transparent"
                      placeholder="Bookmark title"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">URL</label>
                    <input
                      type="url"
                      value={newBookmark.url}
                      onChange={(e) => setNewBookmark({ ...newBookmark, url: e.target.value })}
                      className="w-full px-3 py-2 bg-primary-dark border border-border rounded-lg text-text-primary focus:ring-2 focus:ring-accent focus:border-transparent"
                      placeholder="https://example.com"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">Folder (Optional)</label>
                  <input
                    type="text"
                    value={newBookmark.folder}
                    onChange={(e) => setNewBookmark({ ...newBookmark, folder: e.target.value })}
                    className="w-full px-3 py-2 bg-primary-dark border border-border rounded-lg text-text-primary focus:ring-2 focus:ring-accent focus:border-transparent"
                    placeholder="Folder name"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-50"
                  >
                    Add Bookmark
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="px-4 py-2 bg-secondary-dark border border-border text-text-primary rounded-lg hover:bg-hover transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4">
              <div className="flex items-center">
                <div className="flex-1">
                  <p className="text-red-400 font-medium">Error</p>
                  <p className="text-red-300 text-sm mt-1">{error}</p>
                </div>
                <button
                  onClick={refreshBookmarks}
                  className="ml-4 inline-flex items-center px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Retry
                </button>
              </div>
            </div>
          )}

          {/* Bookmarks Grid/List */}
          {loading && bookmarks.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-accent/20 border-t-accent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-text-secondary">Loading your bookmarks...</p>
              </div>
            </div>
          ) : filteredBookmarks.length === 0 ? (
            <div className="text-center py-12">
              <BookmarkPlus className="w-16 h-16 text-text-secondary mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium text-text-primary mb-2">
                {searchTerm || selectedFolder !== 'all' ? 'No bookmarks match your filters' : 'No bookmarks found'}
              </h3>
              <p className="text-text-secondary mb-6">
                {searchTerm || selectedFolder !== 'all' 
                  ? 'Try adjusting your search or filter criteria'
                  : 'Add your first bookmark or sync with Chrome extension'
                }
              </p>
              {!searchTerm && selectedFolder === 'all' && (
                <div className="flex justify-center gap-3">
                  <button
                    onClick={() => setShowAddForm(true)}
                    className="inline-flex items-center px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Bookmark
                  </button>
                  {extensionStatus === 'available' && (
                    <button
                      onClick={handleSync}
                      disabled={loading}
                      className="inline-flex items-center px-4 py-2 bg-secondary-dark border border-border text-text-primary rounded-lg hover:bg-hover transition-colors disabled:opacity-50"
                    >
                      <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                      Sync Chrome
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className={
              viewMode === 'grid' 
                ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
                : 'space-y-3'
            }>
              {filteredBookmarks.map((bookmark) => (
                <BookmarkCard
                  key={bookmark.id}
                  bookmark={bookmark}
                  viewMode={viewMode}
                  onRemove={handleRemoveBookmark}
                />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Dashboard;