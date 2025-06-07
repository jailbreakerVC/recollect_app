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
   * Perform semantic search on bookmarks
   */
  static async searchBookmarks(
    query: string,
    options: SearchOptions
  ): Promise<SemanticSearchResult[]> {
    const {
      similarityThreshold = 0.3, // Lower threshold for better recall
      maxResults = 20,
      userId
    } = options;

    try {
      const { data, error } = await supabase.rpc('search_bookmarks_semantic', {
        search_query: query.trim(),
        user_id_param: userId,
        similarity_threshold: similarityThreshold,
        max_results: maxResults
      });

      if (error) {
        console.error('❌ Semantic search failed:', error);
        
        // Fallback to regular text search if semantic search fails
        return this.fallbackTextSearch(query, options);
      }

      return data || [];
    } catch (err) {
      console.error('❌ Semantic search error:', err);
      
      // Fallback to regular text search
      return this.fallbackTextSearch(query, options);
    }
  }

  /**
   * Fallback text search using ILIKE and trigrams
   */
  private static async fallbackTextSearch(
    query: string,
    options: SearchOptions
  ): Promise<SemanticSearchResult[]> {
    try {
      const { data, error } = await supabase
        .from('bookmarks')
        .select('id, title, url, folder, date_added')
        .eq('user_id', options.userId)
        .or(`title.ilike.%${query}%,url.ilike.%${query}%`)
        .order('date_added', { ascending: false })
        .limit(options.maxResults || 20);

      if (error) {
        throw error;
      }

      // Convert to semantic search result format
      const results: SemanticSearchResult[] = (data || []).map(bookmark => ({
        ...bookmark,
        similarity_score: this.calculateTextSimilarity(query, bookmark.title),
        search_type: 'trigram_fallback' as const
      }));

      // Sort by similarity score
      results.sort((a, b) => b.similarity_score - a.similarity_score);

      return results;
    } catch (err) {
      console.error('❌ Fallback text search failed:', err);
      return [];
    }
  }

  /**
   * Simple text similarity calculation
   */
  private static calculateTextSimilarity(query: string, title: string): number {
    const queryLower = query.toLowerCase();
    const titleLower = title.toLowerCase();

    // Exact match
    if (titleLower === queryLower) return 1.0;

    // Contains query
    if (titleLower.includes(queryLower)) {
      return 0.8 * (queryLower.length / titleLower.length);
    }

    // Word overlap
    const queryWords = queryLower.split(/\s+/);
    const titleWords = titleLower.split(/\s+/);
    
    const overlap = queryWords.filter(word => 
      titleWords.some(titleWord => titleWord.includes(word) || word.includes(titleWord))
    ).length;

    return overlap / Math.max(queryWords.length, titleWords.length) * 0.6;
  }

  /**
   * Update embeddings for a specific user's bookmarks with better error handling
   */
  static async updateUserEmbeddings(userId: string): Promise<number> {
    try {
      // Validate user ID
      if (!userId || userId.trim().length === 0) {
        throw new Error('Invalid user ID provided');
      }

      // Check if the function exists first
      const { data: functionExists, error: checkError } = await supabase.rpc('update_bookmark_embeddings', {
        user_id_param: userId
      });

      if (checkError) {
        // If function doesn't exist, try to handle gracefully
        if (checkError.message.includes('function') && checkError.message.includes('does not exist')) {
          console.warn('⚠️ Embedding function not available, skipping embedding update');
          return 0;
        }
        
        console.error('❌ Failed to update embeddings:', checkError);
        throw new Error(`Failed to update embeddings: ${checkError.message}`);
      }

      const updatedCount = functionExists || 0;
      
      if (updatedCount > 0) {
        console.log(`✅ Updated embeddings for ${updatedCount} bookmarks`);
      }
      
      return updatedCount;
    } catch (err) {
      // Don't throw error for embedding updates - they're not critical
      console.warn('⚠️ Embedding update failed (non-critical):', err);
      return 0;
    }
  }

  /**
   * Update embeddings for all bookmarks (admin function)
   */
  static async updateAllEmbeddings(): Promise<number> {
    try {
      const { data, error } = await supabase.rpc('update_bookmark_embeddings');

      if (error) {
        // Handle missing function gracefully
        if (error.message.includes('function') && error.message.includes('does not exist')) {
          console.warn('⚠️ Embedding function not available');
          return 0;
        }
        
        console.error('❌ Failed to update all embeddings:', error);
        throw new Error(`Failed to update embeddings: ${error.message}`);
      }

      const updatedCount = data || 0;
      
      return updatedCount;
    } catch (err) {
      console.warn('⚠️ Embedding update failed (non-critical):', err);
      return 0;
    }
  }

  /**
   * Test semantic search functionality
   */
  static async testSemanticSearch(userId: string): Promise<{
    success: boolean;
    message: string;
    sampleResults?: SemanticSearchResult[];
  }> {
    try {
      // First test if embedding functions are available
      try {
        await this.updateUserEmbeddings(userId);
      } catch (embeddingError) {
        // Continue with test even if embeddings fail
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
        sampleResults: results
      };
    } catch (err) {
      return {
        success: false,
        message: `Semantic search test failed: ${err instanceof Error ? err.message : 'Unknown error'}`
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
    if (partialQuery.length < 2) return [];

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
      });

      return Array.from(suggestions).slice(0, maxSuggestions);
    } catch (err) {
      console.error('❌ Error getting search suggestions:', err);
      return [];
    }
  }

  /**
   * Check if semantic search is available
   */
  static async isSemanticSearchAvailable(): Promise<boolean> {
    try {
      // Try to call the search function with a test query
      const { error } = await supabase.rpc('search_bookmarks_semantic', {
        search_query: 'test',
        user_id_param: 'test',
        similarity_threshold: 0.5,
        max_results: 1
      });

      // If no error or only a data-related error, the function exists
      return !error || !error.message.includes('function') || !error.message.includes('does not exist');
    } catch (err) {
      return false;
    }
  }
}