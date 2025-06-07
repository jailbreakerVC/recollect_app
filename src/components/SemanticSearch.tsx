import React, { useState, useEffect, useRef } from 'react';
import { Search, Sparkles, Clock, TrendingUp, X } from 'lucide-react';
import { SemanticSearchService, SemanticSearchResult } from '../services/semanticSearchService';
import { useAuth } from '../contexts/AuthContext';

interface SemanticSearchProps {
  onResultSelect: (result: SemanticSearchResult) => void;
  placeholder?: string;
  className?: string;
}

export const SemanticSearch: React.FC<SemanticSearchProps> = ({
  onResultSelect,
  placeholder = "Search bookmarks intelligently...",
  className = ""
}) => {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SemanticSearchResult[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [searchType, setSearchType] = useState<string>('');
  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  const suggestionTimeoutRef = useRef<NodeJS.Timeout>();
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounced search
  useEffect(() => {
    if (!user || query.trim().length < 2) {
      setResults([]);
      setShowResults(false);
      return;
    }

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Set new timeout for search
    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const searchResults = await SemanticSearchService.searchBookmarks(query.trim(), {
          userId: user.id,
          maxResults: 10,
          similarityThreshold: 0.2
        });
        
        setResults(searchResults);
        setShowResults(true);
        
        // Set search type from first result
        if (searchResults.length > 0) {
          setSearchType(searchResults[0].search_type);
        }
      } catch (error) {
        console.error('Search failed:', error);
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [query, user]);

  // Debounced suggestions
  useEffect(() => {
    if (!user || query.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    // Clear previous timeout
    if (suggestionTimeoutRef.current) {
      clearTimeout(suggestionTimeoutRef.current);
    }

    // Set new timeout for suggestions
    suggestionTimeoutRef.current = setTimeout(async () => {
      try {
        const searchSuggestions = await SemanticSearchService.getSearchSuggestions(
          query.trim(),
          user.id,
          3
        );
        setSuggestions(searchSuggestions);
      } catch (error) {
        console.error('Failed to get suggestions:', error);
        setSuggestions([]);
      }
    }, 150);

    return () => {
      if (suggestionTimeoutRef.current) {
        clearTimeout(suggestionTimeoutRef.current);
      }
    };
  }, [query, user]);

  // Close results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleResultClick = (result: SemanticSearchResult) => {
    onResultSelect(result);
    setShowResults(false);
    setQuery('');
  };

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion);
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setShowResults(false);
    setSuggestions([]);
  };

  const getSearchTypeIcon = () => {
    switch (searchType) {
      case 'semantic':
        return <Sparkles className="w-4 h-4 text-purple-500" title="AI-powered semantic search" />;
      case 'trigram':
        return <TrendingUp className="w-4 h-4 text-blue-500" title="Text similarity search" />;
      default:
        return <Search className="w-4 h-4 text-gray-400" />;
    }
  };

  const formatSimilarityScore = (score: number): string => {
    return `${Math.round(score * 100)}%`;
  };

  const getScoreColor = (score: number): string => {
    if (score >= 0.8) return 'text-green-600 bg-green-50';
    if (score >= 0.6) return 'text-blue-600 bg-blue-50';
    if (score >= 0.4) return 'text-yellow-600 bg-yellow-50';
    return 'text-gray-600 bg-gray-50';
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Search Input */}
      <div className="relative">
        <div className="absolute left-3 top-1/2 transform -translate-y-1/2 flex items-center space-x-2">
          {isSearching ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          ) : (
            getSearchTypeIcon()
          )}
        </div>
        
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (results.length > 0) setShowResults(true);
          }}
          placeholder={placeholder}
          className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white shadow-sm"
        />
        
        {query && (
          <button
            onClick={clearSearch}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Search Results Dropdown */}
      {showResults && (results.length > 0 || suggestions.length > 0) && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
          {/* Search Type Indicator */}
          {searchType && (
            <div className="px-3 py-2 border-b border-gray-100 bg-gray-50">
              <div className="flex items-center text-xs text-gray-600">
                {getSearchTypeIcon()}
                <span className="ml-2">
                  {searchType === 'semantic' && 'AI-powered semantic search'}
                  {searchType === 'trigram' && 'Text similarity search'}
                  {searchType === 'trigram_fallback' && 'Fallback text search'}
                </span>
              </div>
            </div>
          )}

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div className="px-3 py-2 border-b border-gray-100">
              <div className="text-xs text-gray-500 mb-2">Suggestions:</div>
              <div className="flex flex-wrap gap-1">
                {suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100 transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Search Results */}
          {results.length > 0 && (
            <div className="py-1">
              {results.map((result, index) => (
                <button
                  key={result.id}
                  onClick={() => handleResultClick(result)}
                  className="w-full px-3 py-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-b-0"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <h4 className="text-sm font-medium text-gray-900 truncate">
                          {result.title}
                        </h4>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${getScoreColor(result.similarity_score)}`}>
                          {formatSimilarityScore(result.similarity_score)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 truncate mb-1">
                        {result.url}
                      </p>
                      <div className="flex items-center space-x-3 text-xs text-gray-400">
                        {result.folder && (
                          <span className="flex items-center">
                            📁 {result.folder}
                          </span>
                        )}
                        <span className="flex items-center">
                          <Clock className="w-3 h-3 mr-1" />
                          {new Date(result.date_added).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* No Results */}
          {results.length === 0 && suggestions.length === 0 && query.trim().length >= 2 && !isSearching && (
            <div className="px-3 py-4 text-center text-gray-500 text-sm">
              No bookmarks found for "{query}"
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SemanticSearch;