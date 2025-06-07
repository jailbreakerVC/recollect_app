import React from 'react';
import { Bookmark, Folder, Calendar, ExternalLink, Chrome, RefreshCw } from 'lucide-react';
import { DatabaseBookmark } from '../lib/supabase';

interface BookmarkGridProps {
  bookmarks: DatabaseBookmark[];
  onRemoveBookmark: (id: string) => void;
  extensionAvailable: boolean;
  onSyncWithExtension: () => void;
  loading: boolean;
}

export const BookmarkGrid: React.FC<BookmarkGridProps> = ({
  bookmarks,
  onRemoveBookmark,
  extensionAvailable,
  onSyncWithExtension,
  loading
}) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (bookmarks.length === 0) {
    return (
      <div className="text-center py-12">
        <Bookmark className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No bookmarks found</h3>
        <p className="text-gray-500 mb-4">
          Add your first bookmark or sync with Chrome extension
        </p>
        {extensionAvailable && (
          <button
            onClick={onSyncWithExtension}
            disabled={loading}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Sync Chrome Bookmarks
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {bookmarks.map((bookmark) => (
        <div
          key={bookmark.id}
          className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-all duration-300 hover:transform hover:-translate-y-1"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center flex-1 min-w-0">
              <div className="flex items-center mr-3">
                <Bookmark className="w-6 h-6 text-blue-600" />
                {bookmark.chrome_bookmark_id && (
                  <Chrome className="w-4 h-4 text-gray-400 ml-1" title="Synced with Chrome" />
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
                onClick={() => onRemoveBookmark(bookmark.id)}
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
  );
};