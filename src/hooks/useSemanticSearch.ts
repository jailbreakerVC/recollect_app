import { useState, useCallback } from 'react';
import { SemanticSearchService, SemanticSearchResult, PageContext } from '../services/semanticSearchService';
import { useAuth } from '../contexts/AuthContext';
import { Logger } from '../utils/logger';

interface UseSemanticSearchReturn {
  searchResults: SemanticSearchResult[];
  loading: boolean;
  error: string | null;
  searchByQuery: (query: string, options?: { maxResults?: number; similarityThreshold?: number }) => Promise<void>;
  searchByPageContext: (context: PageContext, options?: { maxResults?: number; similarityThreshold?: number; includeUrl?: boolean }) => Promise<void>;
  clearResults: () => void;
  updateEmbeddings: () => Promise<number>;
  testAvailability: () => Promise<boolean>;
}

export const useSemanticSearch = (): UseSemanticSearchReturn => {
  const { user } = useAuth();
  const [searchResults, setSearchResults] = useState<SemanticSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchByQuery = useCallback(async (
    query: string,
    options: { maxResults?: number; similarityThreshold?: number } = {}
  ) => {
    if (!user) {
      setError('User not logged in');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      Logger.info('useSemanticSearch', 'Searching by query', { query, options });
      
      const results = await SemanticSearchService.searchByQuery(query, user.id, options);
      setSearchResults(results);
      
      Logger.info('useSemanticSearch', `Found ${results.length} results for query: ${query}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Search failed';
      setError(message);
      Logger.error('useSemanticSearch', 'Query search failed', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const searchByPageContext = useCallback(async (
    context: PageContext,
    options: { maxResults?: number; similarityThreshold?: number; includeUrl?: boolean } = {}
  ) => {
    if (!user) {
      setError('User not logged in');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      Logger.info('useSemanticSearch', 'Searching by page context', { context, options });
      
      const results = await SemanticSearchService.searchByPageContext(context, user.id, options);
      setSearchResults(results);
      
      Logger.info('useSemanticSearch', `Found ${results.length} results for page: ${context.title}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Search failed';
      setError(message);
      Logger.error('useSemanticSearch', 'Context search failed', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const clearResults = useCallback(() => {
    setSearchResults([]);
    setError(null);
  }, []);

  const updateEmbeddings = useCallback(async (): Promise<number> => {
    if (!user) {
      throw new Error('User not logged in');
    }

    setLoading(true);
    setError(null);

    try {
      Logger.info('useSemanticSearch', 'Updating embeddings for user', user.id);
      
      const count = await SemanticSearchService.updateUserEmbeddings(user.id);
      
      Logger.info('useSemanticSearch', `Updated ${count} bookmark embeddings`);
      return count;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update embeddings';
      setError(message);
      Logger.error('useSemanticSearch', 'Update embeddings failed', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user]);

  const testAvailability = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      Logger.info('useSemanticSearch', 'Testing semantic search availability');
      
      const available = await SemanticSearchService.testSemanticSearchAvailability();
      
      Logger.info('useSemanticSearch', `Semantic search availability: ${available}`);
      return available;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Availability test failed';
      setError(message);
      Logger.error('useSemanticSearch', 'Availability test failed', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    searchResults,
    loading,
    error,
    searchByQuery,
    searchByPageContext,
    clearResults,
    updateEmbeddings,
    testAvailability,
  };
};