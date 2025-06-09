import React, { useState, useEffect } from 'react';
import { Search, Brain, Zap, ExternalLink, RefreshCw, TestTube, AlertCircle, Database, CheckCircle } from 'lucide-react';
import { useSemanticSearch } from '../hooks/useSemanticSearch';
import { useToast } from './Toast';
import { SemanticSearchResult } from '../services/semanticSearchService';
import { useAuth } from '../contexts/AuthContext';
import { BookmarkService } from '../services/bookmarkService';

interface SemanticSearchPanelProps {
  onClose?: () => void;
}

interface EmbeddingStats {
  totalBookmarks: number;
  bookmarksWithEmbeddings: number;
  needsEmbeddings: number;
}

export const SemanticSearchPanel: React.FC<SemanticSearchPanelProps> = ({ onClose }) => {
  const { user } = useAuth();
  const {
    searchResults,
    loading,
    error,
    searchByQuery,
    clearResults,
    updateEmbeddings,
    testAvailability
  } = useSemanticSearch();

  const { showSuccess, showError, showLoading, removeToast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [embeddingStats, setEmbeddingStats] = useState<EmbeddingStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  useEffect(() => {
    checkAvailability();
    loadEmbeddingStats();
  }, []);

  const checkAvailability = async () => {
    try {
      const available = await testAvailability();
      setIsAvailable(available);
    } catch (err) {
      setIsAvailable(false);
    }
  };

  const loadEmbeddingStats = async () => {
    if (!user) return;
    
    setLoadingStats(true);
    try {
      const stats = await BookmarkService.getEmbeddingStats(user.id);
      setEmbeddingStats(stats);
    } catch (err) {
      console.error('Failed to load embedding stats:', err);
      // Fallback to basic stats
      const bookmarks = await BookmarkService.getBookmarks(user.id);
      setEmbeddingStats({
        totalBookmarks: bookmarks.length,
        bookmarksWithEmbeddings: 0,
        needsEmbeddings: bookmarks.length
      });
    } finally {
      setLoadingStats(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    await searchByQuery(searchQuery.trim(), {
      maxResults: 10,
      similarityThreshold: 0.3
    });
  };

  const handleUpdateEmbeddings = async () => {
    const loadingToastId = showLoading('Generating Embeddings', 'Creating AI embeddings for your bookmarks...');

    try {
      const count = await updateEmbeddings();
      removeToast(loadingToastId);
      showSuccess('Embeddings Generated', `Successfully created embeddings for ${count} bookmarks`);
      
      // Refresh stats and availability
      await loadEmbeddingStats();
      await checkAvailability();
    } catch (err) {
      removeToast(loadingToastId);
      showError('Update Failed', err instanceof Error ? err.message : 'Failed to generate embeddings');
    }
  };

  const formatSimilarityScore = (score: number): string => {
    return `${Math.round(score * 100)}%`;
  };

  const getSearchTypeIcon = (searchType: string) => {
    switch (searchType) {
      case 'semantic':
        return <Brain className="w-3 h-3 text-purple-600" title="AI Semantic search" />;
      case 'trigram':
        return <Search className="w-3 h-3 text-blue-600" title="Text similarity" />;
      case 'text_fallback':
        return <Search className="w-3 h-3 text-gray-600" title="Simple text search" />;
      default:
        return <Search className="w-3 h-3 text-gray-600" title="Fallback search" />;
    }
  };

  const getEmbeddingStatusColor = () => {
    if (!embeddingStats) return 'gray';
    if (embeddingStats.bookmarksWithEmbeddings === 0) return 'red';
    if (embeddingStats.needsEmbeddings > 0) return 'yellow';
    return 'green';
  };

  const getEmbeddingStatusText = () => {
    if (!embeddingStats) return 'Loading...';
    if (embeddingStats.bookmarksWithEmbeddings === 0) return 'No embeddings generated';
    if (embeddingStats.needsEmbeddings > 0) return 'Partial embeddings';
    return 'All embeddings ready';
  };

  if (isAvailable === false) {
    return (
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <Brain className="w-5 h-5 mr-2 text-purple-600" />
            AI Semantic Search
          </h3>
          {onClose && (
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              ×
            </button>
          )}
        </div>

        <div className="text-center py-8">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h4 className="text-lg font-medium text-gray-900 mb-2">Semantic Search Not Available</h4>
          <p className="text-gray-600 mb-4">
            Vector search capabilities are not enabled in your database. 
            This feature requires the pgvector extension.
          </p>
          <button
            onClick={checkAvailability}
            className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <TestTube className="w-4 h-4 mr-2" />
            Test Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <Brain className="w-5 h-5 mr-2 text-purple-600" />
          AI Semantic Search
          {isAvailable && (
            <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
              Available
            </span>
          )}
        </h3>
        {onClose && (
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            ×
          </button>
        )}
      </div>

      {/* Embedding Status */}
      {embeddingStats && (
        <div className={`mb-6 p-4 rounded-lg border ${
          getEmbeddingStatusColor() === 'red' ? 'bg-red-50 border-red-200' :
          getEmbeddingStatusColor() === 'yellow' ? 'bg-yellow-50 border-yellow-200' :
          getEmbeddingStatusColor() === 'green' ? 'bg-green-50 border-green-200' :
          'bg-gray-50 border-gray-200'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-gray-900 flex items-center">
              <Database className="w-4 h-4 mr-2" />
              Embedding Status
            </h4>
            {loadingStats && <RefreshCw className="w-4 h-4 animate-spin text-gray-500" />}
          </div>
          
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Total Bookmarks:</span>
              <div className="font-semibold">{embeddingStats.totalBookmarks}</div>
            </div>
            <div>
              <span className="text-gray-600">With Embeddings:</span>
              <div className="font-semibold">{embeddingStats.bookmarksWithEmbeddings}</div>
            </div>
            <div>
              <span className="text-gray-600">Need Embeddings:</span>
              <div className="font-semibold text-orange-600">{embeddingStats.needsEmbeddings}</div>
            </div>
          </div>
          
          <div className="mt-3 flex items-center justify-between">
            <span className={`text-sm font-medium ${
              getEmbeddingStatusColor() === 'red' ? 'text-red-700' :
              getEmbeddingStatusColor() === 'yellow' ? 'text-yellow-700' :
              getEmbeddingStatusColor() === 'green' ? 'text-green-700' :
              'text-gray-700'
            }`}>
              {getEmbeddingStatusText()}
            </span>
            
            {embeddingStats.needsEmbeddings > 0 && (
              <button
                onClick={handleUpdateEmbeddings}
                disabled={loading}
                className="inline-flex items-center px-3 py-1 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 transition-colors disabled:opacity-50"
              >
                <Zap className="w-3 h-3 mr-1" />
                Generate Embeddings
              </button>
            )}
          </div>
        </div>
      )}

      <div className="space-y-4">
        {/* Search Form */}
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search bookmarks by meaning, topic, or concept..."
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              disabled={loading}
            />
          </div>
          
          <div className="flex space-x-3">
            <button
              type="submit"
              disabled={loading || !searchQuery.trim()}
              className="flex-1 inline-flex items-center justify-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Brain className="w-4 h-4 mr-2" />
              )}
              {loading ? 'Searching...' : 'AI Search'}
            </button>
            
            <button
              type="button"
              onClick={() => loadEmbeddingStats()}
              disabled={loading || loadingStats}
              className="inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
              title="Refresh embedding status"
            >
              <RefreshCw className={`w-4 h-4 ${loadingStats ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </form>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Results */}
        {searchResults.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-gray-900">
                Search Results ({searchResults.length})
              </h4>
              <button
                onClick={clearResults}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Clear
              </button>
            </div>
            
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {searchResults.map((result) => (
                <SearchResultCard key={result.id} result={result} />
              ))}
            </div>
          </div>
        )}

        {/* Help Text */}
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <h5 className="font-medium text-purple-900 mb-2">How AI Semantic Search Works</h5>
          <ul className="text-sm text-purple-800 space-y-1">
            <li>• <strong>Step 1:</strong> Generate embeddings for your bookmarks (one-time setup)</li>
            <li>• <strong>Step 2:</strong> Search by meaning and context, not just keywords</li>
            <li>• <strong>Step 3:</strong> Find related bookmarks even with different wording</li>
            <li>• Uses AI embeddings to understand content similarity</li>
            <li>• Falls back to text search when needed</li>
          </ul>
          
          {embeddingStats && embeddingStats.needsEmbeddings > 0 && (
            <div className="mt-3 p-3 bg-orange-100 border border-orange-200 rounded">
              <p className="text-sm text-orange-800">
                <strong>⚡ Action Required:</strong> You have {embeddingStats.needsEmbeddings} bookmarks without AI embeddings. 
                Click "Generate Embeddings" above to enable full semantic search capabilities.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface SearchResultCardProps {
  result: SemanticSearchResult;
}

const SearchResultCard: React.FC<SearchResultCardProps> = ({ result }) => {
  const getSearchTypeIcon = (searchType: string) => {
    switch (searchType) {
      case 'semantic':
        return <Brain className="w-3 h-3 text-purple-600" title="AI Semantic search" />;
      case 'trigram':
        return <Search className="w-3 h-3 text-blue-600" title="Text similarity" />;
      case 'text_fallback':
        return <Search className="w-3 h-3 text-gray-600" title="Simple text search" />;
      default:
        return <Search className="w-3 h-3 text-gray-600" title="Fallback search" />;
    }
  };

  const formatSimilarityScore = (score: number): string => {
    return `${Math.round(score * 100)}%`;
  };

  const getSearchTypeLabel = (searchType: string): string => {
    switch (searchType) {
      case 'semantic':
        return 'AI Match';
      case 'trigram':
        return 'Text Match';
      case 'text_fallback':
        return 'Simple Match';
      default:
        return 'Match';
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-2">
        <h5 className="font-medium text-gray-900 flex-1 mr-2">
          {result.title}
        </h5>
        <div className="flex items-center space-x-2">
          <span className="text-xs text-gray-500 flex items-center bg-gray-100 px-2 py-1 rounded">
            {getSearchTypeIcon(result.search_type)}
            <span className="ml-1">{getSearchTypeLabel(result.search_type)}</span>
            <span className="ml-1 font-medium">{formatSimilarityScore(result.similarity_score)}</span>
          </span>
          <a
            href={result.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>
      
      <p className="text-sm text-gray-600 break-all mb-2">{result.url}</p>
      
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>
          {new Date(result.date_added).toLocaleDateString()}
        </span>
        {result.folder && (
          <span className="bg-gray-100 px-2 py-1 rounded">
            {result.folder}
          </span>
        )}
      </div>
    </div>
  );
};