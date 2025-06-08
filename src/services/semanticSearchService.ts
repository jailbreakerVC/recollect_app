import { supabase } from '../lib/supabase';
import { DatabaseBookmark } from '../types';
import { Logger } from '../utils/logger';

export interface SemanticSearchResult extends DatabaseBookmark {
  similarity_score: number;
  search_type: 'semantic' | 'trigram' | 'trigram_fallback';
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

    // Create search query from page context
    const searchQuery = this.createSearchQueryFromContext(pageContext);
    
    try {
      const results = await this.performSemanticSearch(
        searchQuery,
        userId,
        similarityThreshold,
        maxResults
      );

      // Filter out the current page if it exists in bookmarks
      const filteredResults = includeUrl 
        ? results 
        : results.filter(bookmark => !this.isSameUrl(bookmark.url, pageContext.url));

      Logger.info('SemanticSearchService', `Found ${filteredResults.length} related bookmarks`);
      return filteredResults;

    } catch (error) {
      Logger.error('SemanticSearchService', 'Failed to search by page context', error);
      throw new Error(`Semantic search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      similarityThreshold = 0.3
    } = options;

    Logger.info('SemanticSearchService', 'Searching by query', {
      query,
      userId,
      maxResults,
      similarityThreshold
    });

    try {
      return await this.performSemanticSearch(
        query,
        userId,
        similarityThreshold,
        maxResults
      );
    } catch (error) {
      Logger.error('SemanticSearchService', 'Failed to search by query', error);
      throw new Error(`Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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