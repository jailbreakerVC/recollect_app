import React from 'react';
import { Search, Filter, Plus, Sparkles } from 'lucide-react';
import SemanticSearch from './SemanticSearch';
import { SemanticSearchResult } from '../services/semanticSearchService';

interface BookmarkControlsProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  selectedFolder: string;
  setSelectedFolder: (folder: string) => void;
  sortBy: 'date' | 'title' | 'folder';
  setSortBy: (sort: 'date' | 'title' | 'folder') => void;
  showAddForm: boolean;
  setShowAddForm: (show: boolean) => void;
  newBookmark: { title: string; url: string; folder: string };
  setNewBookmark: (bookmark: { title: string; url: string; folder: string }) => void;
  folderNames: string[];
  onAddBookmark: (e: React.FormEvent) => void;
  loading: boolean;
  onSemanticSearchResult?: (result: SemanticSearchResult) => void;
}

export const BookmarkControls: React.FC<BookmarkControlsProps> = ({
  searchTerm,
  setSearchTerm,
  selectedFolder,
  setSelectedFolder,
  sortBy,
  setSortBy,
  showAddForm,
  setShowAddForm,
  newBookmark,
  setNewBookmark,
  folderNames,
  onAddBookmark,
  loading,
  onSemanticSearchResult
}) => {
  const [useSemanticSearch, setUseSemanticSearch] = React.useState(true);

  const handleSemanticResult = (result: SemanticSearchResult) => {
    // Set the search term to the selected result's title for filtering
    setSearchTerm(result.title);
    
    // Notify parent component if callback provided
    if (onSemanticSearchResult) {
      onSemanticSearchResult(result);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 mb-8">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Search - with semantic search toggle */}
        <div className="relative">
          <div className="flex items-center space-x-2 mb-2">
            <button
              onClick={() => setUseSemanticSearch(!useSemanticSearch)}
              className={`flex items-center px-2 py-1 text-xs rounded-full transition-colors ${
                useSemanticSearch 
                  ? 'bg-purple-100 text-purple-700 hover:bg-purple-200' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              title={useSemanticSearch ? 'Using AI-powered semantic search' : 'Using basic text search'}
            >
              {useSemanticSearch ? (
                <>
                  <Sparkles className="w-3 h-3 mr-1" />
                  Smart Search
                </>
              ) : (
                <>
                  <Search className="w-3 h-3 mr-1" />
                  Basic Search
                </>
              )}
            </button>
          </div>
          
          {useSemanticSearch ? (
            <SemanticSearch
              onResultSelect={handleSemanticResult}
              placeholder="Search bookmarks intelligently..."
              className="w-full"
            />
          ) : (
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
          )}
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
            {folderNames.map(folder => (
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

      {/* Search Mode Indicator */}
      {useSemanticSearch && (
        <div className="mt-3 flex items-center text-sm text-purple-600 bg-purple-50 px-3 py-2 rounded-lg">
          <Sparkles className="w-4 h-4 mr-2" />
          <span>
            AI-powered semantic search is active. Find bookmarks by meaning, not just exact words.
          </span>
        </div>
      )}

      {/* Add Bookmark Form */}
      {showAddForm && (
        <form onSubmit={onAddBookmark} className="mt-6 p-4 bg-gray-50 rounded-lg">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
              <input
                type="text"
                value={newBookmark.title}
                onChange={(e) => setNewBookmark({ ...newBookmark, title: e.target.value })}
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
                onChange={(e) => setNewBookmark({ ...newBookmark, url: e.target.value })}
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
                onChange={(e) => setNewBookmark({ ...newBookmark, folder: e.target.value })}
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
  );
};