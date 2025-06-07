import React, { useState, useEffect } from 'react';
import { Bookmark, Folder, Calendar, ExternalLink, Search, Filter, Plus, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface BookmarkItem {
  id: string;
  title: string;
  url: string;
  dateAdded: string;
  folder?: string;
  description?: string;
  favicon?: string;
}

interface BookmarkFolder {
  name: string;
  bookmarks: BookmarkItem[];
  subfolders?: BookmarkFolder[];
}

const BookmarkManager: React.FC = () => {
  const { user } = useAuth();
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [folders, setFolders] = useState<BookmarkFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'title' | 'folder'>('date');

  // Mock data to demonstrate functionality
  const mockBookmarks: BookmarkItem[] = [
    {
      id: '1',
      title: 'React Documentation',
      url: 'https://react.dev',
      dateAdded: '2024-01-15T10:30:00Z',
      folder: 'Development',
      description: 'Official React documentation and guides',
      favicon: 'https://react.dev/favicon.ico'
    },
    {
      id: '2',
      title: 'Tailwind CSS',
      url: 'https://tailwindcss.com',
      dateAdded: '2024-01-14T15:45:00Z',
      folder: 'Development',
      description: 'Utility-first CSS framework',
      favicon: 'https://tailwindcss.com/favicon.ico'
    },
    {
      id: '3',
      title: 'Google Cloud Console',
      url: 'https://console.cloud.google.com',
      dateAdded: '2024-01-13T09:20:00Z',
      folder: 'Work',
      description: 'Google Cloud Platform management console',
      favicon: 'https://console.cloud.google.com/favicon.ico'
    },
    {
      id: '4',
      title: 'GitHub',
      url: 'https://github.com',
      dateAdded: '2024-01-12T14:15:00Z',
      folder: 'Development',
      description: 'Code hosting and collaboration platform',
      favicon: 'https://github.com/favicon.ico'
    },
    {
      id: '5',
      title: 'MDN Web Docs',
      url: 'https://developer.mozilla.org',
      dateAdded: '2024-01-11T11:30:00Z',
      folder: 'Development',
      description: 'Web development documentation',
      favicon: 'https://developer.mozilla.org/favicon.ico'
    },
    {
      id: '6',
      title: 'Stack Overflow',
      url: 'https://stackoverflow.com',
      dateAdded: '2024-01-10T16:45:00Z',
      folder: 'Development',
      description: 'Programming Q&A community',
      favicon: 'https://stackoverflow.com/favicon.ico'
    },
    {
      id: '7',
      title: 'YouTube',
      url: 'https://youtube.com',
      dateAdded: '2024-01-09T20:30:00Z',
      folder: 'Entertainment',
      description: 'Video sharing platform',
      favicon: 'https://youtube.com/favicon.ico'
    },
    {
      id: '8',
      title: 'Netflix',
      url: 'https://netflix.com',
      dateAdded: '2024-01-08T19:15:00Z',
      folder: 'Entertainment',
      description: 'Streaming service',
      favicon: 'https://netflix.com/favicon.ico'
    }
  ];

  useEffect(() => {
    const loadBookmarks = async () => {
      setLoading(true);
      setError(null);

      try {
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // In a real implementation, this would be an API call to Google's services
        // However, Google doesn't provide bookmark access through their public APIs
        setBookmarks(mockBookmarks);
        
        // Organize bookmarks into folders
        const folderMap = new Map<string, BookmarkItem[]>();
        mockBookmarks.forEach(bookmark => {
          const folderName = bookmark.folder || 'Uncategorized';
          if (!folderMap.has(folderName)) {
            folderMap.set(folderName, []);
          }
          folderMap.get(folderName)!.push(bookmark);
        });

        const organizedFolders: BookmarkFolder[] = Array.from(folderMap.entries()).map(([name, bookmarks]) => ({
          name,
          bookmarks: bookmarks.sort((a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime())
        }));

        setFolders(organizedFolders);
      } catch (err) {
        setError('Failed to load bookmarks. Please try again.');
        console.error('Bookmark loading error:', err);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      loadBookmarks();
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

  if (loading) {
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
                <p className="text-gray-600">Organize and access your saved bookmarks</p>
              </div>
            </div>
            <div className="text-sm text-gray-500">
              {bookmarks.length} bookmarks found
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* API Limitation Notice */}
        <div className="mb-8 bg-amber-50 border border-amber-200 rounded-lg p-6">
          <div className="flex items-start">
            <AlertCircle className="w-6 h-6 text-amber-600 mt-0.5 mr-3 flex-shrink-0" />
            <div>
              <h3 className="text-lg font-semibold text-amber-800 mb-2">Important Note</h3>
              <p className="text-amber-700 mb-3">
                Google does not provide a public API for accessing Chrome bookmarks through OAuth 2.0. 
                This demo shows how bookmark management would work with mock data.
              </p>
              <div className="text-sm text-amber-600">
                <strong>Alternative approaches:</strong>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li>Chrome Extension API (requires browser extension)</li>
                  <li>Manual bookmark export/import (HTML files)</li>
                  <li>Third-party bookmark sync services</li>
                  <li>Custom bookmark storage system</li>
                </ul>
              </div>
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

        {/* Search and Filter Controls */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
          </div>
        </div>

        {/* Bookmarks Grid */}
        {filteredBookmarks.length === 0 ? (
          <div className="text-center py-12">
            <Bookmark className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No bookmarks found</h3>
            <p className="text-gray-500">
              {searchTerm || selectedFolder !== 'all' 
                ? 'Try adjusting your search or filter criteria'
                : 'Start adding bookmarks to see them here'
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
                  <div className="flex items-center">
                    {bookmark.favicon ? (
                      <img
                        src={bookmark.favicon}
                        alt=""
                        className="w-6 h-6 mr-3"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <Bookmark className="w-6 h-6 text-blue-600 mr-3" />
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-gray-900 truncate">
                        {bookmark.title}
                      </h3>
                    </div>
                  </div>
                  <a
                    href={bookmark.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    <ExternalLink className="w-5 h-5" />
                  </a>
                </div>

                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-600 break-all">{bookmark.url}</p>
                  </div>

                  {bookmark.description && (
                    <div>
                      <p className="text-sm text-gray-700">{bookmark.description}</p>
                    </div>
                  )}

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

        {/* Folder Organization View */}
        {selectedFolder === 'all' && folders.length > 0 && (
          <div className="mt-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Organized by Folders</h2>
            <div className="space-y-8">
              {folders.map((folder) => (
                <div key={folder.name} className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
                  <div className="flex items-center mb-4">
                    <Folder className="w-6 h-6 text-indigo-600 mr-3" />
                    <h3 className="text-xl font-semibold text-gray-900">{folder.name}</h3>
                    <span className="ml-3 bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full text-sm">
                      {folder.bookmarks.length} bookmarks
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {folder.bookmarks.slice(0, 4).map((bookmark) => (
                      <div key={bookmark.id} className="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                        <Bookmark className="w-4 h-4 text-blue-600 mr-3 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{bookmark.title}</p>
                          <p className="text-xs text-gray-500 truncate">{bookmark.url}</p>
                        </div>
                        <a
                          href={bookmark.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 transition-colors ml-2"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    ))}
                  </div>
                  
                  {folder.bookmarks.length > 4 && (
                    <div className="mt-4 text-center">
                      <button
                        onClick={() => setSelectedFolder(folder.name)}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        View all {folder.bookmarks.length} bookmarks in {folder.name}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BookmarkManager;