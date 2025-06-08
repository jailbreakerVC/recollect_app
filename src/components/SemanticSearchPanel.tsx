import React, { useState, useEffect } from 'react';
import { Search, Brain, Zap, ExternalLink, RefreshCw, TestTube, AlertCircle } from 'lucide-react';
import { useSemanticSearch } from '../hooks/useSemanticSearch';
import { useToast } from './Toast';
import { SemanticSearchResult } from '../services/semanticSearchService';

interface SemanticSearchPanelProps {
  onClose?: () => void;
}

export const SemanticSearchPanel: React.FC<SemanticSearchPanelProps> = ({ onClose }) => {
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

  useEffect(() => {
    checkAvailability();
  }, []);

  const checkAvailability = async () => {
    try {
      const available = await testAvailability();
      setIsAvailable(available);
    } catch (err) {
      setIsAvailable(false);
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
    const loadingToastId = showLoading('Updating Embeddings', 'Generating embeddings for your bookmarks...');

    try {
      const count = await updateEmbeddings();
      removeToast(loadingToastId);
      showSuccess('Embeddings Updated', `Updated embeddings for ${count} bookmarks`);
      
      // Refresh availability after updating embeddings
      await checkAvailability();
    } catch (err) {
      removeToast(loadingToastId);
      showError('Update Failed', err instanceof Error ? err.message : 'Failed to update embeddings');
    }
  };

  const formatSimilarityScore = (score: number): string => {
    return `${Math.round(score * 100)}%`;
  };

  const getSearchTypeIcon = (searchType: string) => {
    switch (searchType) {
      case 'semantic':
        return <Brain className="w-3 h-3 text-purple-600" title="Semantic search" />;
      case 'trigram':
        return <Search className="w-3 h-3 text-blue-600" title="Text similarity" />;
      default:
        return <Search className="w-3 h-3 text-gray-600" title="Fallback search" />;
    }
  };

  if (isAvailable === false) {
    return (
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <Brain className="w-5 h-5 mr-2 text-purple-600" />
            Semantic Search
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
          Semantic Search
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
              {loading ? 'Searching...' : 'Semantic Search'}
            </button>
            
            <button
              type="button"
              onClick={handleUpdateEmbeddings}
              disabled={loading}
              className="inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
              title="Update embeddings for better search results"
            >
              <Zap className="w-4 h-4" />
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
          <h5 className="font-medium text-purple-900 mb-2">How Semantic Search Works</h5>
          <ul className="text-sm text-purple-800 space-y-1">
            <li>• Searches by meaning and context, not just keywords</li>
            <li>• Finds related bookmarks even with different wording</li>
            <li>• Uses AI embeddings to understand content similarity</li>
            <li>• Falls back to text search when needed</li>
          </ul>
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
        return <Brain className="w-3 h-3 text-purple-600" title="Semantic search" />;
      case 'trigram':
        return <Search className="w-3 h-3 text-blue-600" title="Text similarity" />;
      default:
        return <Search className="w-3 h-3 text-gray-600" title="Fallback search" />;
    }
  };

  const formatSimilarityScore = (score: number): string => {
    return `${Math.round(score * 100)}%`;
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-2">
        <h5 className="font-medium text-gray-900 flex-1 mr-2">
          {result.title}
        </h5>
        <div className="flex items-center space-x-2">
          <span className="text-xs text-gray-500 flex items-center">
            {getSearchTypeIcon(result.search_type)}
            <span className="ml-1">{formatSimilarityScore(result.similarity_score)}</span>
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