import { supabase } from '../lib/supabase';
import { DatabaseBookmark } from '../types';
import { Logger } from '../utils/logger';
import { OpenAIService } from './openaiService';

export interface SemanticSearchResult extends DatabaseBookmark {
  similarity_score: number;
  search_type: 'semantic' | 'trigram' | 'trigram_fallback' | 'text_fallback';
}

export interface PageContext {
  title: string;
  url: string;
  description?: string;
  keywords?: string[];
  content?: string;
}

export class SemanticSearchService {
  /**
   * Search for bookmarks related to the current page context
   */
  static async searchByPageContext(
    pageContext: PageContext,
    userId: string,
    options: {
      maxResults?: number;
      similarityThreshold?: number;
      includeUrl?: boolean;
    } = {}
  ): Promise<SemanticSearchResult[]> {
    const {
      maxResults = 10,
      similarityThreshold = 0.3,
      includeUrl = true
    } = options;

    Logger.info('SemanticSearchService', 'Searching by page context', {
      title: pageContext.title,
      url: pageContext.url,
      userId,
      maxResults,
      similarityThreshold
    });

    try {
      // Break down search terms into components
      const searchComponents = [
        ...pageContext.title.split(' ').filter(word => word.length > 1),
        ...(pageContext.description ? pageContext.description.split(' ').filter(word => word.length > 1) : [])
      ];

      // Generate embeddings for each component
      const componentEmbeddings = await Promise.all(
        searchComponents.map(async (component) => {
          try {
            return await OpenAIService.generateEmbedding(component);
          } catch (error) {
            Logger.error('SemanticSearchService', 'Failed to generate embedding for component', {
              component,
              error
            });
            return null;
          }
        })
      );

      // Filter out any failed embeddings
      const validEmbeddings = componentEmbeddings.filter((emb): emb is number[] => emb !== null);

      // If we have valid embeddings, perform vector search
      if (validEmbeddings.length === 0) {
        throw new Error('Failed to generate any valid embeddings');
      }

      // Combine embeddings using element-wise average
      const combinedEmbedding = validEmbeddings.reduce((acc, curr) => 
        acc.map((val, i) => val + curr[i])
      ).map(val => val / validEmbeddings.length);

      // Use the combined embedding for search
      const queryEmbedding = combinedEmbedding;

      // Perform vector search
      const { data: bookmarks, error } = await supabase
        .rpc('search_bookmarks_vector', {
          query_embedding: queryEmbedding,
          user_id_param: userId,
          similarity_threshold: similarityThreshold,
          max_results: maxResults
        });

      // If we got no results or very few results, try with a lower threshold
      if (!bookmarks || bookmarks.length < 3) {
        const { data: moreResults, error: moreError } = await supabase.rpc('search_bookmarks_vector', {
          query_embedding: queryEmbedding,
          user_id_param: userId,
          similarity_threshold: 0.1,  // Lower threshold for more results
          max_results: maxResults
        });

        if (moreResults && moreResults.length > 0) {
          return moreResults.map((result: any) => ({
            ...result,
            search_type: 'semantic',
            similarity_score: result.similarity_score,
          }));
        }
      }

      // If we still have no results, fall back to keyword search
      if (!bookmarks || bookmarks.length === 0) {
        const { data: keywordResults, error: keywordError } = await supabase.rpc('search_bookmarks_keywords', {
          search_query: pageContext.title || '',
          user_id_param: userId,
          max_results: maxResults
        });

        if (!keywordError && keywordResults) {
          return keywordResults.map((result: any) => ({
            ...result,
            search_type: 'trigram'
          }));
        }
      }

      if (error) {
        Logger.error('SemanticSearchService', 'Vector search failed', {
          error: error || 'Unknown error',
          userId,
          maxResults,
          similarityThreshold
        });
        throw error;
      }

      return bookmarks.map((result: any) => ({
        ...result,
        search_type: 'semantic'
      }));

      const filteredResults = includeUrl 
        ? data 
        : data.filter(bookmark => !this.isSameUrl(bookmark.url, pageContext.url));

      Logger.info('SemanticSearchService', `Found ${filteredResults.length} related bookmarks`);
      return filteredResults;

    } catch (error) {
      Logger.error('SemanticSearchService', 'Failed to search by page context', error);
      
      // Fallback to semantic search
      return this.performFallbackSearch(context, userId, maxResults);
    }  
  }

  /**
   * Search for bookmarks using a text query
   */
  static async searchByQuery(
    query: string,
    userId: string,
    options: {
      maxResults?: number;
      similarityThreshold?: number;
    } = {}
  ): Promise<SemanticSearchResult[]> {
    const {
      maxResults = 20,
      similarityThreshold = 0.15
    } = options;

    Logger.info('SemanticSearchService', 'Searching by query', {
      query,
      userId,
      maxResults,
      similarityThreshold
    });

    try {
      // First try with the original query
      let results = await this.performSemanticSearch(
        query,
        userId,
        similarityThreshold,
        maxResults
      );

      // If we got no results or very few results, try variations
      if (!results || results.length < 3) {
        // Try with expanded terms
        const expandedQuery = query
          .replace(/rag\s*gpt/gi, 'retrieval augmented generation gpt')
          .replace(/gpt/gi, 'generative pre-trained transformer')
          .replace(/ai/gi, 'artificial intelligence')
          .replace(/ml/gi, 'machine learning');

        results = await this.performSemanticSearch(
          expandedQuery,
          userId,
          similarityThreshold * 0.8, // Lower threshold for variations
          maxResults
        );

        // If still not enough results, try keyword search
        if (!results || results.length < 3) {
          results = await this.performFallbackSearch(query, userId, maxResults);
        }
      }

      return results;
    } catch (error) {
      Logger.error('SemanticSearchService', 'Failed to search by query', error);
      return await this.performFallbackSearch(query, userId, maxResults);
    }
  }

  /**
   * Test if semantic search is available
   */
  static async testSemanticSearchAvailability(): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('test_semantic_search_availability');
      
      if (error) {
        Logger.warn('SemanticSearchService', 'Semantic search test failed', error);
        return false;
      }

      Logger.info('SemanticSearchService', `Semantic search availability: ${data}`);
      return data === true;
    } catch (error) {
      Logger.warn('SemanticSearchService', 'Semantic search test error', error);
      return false;
    }
  }

  /**
   * Update embeddings for a specific user's bookmarks
   */
  static async updateUserEmbeddings(userId: string): Promise<number> {
    try {
      Logger.info('SemanticSearchService', `Updating embeddings for user: ${userId}`);
      
      const { data, error } = await supabase.rpc('update_bookmark_embeddings', {
        user_id_param: userId
      });

      if (error) {
        Logger.error('SemanticSearchService', 'Failed to update embeddings', error);
        throw new Error(`Failed to update embeddings: ${error.message}`);
      }

      Logger.info('SemanticSearchService', `Updated ${data} bookmark embeddings`);
      return data || 0;
    } catch (error) {
      Logger.error('SemanticSearchService', 'Error updating embeddings', error);
      throw error;
    }
  }

  /**
   * Perform the actual semantic search using the database function
   */
  private static async performSemanticSearch(
    query: string,
    userId: string,
    similarityThreshold: number,
    maxResults: number
  ): Promise<SemanticSearchResult[]> {
    const { data, error } = await supabase.rpc('search_bookmarks_semantic', {
      search_query: query,
      user_id_param: userId,
      similarity_threshold: similarityThreshold,
      max_results: maxResults
    });

    if (error) {
      Logger.error('SemanticSearchService', 'Semantic search RPC failed', error);
      throw new Error(`Semantic search failed: ${error.message}`);
    }

    return (data || []).map((result: any) => ({
      ...result,
      // Ensure we have all required DatabaseBookmark fields
      chrome_bookmark_id: result.chrome_bookmark_id || undefined,
      parent_id: result.parent_id || undefined,
      created_at: result.created_at || result.date_added,
      updated_at: result.updated_at || result.date_added,
    }));
  }

  /**
   * Perform fallback search when semantic search is not available
   */
  private static async performFallbackSearch(
    query: string,
    userId: string,
    maxResults: number
  ): Promise<SemanticSearchResult[]> {
    Logger.info('SemanticSearchService', 'Performing fallback text search');
    
    const { data, error } = await supabase
      .from('bookmarks')
      .select('*')
      .eq('user_id', userId)
      .or(`title.ilike.%${query}%,url.ilike.%${query}%`)
      .order('date_added', { ascending: false })
      .limit(maxResults);

    if (error) {
      Logger.error('SemanticSearchService', 'Fallback search failed', error);
      throw new Error(`Search failed: ${error.message}`);
    }

    return (data || []).map((result: any) => ({
      ...result,
      similarity_score: 0.5,
      search_type: 'text_fallback' as const,
      chrome_bookmark_id: result.chrome_bookmark_id || undefined,
      parent_id: result.parent_id || undefined,
      created_at: result.created_at || result.date_added,
      updated_at: result.updated_at || result.date_added,
    }));
  }

  /**
   * Create a search query from page context
   */
  private static createSearchQueryFromContext(context: PageContext): string {
    const parts: string[] = [];

    // Add title (most important)
    if (context.title) {
      parts.push(context.title);
    }

    // Add description
    if (context.description) {
      parts.push(context.description);
    }

    // Add keywords
    if (context.keywords && context.keywords.length > 0) {
      parts.push(context.keywords.join(' '));
    }

    // Add relevant parts of content (first 200 chars)
    if (context.content) {
      const cleanContent = context.content
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 200);
      parts.push(cleanContent);
    }

    // Extract domain/technology from URL
    const urlKeywords = this.extractUrlKeywords(context.url);
    if (urlKeywords.length > 0) {
      parts.push(urlKeywords.join(' '));
    }

    const query = parts.join(' ').trim();
    Logger.debug('SemanticSearchService', 'Created search query from context', {
      originalContext: context,
      generatedQuery: query
    });

    return query;
  }

  /**
   * Extract meaningful keywords from URL
   */
  private static extractUrlKeywords(url: string): string[] {
    try {
      const urlObj = new URL(url);
      const keywords: string[] = [];

      // Add domain (without www)
      const domain = urlObj.hostname.replace(/^www\./, '');
      keywords.push(domain);

      // Extract technology/service names from common domains
      const techKeywords = this.getTechKeywordsFromDomain(domain);
      keywords.push(...techKeywords);

      // Extract meaningful path segments
      const pathSegments = urlObj.pathname
        .split('/')
        .filter(segment => segment.length > 2 && !segment.match(/^\d+$/))
        .slice(0, 3); // Limit to first 3 meaningful segments

      keywords.push(...pathSegments);

      return keywords.filter(keyword => keyword.length > 2);
    } catch {
      return [];
    }
  }

  /**
   * Get technology keywords from domain
   */
  private static getTechKeywordsFromDomain(domain: string): string[] {
    const techMap: Record<string, string[]> = {
      'github.com': ['github', 'git', 'code', 'repository', 'development'],
      'stackoverflow.com': ['stackoverflow', 'programming', 'coding', 'development'],
      'docs.microsoft.com': ['microsoft', 'documentation', 'docs', 'azure'],
      'developer.mozilla.org': ['mdn', 'mozilla', 'web', 'javascript', 'css', 'html'],
      'reactjs.org': ['react', 'javascript', 'frontend', 'web'],
      'nodejs.org': ['nodejs', 'javascript', 'backend', 'server'],
      'python.org': ['python', 'programming', 'development'],
      'rust-lang.org': ['rust', 'programming', 'systems'],
      'go.dev': ['golang', 'go', 'programming', 'google'],
      'docker.com': ['docker', 'containers', 'devops'],
      'kubernetes.io': ['kubernetes', 'k8s', 'containers', 'orchestration'],
      'aws.amazon.com': ['aws', 'amazon', 'cloud', 'infrastructure'],
      'cloud.google.com': ['gcp', 'google', 'cloud', 'infrastructure'],
      'azure.microsoft.com': ['azure', 'microsoft', 'cloud', 'infrastructure'],
      'medium.com': ['medium', 'articles', 'blog', 'reading'],
      'dev.to': ['dev', 'development', 'programming', 'community'],
      'hashnode.com': ['hashnode', 'blog', 'development', 'articles'],
    };

    return techMap[domain] || [];
  }

  /**
   * Check if two URLs are the same (ignoring protocol and www)
   */
  private static isSameUrl(url1: string, url2: string): boolean {
    try {
      const normalize = (url: string) => {
        const urlObj = new URL(url);
        return `${urlObj.hostname.replace(/^www\./, '')}${urlObj.pathname}${urlObj.search}`;
      };

      return normalize(url1) === normalize(url2);
    } catch {
      return url1 === url2;
    }
  }
}