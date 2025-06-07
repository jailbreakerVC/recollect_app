import { supabase } from '../lib/supabase';

export interface SemanticSearchResult {
  id: string;
  title: string;
  url: string;
  folder?: string;
  date_added: string;
  similarity_score: number;
  search_type: 'semantic' | 'trigram' | 'trigram_fallback';
}

export interface SearchOptions {
  similarityThreshold?: number;
  maxResults?: number;
  userId: string;
}

export class SemanticSearchService {
  /**
   * Check if semantic search is available with improved detection
   */
  static async isSemanticSearchAvailable(): Promise<boolean> {
    try {
      // First check if the test function exists and works
      const { data, error } = await supabase.rpc('test_semantic_search_availability');
      
      if (error) {
        // If test function doesn't exist, try the main function directly
        const { error: searchError } = await supabase.rpc('search_bookmarks_semantic', {
          search_query: 'test',
          user_id_param: 'test',
          similarity_threshold: 0.1,
          max_results: 1
        });
        
        // Function exists if we don't get a "function does not exist" error
        return !searchError || !searchError.message.includes('function') || !searchError.message.includes('does not exist');
      }
      
      return data === true;
    } catch (err) {
      console.warn('Semantic search availability check failed:', err);
      return false;
    }
  }

  /**
   * Perform semantic search on bookmarks with enhanced error handling
   */
  static async searchBookmarks(
    query: string,
    options: SearchOptions
  ): Promise<SemanticSearchResult[]> {
    const {
      similarityThreshold = 0.3,
      maxResults = 20,
      userId
    } = options;

    // Validate inputs
    if (!query || query.trim().length === 0) {
      return [];
    }

    if (!userId || userId.trim().length === 0) {
      throw new Error('User ID is required for search');
    }

    try {
      const { data, error } = await supabase.rpc('search_bookmarks_semantic', {
        search_query: query.trim(),
        user_id_param: userId,
        similarity_threshold: Math.max(0.0, Math.min(1.0, similarityThreshold)),
        max_results: Math.max(1, Math.min(100, maxResults))
      });

      if (error) {
        console.error('❌ Semantic search RPC failed:', error);
        
        // Check if it's a function not found error
        if (error.message.includes('function') && error.message.includes('does not exist')) {
          console.warn('Semantic search function not available, using fallback');
          return this.fallbackTextSearch(query, options);
        }
        
        // For other errors, try fallback
        console.warn('Semantic search failed, trying fallback:', error.message);
        return this.fallbackTextSearch(query, options);
      }

      return data || [];
    } catch (err) {
      console.error('❌ Semantic search error:', err);
      
      // Always fallback to text search on error
      return this.fallbackTextSearch(query, options);
    }
  }

  /**
   * Enhanced fallback text search using ILIKE and trigrams
   */
  private static async fallbackTextSearch(
    query: string,
    options: SearchOptions
  ): Promise<SemanticSearchResult[]> {
    try {
      const searchTerm = query.trim().toLowerCase();
      
      const { data, error } = await supabase
        .from('bookmarks')
        .select('id, title, url, folder, date_added')
        .eq('user_id', options.userId)
        .or(`title.ilike.%${searchTerm}%,url.ilike.%${searchTerm}%`)
        .order('date_added', { ascending: false })
        .limit(options.maxResults || 20);

      if (error) {
        console.error('❌ Fallback text search failed:', error);
        throw error;
      }

      // Convert to semantic search result format with calculated similarity
      const results: SemanticSearchResult[] = (data || []).map(bookmark => ({
        ...bookmark,
        similarity_score: this.calculateTextSimilarity(query, bookmark.title),
        search_type: 'trigram_fallback' as const
      }));

      // Sort by similarity score (highest first)
      results.sort((a, b) => b.similarity_score - a.similarity_score);

      // Filter by similarity threshold
      const threshold = options.similarityThreshold || 0.1; // Lower threshold for fallback
      return results.filter(result => result.similarity_score >= threshold);

    } catch (err) {
      console.error('❌ Fallback text search failed:', err);
      return [];
    }
  }

  /**
   * Improved text similarity calculation
   */
  private static calculateTextSimilarity(query: string, title: string): number {
    const queryLower = query.toLowerCase().trim();
    const titleLower = title.toLowerCase().trim();

    // Exact match
    if (titleLower === queryLower) return 1.0;

    // Exact substring match
    if (titleLower.includes(queryLower)) {
      return 0.8 * (queryLower.length / titleLower.length);
    }

    // Word-based similarity
    const queryWords = queryLower.split(/\s+/).filter(word => word.length > 0);
    const titleWords = titleLower.split(/\s+/).filter(word => word.length > 0);
    
    if (queryWords.length === 0 || titleWords.length === 0) return 0;
    
    // Count exact word matches
    const exactMatches = queryWords.filter(qWord => 
      titleWords.some(tWord => tWord === qWord)
    ).length;
    
    // Count partial word matches
    const partialMatches = queryWords.filter(qWord => 
      titleWords.some(tWord => tWord.includes(qWord) || qWord.includes(tWord))
    ).length;
    
    // Calculate similarity score
    const exactScore = exactMatches / queryWords.length;
    const partialScore = (partialMatches - exactMatches) / queryWords.length * 0.5;
    
    return Math.min(1.0, exactScore + partialScore);
  }

  /**
   * Update embeddings for a specific user's bookmarks (non-blocking)
   */
  static async updateUserEmbeddings(userId: string): Promise<number> {
    try {
      // Validate user ID
      if (!userId || userId.trim().length === 0) {
        console.warn('Invalid user ID provided for embedding update');
        return 0;
      }

      // Check if the function exists first
      const { data, error } = await supabase.rpc('update_bookmark_embeddings', {
        user_id_param: userId
      });

      if (error) {
        // If function doesn't exist, log warning but don't throw
        if (error.message.includes('function') && error.message.includes('does not exist')) {
          console.warn('⚠️ Embedding update function not available, skipping embedding update');
          return 0;
        }
        
        console.warn('⚠️ Failed to update embeddings (non-critical):', error.message);
        return 0;
      }

      const updatedCount = data || 0;
      
      if (updatedCount > 0) {
        console.log(`✅ Updated embeddings for ${updatedCount} bookmarks`);
      }
      
      return updatedCount;
    } catch (err) {
      // Silent fail for embedding updates - they're not critical
      console.warn('⚠️ Embedding update failed (non-critical):', err);
      return 0;
    }
  }

  /**
   * Test semantic search functionality with comprehensive testing
   */
  static async testSemanticSearch(userId: string): Promise<{
    success: boolean;
    message: string;
    sampleResults?: SemanticSearchResult[];
    details?: any;
  }> {
    try {
      // First check if semantic search is available
      const isAvailable = await this.isSemanticSearchAvailable();
      
      if (!isAvailable) {
        return {
          success: false,
          message: 'Semantic search functions are not available in the database',
          details: { availability: false }
        };
      }

      // Try to update embeddings first (non-blocking)
      let embeddingUpdateCount = 0;
      try {
        embeddingUpdateCount = await this.updateUserEmbeddings(userId);
      } catch (embeddingError) {
        console.warn('Embedding update failed during test:', embeddingError);
      }

      // Test with a simple query
      const testQuery = 'github';
      const results = await this.searchBookmarks(testQuery, {
        userId,
        maxResults: 5,
        similarityThreshold: 0.1
      });

      const searchTypes = [...new Set(results.map(r => r.search_type))];
      
      return {
        success: true,
        message: `Semantic search test successful. Found ${results.length} results for "${testQuery}" using: ${searchTypes.join(', ')}`,
        sampleResults: results,
        details: {
          availability: true,
          embeddingUpdateCount,
          searchTypes,
          resultCount: results.length
        }
      };
    } catch (err) {
      return {
        success: false,
        message: `Semantic search test failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
        details: { error: err }
      };
    }
  }

  /**
   * Get search suggestions based on existing bookmark titles
   */
  static async getSearchSuggestions(
    partialQuery: string,
    userId: string,
    maxSuggestions: number = 5
  ): Promise<string[]> {
    if (!partialQuery || partialQuery.length < 2) return [];

    try {
      const { data, error } = await supabase
        .from('bookmarks')
        .select('title')
        .eq('user_id', userId)
        .ilike('title', `%${partialQuery}%`)
        .limit(maxSuggestions * 2); // Get more to filter

      if (error) {
        console.error('❌ Failed to get search suggestions:', error);
        return [];
      }

      // Extract unique words that contain the partial query
      const suggestions = new Set<string>();
      
      (data || []).forEach(bookmark => {
        const words = bookmark.title.toLowerCase().split(/\s+/);
        words.forEach(word => {
          if (word.includes(partialQuery.toLowerCase()) && word.length > partialQuery.length) {
            suggestions.add(word);
          }
        });
        
        // Also add full titles that match
        if (bookmark.title.toLowerCase().includes(partialQuery.toLowerCase())) {
          suggestions.add(bookmark.title);
        }
      });

      return Array.from(suggestions).slice(0, maxSuggestions);
    } catch (err) {
      console.error('❌ Error getting search suggestions:', err);
      return [];
    }
  }
}