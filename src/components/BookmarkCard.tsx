import React from 'react';
import { ExternalLink, Folder, Calendar, Chrome, Trash2 } from 'lucide-react';
import { DatabaseBookmark } from '../types';

interface BookmarkCardProps {
  bookmark: DatabaseBookmark;
  viewMode: 'grid' | 'list';
  onRemove: (id: string) => void;
}

const BookmarkCard: React.FC<BookmarkCardProps> = ({ bookmark, viewMode, onRemove }) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getDomainFromUrl = (url: string) => {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  };

  const getFaviconUrl = (url: string) => {
    try {
      const domain = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
    } catch {
      return null;
    }
  };

  if (viewMode === 'list') {
    return (
      <div className="bg-secondary-dark rounded-lg p-4 border border-border hover:border-accent/50 transition-all duration-200 group">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4 flex-1 min-w-0">
            <div className="flex-shrink-0">
              <img
                src={getFaviconUrl(bookmark.url) || ''}
                alt=""
                className="w-6 h-6 rounded"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
            
            <div className="flex-1 min-w-0">
              <h3 className="text-text-primary font-medium truncate group-hover:text-accent transition-colors">
                {bookmark.title}
              </h3>
              <p className="text-text-secondary text-sm truncate">
                {getDomainFromUrl(bookmark.url)}
              </p>
            </div>

            {bookmark.folder && (
              <div className="flex items-center space-x-1 text-text-secondary">
                <Folder className="w-4 h-4" />
                <span className="text-sm">{bookmark.folder}</span>
              </div>
            )}

            <div className="flex items-center space-x-1 text-text-secondary">
              <Calendar className="w-4 h-4" />
              <span className="text-sm">{formatDate(bookmark.date_added)}</span>
            </div>

            {bookmark.chrome_bookmark_id && (
              <Chrome className="w-4 h-4 text-text-secondary" title="Synced with Chrome" />
            )}
          </div>

          <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <a
              href={bookmark.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-text-secondary hover:text-accent transition-colors rounded-lg hover:bg-hover"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
            <button
              onClick={() => onRemove(bookmark.id)}
              className="p-2 text-text-secondary hover:text-red-400 transition-colors rounded-lg hover:bg-red-900/20"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-secondary-dark rounded-xl p-6 border border-border hover:border-accent/50 hover:shadow-lg transition-all duration-200 group">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3 flex-1 min-w-0">
          <div className="flex-shrink-0">
            <img
              src={getFaviconUrl(bookmark.url) || ''}
              alt=""
              className="w-8 h-8 rounded"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-text-primary font-semibold text-lg leading-tight group-hover:text-accent transition-colors line-clamp-2">
              {bookmark.title}
            </h3>
          </div>
        </div>
        
        <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <a
            href={bookmark.url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 text-text-secondary hover:text-accent transition-colors rounded-lg hover:bg-hover"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
          <button
            onClick={() => onRemove(bookmark.id)}
            className="p-2 text-text-secondary hover:text-red-400 transition-colors rounded-lg hover:bg-red-900/20"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-text-secondary text-sm break-all">
          {getDomainFromUrl(bookmark.url)}
        </p>

        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1 text-text-secondary">
              <Calendar className="w-4 h-4" />
              <span>{formatDate(bookmark.date_added)}</span>
            </div>
            
            {bookmark.chrome_bookmark_id && (
              <div className="flex items-center space-x-1 text-text-secondary">
                <Chrome className="w-4 h-4" />
                <span>Chrome</span>
              </div>
            )}
          </div>
          
          {bookmark.folder && (
            <div className="flex items-center space-x-1 text-accent bg-accent/10 px-2 py-1 rounded-full">
              <Folder className="w-3 h-3" />
              <span className="text-xs font-medium">{bookmark.folder}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BookmarkCard;