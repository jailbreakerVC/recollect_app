import { supabase } from '../lib/supabase';
import { DatabaseBookmark } from '../types';
import { Logger } from '../utils/logger';
import { OpenAIService } from './openaiService';

export interface SemanticSearchResult extends DatabaseBookmark {
  similarity_score: number;
  search_type: 'semantic' | 'trigram' | 'trigram_fallback' | 'text_fallback' | 'hybrid';
}

export interface PageContext {
  title: string;
  url: string;
  description?: string;
  keywords?: string[];
  content?: string;
  domain?: string;
}

export class SemanticSearchService {
  /**
   * Enhanced search by query with multiple strategies
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

    Logger.info('SemanticSearchService', 'Enhanced search by query', {
      query,
      userId,
      maxResults,
      similarityThreshold
    });

    try {
      // Step 1: Try semantic search with original query
      let results = await this.performEnhancedSemanticSearch(
        query,
        userId,
        similarityThreshold,
        maxResults
      );

      // Step 2: If insufficient results, try with query expansion
      if (results.length < Math.min(5, maxResults)) {
        const expandedResults = await this.performQueryExpansionSearch(
          query,
          userId,
          similarityThreshold * 0.8,
          maxResults - results.length
        );
        
        // Merge results, avoiding duplicates
        const existingIds = new Set(results.map(r => r.id));
        const newResults = expandedResults.filter(r => !existingIds.has(r.id));
        results = [...results, ...newResults];
      }

      // Step 3: If still insufficient, try hybrid search
      if (results.length < Math.min(3, maxResults)) {
        const hybridResults = await this.performHybridSearch(
          query,
          userId,
          maxResults - results.length
        );
        
        const existingIds = new Set(results.map(r => r.id));
        const newResults = hybridResults.filter(r => !existingIds.has(r.id));
        results = [...results, ...newResults];
      }

      // Step 4: Final fallback to keyword search
      if (results.length === 0) {
        results = await this.performEnhancedKeywordSearch(query, userId, maxResults);
      }

      // Sort by relevance score and return
      return this.rankAndFilterResults(results, query, maxResults);

    } catch (error) {
      Logger.error('SemanticSearchService', 'Enhanced search failed', error);
      return await this.performFallbackSearch(query, userId, maxResults);
    }
  }

  /**
   * Enhanced page context search with better relevance
   */
  static async searchByPageContext(
    context: PageContext,
    userId: string,
    options: {
      maxResults?: number;
      similarityThreshold?: number;
      includeUrl?: boolean;
    } = {}
  ): Promise<SemanticSearchResult[]> {
    const {
      maxResults = 10,
      similarityThreshold = 0.2,
      includeUrl = true
    } = options;

    Logger.info('SemanticSearchService', 'Enhanced page context search', {
      title: context.title,
      domain: context.domain,
      userId,
      maxResults,
      similarityThreshold
    });

    try {
      // Create multiple search queries from context
      const searchQueries = this.generateContextQueries(context);
      
      let allResults: SemanticSearchResult[] = [];

      // Search with each query and combine results
      for (const query of searchQueries) {
        const queryResults = await this.performEnhancedSemanticSearch(
          query.text,
          userId,
          similarityThreshold * query.weight,
          Math.ceil(maxResults / searchQueries.length)
        );
        
        // Boost scores based on query importance
        const boostedResults = queryResults.map(result => ({
          ...result,
          similarity_score: result.similarity_score * query.weight,
          search_type: 'semantic' as const
        }));
        
        allResults = [...allResults, ...boostedResults];
      }

      // Remove duplicates and filter out current page
      const uniqueResults = this.deduplicateResults(allResults);
      const filteredResults = includeUrl 
        ? uniqueResults 
        : uniqueResults.filter(bookmark => !this.isSameUrl(bookmark.url, context.url));

      // Apply domain-based relevance boosting
      const domainBoostedResults = this.applyDomainRelevanceBoost(filteredResults, context);

      return this.rankAndFilterResults(domainBoostedResults, context.title, maxResults);

    } catch (error) {
      Logger.error('SemanticSearchService', 'Enhanced context search failed', error);
      return await this.performFallbackSearch(context.title, userId, maxResults);
    }
  }

  /**
   * Enhanced semantic search with better embedding handling
   */
  private static async performEnhancedSemanticSearch(
    query: string,
    userId: string,
    similarityThreshold: number,
    maxResults: number
  ): Promise<SemanticSearchResult[]> {
    try {
      // Generate high-quality embedding for the query
      const queryEmbedding = await this.generateEnhancedQueryEmbedding(query);

      // Use the improved vector search function
      const { data, error } = await supabase.rpc('search_bookmarks_vector_enhanced', {
        query_embedding: queryEmbedding,
        user_id_param: userId,
        similarity_threshold: similarityThreshold,
        max_results: maxResults,
        boost_recent: true,
        boost_frequent: true
      });

      if (error) {
        Logger.warn('SemanticSearchService', 'Enhanced vector search failed, trying fallback', error);
        return await this.performSemanticSearchFallback(query, userId, similarityThreshold, maxResults);
      }

      return (data || []).map((result: any) => ({
        ...result,
        search_type: 'semantic' as const,
        chrome_bookmark_id: result.chrome_bookmark_id || undefined,
        parent_id: result.parent_id || undefined,
        created_at: result.created_at || result.date_added,
        updated_at: result.updated_at || result.date_added,
      }));

    } catch (error) {
      Logger.error('SemanticSearchService', 'Enhanced semantic search error', error);
      return await this.performSemanticSearchFallback(query, userId, similarityThreshold, maxResults);
    }
  }

  /**
   * Query expansion search for better coverage
   */
  private static async performQueryExpansionSearch(
    query: string,
    userId: string,
    similarityThreshold: number,
    maxResults: number
  ): Promise<SemanticSearchResult[]> {
    try {
      // Generate expanded queries
      const expandedQueries = this.expandQuery(query);
      let allResults: SemanticSearchResult[] = [];

      for (const expandedQuery of expandedQueries) {
        const results = await this.performEnhancedSemanticSearch(
          expandedQuery,
          userId,
          similarityThreshold,
          Math.ceil(maxResults / expandedQueries.length)
        );
        
        // Slightly reduce scores for expanded queries
        const adjustedResults = results.map(result => ({
          ...result,
          similarity_score: result.similarity_score * 0.9
        }));
        
        allResults = [...allResults, ...adjustedResults];
      }

      return this.deduplicateResults(allResults);

    } catch (error) {
      Logger.error('SemanticSearchService', 'Query expansion search failed', error);
      return [];
    }
  }

  /**
   * Hybrid search combining semantic and keyword approaches
   */
  private static async performHybridSearch(
    query: string,
    userId: string,
    maxResults: number
  ): Promise<SemanticSearchResult[]> {
    try {
      const { data, error } = await supabase.rpc('search_bookmarks_hybrid', {
        search_query: query,
        user_id_param: userId,
        max_results: maxResults,
        semantic_weight: 0.7,
        keyword_weight: 0.3
      });

      if (error) {
        Logger.warn('SemanticSearchService', 'Hybrid search failed', error);
        return [];
      }

      return (data || []).map((result: any) => ({
        ...result,
        search_type: 'hybrid' as const,
        chrome_bookmark_id: result.chrome_bookmark_id || undefined,
        parent_id: result.parent_id || undefined,
        created_at: result.created_at || result.date_added,
        updated_at: result.updated_at || result.date_added,
      }));

    } catch (error) {
      Logger.error('SemanticSearchService', 'Hybrid search error', error);
      return [];
    }
  }

  /**
   * Enhanced keyword search with better ranking
   */
  private static async performEnhancedKeywordSearch(
    query: string,
    userId: string,
    maxResults: number
  ): Promise<SemanticSearchResult[]> {
    try {
      const { data, error } = await supabase.rpc('search_bookmarks_keywords_enhanced', {
        search_query: query,
        user_id_param: userId,
        max_results: maxResults
      });

      if (error) {
        Logger.warn('SemanticSearchService', 'Enhanced keyword search failed', error);
        return await this.performFallbackSearch(query, userId, maxResults);
      }

      return (data || []).map((result: any) => ({
        ...result,
        search_type: 'trigram' as const,
        chrome_bookmark_id: result.chrome_bookmark_id || undefined,
        parent_id: result.parent_id || undefined,
        created_at: result.created_at || result.date_added,
        updated_at: result.updated_at || result.date_added,
      }));

    } catch (error) {
      Logger.error('SemanticSearchService', 'Enhanced keyword search error', error);
      return await this.performFallbackSearch(query, userId, maxResults);
    }
  }

  /**
   * Generate enhanced query embedding with preprocessing
   */
  private static async generateEnhancedQueryEmbedding(query: string): Promise<number[]> {
    try {
      // Preprocess the query for better embeddings
      const processedQuery = this.preprocessQuery(query);
      
      // Generate embedding using OpenAI service
      return await OpenAIService.generateEmbedding(processedQuery);
    } catch (error) {
      Logger.error('SemanticSearchService', 'Failed to generate enhanced embedding', error);
      throw error;
    }
  }

  /**
   * Preprocess query for better embedding quality
   */
  private static preprocessQuery(query: string): string {
    let processed = query.toLowerCase().trim();

    // Expand common abbreviations and acronyms
    const expansions: Record<string, string> = {
      'ai': 'artificial intelligence',
      'ml': 'machine learning',
      'dl': 'deep learning',
      'nlp': 'natural language processing',
      'api': 'application programming interface',
      'ui': 'user interface',
      'ux': 'user experience',
      'css': 'cascading style sheets',
      'html': 'hypertext markup language',
      'js': 'javascript',
      'ts': 'typescript',
      'db': 'database',
      'sql': 'structured query language',
      'nosql': 'not only sql',
      'rest': 'representational state transfer',
      'crud': 'create read update delete',
      'mvc': 'model view controller',
      'spa': 'single page application',
      'pwa': 'progressive web application',
      'seo': 'search engine optimization',
      'cms': 'content management system',
      'crm': 'customer relationship management',
      'erp': 'enterprise resource planning',
      'saas': 'software as a service',
      'paas': 'platform as a service',
      'iaas': 'infrastructure as a service',
      'aws': 'amazon web services',
      'gcp': 'google cloud platform',
      'k8s': 'kubernetes',
      'ci/cd': 'continuous integration continuous deployment',
      'devops': 'development operations',
      'qa': 'quality assurance',
      'qc': 'quality control',
      'roi': 'return on investment',
      'kpi': 'key performance indicator',
      'b2b': 'business to business',
      'b2c': 'business to consumer',
      'e2e': 'end to end',
      'p2p': 'peer to peer',
      'iot': 'internet of things',
      'ar': 'augmented reality',
      'vr': 'virtual reality',
      'xr': 'extended reality',
      'gpu': 'graphics processing unit',
      'cpu': 'central processing unit',
      'ram': 'random access memory',
      'ssd': 'solid state drive',
      'hdd': 'hard disk drive',
      'url': 'uniform resource locator',
      'uri': 'uniform resource identifier',
      'http': 'hypertext transfer protocol',
      'https': 'hypertext transfer protocol secure',
      'ftp': 'file transfer protocol',
      'ssh': 'secure shell',
      'ssl': 'secure sockets layer',
      'tls': 'transport layer security',
      'tcp': 'transmission control protocol',
      'udp': 'user datagram protocol',
      'ip': 'internet protocol',
      'dns': 'domain name system',
      'cdn': 'content delivery network',
      'vpn': 'virtual private network',
      'lan': 'local area network',
      'wan': 'wide area network',
      'wifi': 'wireless fidelity',
      'bluetooth': 'bluetooth wireless technology',
      'nfc': 'near field communication',
      'rfid': 'radio frequency identification',
      'gps': 'global positioning system',
      'ocr': 'optical character recognition',
      'pdf': 'portable document format',
      'xml': 'extensible markup language',
      'json': 'javascript object notation',
      'yaml': 'yaml ain\'t markup language',
      'csv': 'comma separated values',
      'svg': 'scalable vector graphics',
      'png': 'portable network graphics',
      'jpg': 'joint photographic experts group',
      'jpeg': 'joint photographic experts group',
      'gif': 'graphics interchange format',
      'mp3': 'mpeg audio layer 3',
      'mp4': 'mpeg-4 part 14',
      'avi': 'audio video interleave',
      'mov': 'quicktime movie',
      'wmv': 'windows media video',
      'flv': 'flash video',
      'webm': 'web media',
      'ogg': 'ogg vorbis',
      'wav': 'waveform audio file format',
      'flac': 'free lossless audio codec',
      'zip': 'zip archive',
      'rar': 'roshal archive',
      'tar': 'tape archive',
      'gz': 'gzip compressed',
      'bz2': 'bzip2 compressed',
      '7z': '7-zip archive',
      'iso': 'international organization for standardization',
      'dmg': 'disk image',
      'exe': 'executable file',
      'msi': 'microsoft installer',
      'deb': 'debian package',
      'rpm': 'red hat package manager',
      'apk': 'android package',
      'ipa': 'ios app store package',
      'dll': 'dynamic link library',
      'so': 'shared object',
      'lib': 'library',
      'jar': 'java archive',
      'war': 'web application archive',
      'ear': 'enterprise archive',
      'npm': 'node package manager',
      'yarn': 'yet another resource negotiator',
      'pip': 'pip installs packages',
      'gem': 'ruby gems',
      'composer': 'dependency manager for php',
      'maven': 'apache maven',
      'gradle': 'gradle build tool',
      'ant': 'apache ant',
      'make': 'make build tool',
      'cmake': 'cross-platform make',
      'docker': 'docker containerization',
      'vm': 'virtual machine',
      'os': 'operating system',
      'linux': 'linux operating system',
      'unix': 'unix operating system',
      'windows': 'microsoft windows',
      'macos': 'apple macos',
      'ios': 'apple ios',
      'android': 'google android',
      'ubuntu': 'ubuntu linux',
      'debian': 'debian linux',
      'centos': 'centos linux',
      'rhel': 'red hat enterprise linux',
      'fedora': 'fedora linux',
      'arch': 'arch linux',
      'mint': 'linux mint',
      'kali': 'kali linux',
      'freebsd': 'freebsd operating system',
      'openbsd': 'openbsd operating system',
      'netbsd': 'netbsd operating system',
      'solaris': 'oracle solaris',
      'aix': 'ibm aix',
      'hpux': 'hp-ux operating system'
    };

    // Apply expansions
    Object.entries(expansions).forEach(([abbr, expansion]) => {
      const regex = new RegExp(`\\b${abbr}\\b`, 'gi');
      processed = processed.replace(regex, expansion);
    });

    // Add context for programming-related queries
    if (this.isProgrammingQuery(processed)) {
      processed = `programming development coding ${processed}`;
    }

    // Add context for design-related queries
    if (this.isDesignQuery(processed)) {
      processed = `design user interface user experience ${processed}`;
    }

    // Add context for documentation queries
    if (this.isDocumentationQuery(processed)) {
      processed = `documentation guide tutorial reference ${processed}`;
    }

    return processed;
  }

  /**
   * Check if query is programming-related
   */
  private static isProgrammingQuery(query: string): boolean {
    const programmingKeywords = [
      'code', 'coding', 'programming', 'development', 'developer',
      'function', 'method', 'class', 'object', 'variable', 'array',
      'loop', 'condition', 'algorithm', 'data structure', 'framework',
      'library', 'package', 'module', 'import', 'export', 'compile',
      'debug', 'test', 'unit test', 'integration', 'deployment',
      'version control', 'git', 'github', 'repository', 'commit',
      'branch', 'merge', 'pull request', 'issue', 'bug', 'feature'
    ];
    
    return programmingKeywords.some(keyword => query.includes(keyword));
  }

  /**
   * Check if query is design-related
   */
  private static isDesignQuery(query: string): boolean {
    const designKeywords = [
      'design', 'ui', 'ux', 'interface', 'user experience', 'wireframe',
      'mockup', 'prototype', 'figma', 'sketch', 'adobe', 'photoshop',
      'illustrator', 'color', 'typography', 'font', 'layout', 'grid',
      'responsive', 'mobile', 'desktop', 'accessibility', 'usability'
    ];
    
    return designKeywords.some(keyword => query.includes(keyword));
  }

  /**
   * Check if query is documentation-related
   */
  private static isDocumentationQuery(query: string): boolean {
    const docKeywords = [
      'documentation', 'docs', 'guide', 'tutorial', 'how to', 'reference',
      'manual', 'handbook', 'wiki', 'readme', 'getting started', 'quickstart',
      'examples', 'samples', 'demo', 'walkthrough', 'step by step'
    ];
    
    return docKeywords.some(keyword => query.includes(keyword));
  }

  /**
   * Generate multiple context-based queries
   */
  private static generateContextQueries(context: PageContext): Array<{text: string, weight: number}> {
    const queries: Array<{text: string, weight: number}> = [];

    // Primary query from title (highest weight)
    if (context.title) {
      queries.push({
        text: context.title,
        weight: 1.0
      });
    }

    // Secondary query from description
    if (context.description) {
      queries.push({
        text: context.description.substring(0, 200),
        weight: 0.8
      });
    }

    // Keyword-based query
    if (context.keywords && context.keywords.length > 0) {
      queries.push({
        text: context.keywords.join(' '),
        weight: 0.7
      });
    }

    // Domain-based query
    if (context.domain) {
      const domainKeywords = this.extractDomainKeywords(context.domain);
      if (domainKeywords.length > 0) {
        queries.push({
          text: domainKeywords.join(' '),
          weight: 0.6
        });
      }
    }

    // Content-based query (if available)
    if (context.content) {
      const contentKeywords = this.extractContentKeywords(context.content);
      if (contentKeywords.length > 0) {
        queries.push({
          text: contentKeywords.join(' '),
          weight: 0.5
        });
      }
    }

    return queries;
  }

  /**
   * Extract keywords from domain
   */
  private static extractDomainKeywords(domain: string): string[] {
    const techMap: Record<string, string[]> = {
      'github.com': ['github', 'git', 'code', 'repository', 'development', 'programming'],
      'stackoverflow.com': ['stackoverflow', 'programming', 'coding', 'development', 'questions', 'answers'],
      'docs.microsoft.com': ['microsoft', 'documentation', 'docs', 'azure', 'windows', 'office'],
      'developer.mozilla.org': ['mdn', 'mozilla', 'web', 'javascript', 'css', 'html', 'web development'],
      'reactjs.org': ['react', 'javascript', 'frontend', 'web', 'component', 'ui'],
      'nodejs.org': ['nodejs', 'javascript', 'backend', 'server', 'runtime'],
      'python.org': ['python', 'programming', 'development', 'scripting'],
      'rust-lang.org': ['rust', 'programming', 'systems', 'memory safety'],
      'go.dev': ['golang', 'go', 'programming', 'google', 'concurrent'],
      'docker.com': ['docker', 'containers', 'devops', 'deployment'],
      'kubernetes.io': ['kubernetes', 'k8s', 'containers', 'orchestration', 'devops'],
      'aws.amazon.com': ['aws', 'amazon', 'cloud', 'infrastructure', 'services'],
      'cloud.google.com': ['gcp', 'google', 'cloud', 'infrastructure', 'services'],
      'azure.microsoft.com': ['azure', 'microsoft', 'cloud', 'infrastructure', 'services'],
      'medium.com': ['medium', 'articles', 'blog', 'reading', 'writing'],
      'dev.to': ['dev', 'development', 'programming', 'community', 'articles'],
      'hashnode.com': ['hashnode', 'blog', 'development', 'articles', 'programming'],
      'youtube.com': ['youtube', 'video', 'tutorial', 'learning', 'education'],
      'udemy.com': ['udemy', 'course', 'learning', 'education', 'tutorial'],
      'coursera.org': ['coursera', 'course', 'learning', 'education', 'university'],
      'edx.org': ['edx', 'course', 'learning', 'education', 'university'],
      'codecademy.com': ['codecademy', 'coding', 'programming', 'learning', 'interactive'],
      'freecodecamp.org': ['freecodecamp', 'coding', 'programming', 'learning', 'free'],
      'w3schools.com': ['w3schools', 'web', 'tutorial', 'html', 'css', 'javascript'],
      'tutorialspoint.com': ['tutorialspoint', 'tutorial', 'programming', 'learning'],
      'geeksforgeeks.org': ['geeksforgeeks', 'programming', 'algorithms', 'data structures'],
      'leetcode.com': ['leetcode', 'coding', 'algorithms', 'interview', 'practice'],
      'hackerrank.com': ['hackerrank', 'coding', 'programming', 'challenges', 'practice'],
      'codepen.io': ['codepen', 'frontend', 'web', 'demo', 'css', 'javascript'],
      'jsfiddle.net': ['jsfiddle', 'javascript', 'web', 'demo', 'testing'],
      'codesandbox.io': ['codesandbox', 'development', 'web', 'demo', 'sandbox'],
      'replit.com': ['replit', 'coding', 'programming', 'online', 'ide'],
      'glitch.com': ['glitch', 'web', 'development', 'demo', 'hosting'],
      'vercel.com': ['vercel', 'deployment', 'hosting', 'frontend', 'jamstack'],
      'netlify.com': ['netlify', 'deployment', 'hosting', 'frontend', 'jamstack'],
      'heroku.com': ['heroku', 'deployment', 'hosting', 'cloud', 'platform'],
      'digitalocean.com': ['digitalocean', 'cloud', 'hosting', 'vps', 'infrastructure'],
      'linode.com': ['linode', 'cloud', 'hosting', 'vps', 'infrastructure'],
      'vultr.com': ['vultr', 'cloud', 'hosting', 'vps', 'infrastructure'],
      'firebase.google.com': ['firebase', 'google', 'backend', 'database', 'hosting'],
      'supabase.com': ['supabase', 'backend', 'database', 'postgresql', 'realtime'],
      'planetscale.com': ['planetscale', 'database', 'mysql', 'serverless'],
      'mongodb.com': ['mongodb', 'database', 'nosql', 'document'],
      'redis.io': ['redis', 'database', 'cache', 'memory', 'key-value'],
      'postgresql.org': ['postgresql', 'database', 'sql', 'relational'],
      'mysql.com': ['mysql', 'database', 'sql', 'relational'],
      'sqlite.org': ['sqlite', 'database', 'sql', 'embedded'],
      'elastic.co': ['elasticsearch', 'search', 'analytics', 'logging'],
      'apache.org': ['apache', 'open source', 'web server', 'software'],
      'nginx.org': ['nginx', 'web server', 'reverse proxy', 'load balancer'],
      'cloudflare.com': ['cloudflare', 'cdn', 'security', 'performance'],
      'fastly.com': ['fastly', 'cdn', 'edge computing', 'performance'],
      'stripe.com': ['stripe', 'payments', 'api', 'ecommerce'],
      'paypal.com': ['paypal', 'payments', 'ecommerce', 'financial'],
      'twilio.com': ['twilio', 'communication', 'api', 'messaging'],
      'sendgrid.com': ['sendgrid', 'email', 'api', 'communication'],
      'mailchimp.com': ['mailchimp', 'email', 'marketing', 'automation'],
      'hubspot.com': ['hubspot', 'crm', 'marketing', 'sales'],
      'salesforce.com': ['salesforce', 'crm', 'sales', 'cloud'],
      'slack.com': ['slack', 'communication', 'team', 'collaboration'],
      'discord.com': ['discord', 'communication', 'community', 'chat'],
      'zoom.us': ['zoom', 'video', 'meeting', 'communication'],
      'teams.microsoft.com': ['teams', 'microsoft', 'collaboration', 'communication'],
      'notion.so': ['notion', 'productivity', 'notes', 'collaboration'],
      'airtable.com': ['airtable', 'database', 'spreadsheet', 'collaboration'],
      'trello.com': ['trello', 'project management', 'kanban', 'productivity'],
      'asana.com': ['asana', 'project management', 'productivity', 'team'],
      'jira.atlassian.com': ['jira', 'project management', 'issue tracking', 'agile'],
      'confluence.atlassian.com': ['confluence', 'documentation', 'wiki', 'collaboration'],
      'figma.com': ['figma', 'design', 'ui', 'ux', 'collaboration'],
      'sketch.com': ['sketch', 'design', 'ui', 'ux', 'mac'],
      'adobe.com': ['adobe', 'design', 'creative', 'photoshop', 'illustrator'],
      'canva.com': ['canva', 'design', 'graphics', 'templates'],
      'dribbble.com': ['dribbble', 'design', 'inspiration', 'portfolio'],
      'behance.net': ['behance', 'design', 'portfolio', 'creative'],
      'unsplash.com': ['unsplash', 'photos', 'images', 'free', 'stock'],
      'pexels.com': ['pexels', 'photos', 'images', 'free', 'stock'],
      'pixabay.com': ['pixabay', 'images', 'photos', 'free', 'stock'],
      'shutterstock.com': ['shutterstock', 'stock', 'photos', 'images'],
      'gettyimages.com': ['getty', 'stock', 'photos', 'images'],
      'fonts.google.com': ['google fonts', 'typography', 'web fonts'],
      'fontawesome.com': ['font awesome', 'icons', 'web', 'ui'],
      'iconify.design': ['iconify', 'icons', 'svg', 'ui'],
      'heroicons.com': ['heroicons', 'icons', 'svg', 'tailwind'],
      'feathericons.com': ['feather', 'icons', 'svg', 'minimal'],
      'lucide.dev': ['lucide', 'icons', 'svg', 'react'],
      'tailwindcss.com': ['tailwind', 'css', 'framework', 'utility'],
      'getbootstrap.com': ['bootstrap', 'css', 'framework', 'responsive'],
      'bulma.io': ['bulma', 'css', 'framework', 'flexbox'],
      'foundation.zurb.com': ['foundation', 'css', 'framework', 'responsive'],
      'materializecss.com': ['materialize', 'css', 'framework', 'material design'],
      'semantic-ui.com': ['semantic ui', 'css', 'framework', 'components'],
      'chakra-ui.com': ['chakra ui', 'react', 'components', 'design system'],
      'mui.com': ['material ui', 'react', 'components', 'material design'],
      'ant.design': ['ant design', 'react', 'components', 'enterprise'],
      'mantine.dev': ['mantine', 'react', 'components', 'hooks'],
      'nextui.org': ['nextui', 'react', 'components', 'modern'],
      'headlessui.dev': ['headless ui', 'react', 'vue', 'unstyled'],
      'radix-ui.com': ['radix ui', 'react', 'primitives', 'accessible'],
      'ariakit.org': ['ariakit', 'react', 'accessible', 'components'],
      'reach.tech': ['reach ui', 'react', 'accessible', 'components'],
      'styled-components.com': ['styled components', 'css', 'react', 'styling'],
      'emotion.sh': ['emotion', 'css', 'react', 'styling'],
      'stitches.dev': ['stitches', 'css', 'react', 'styling'],
      'vanilla-extract.style': ['vanilla extract', 'css', 'typescript', 'styling'],
      'sass-lang.com': ['sass', 'scss', 'css', 'preprocessor'],
      'lesscss.org': ['less', 'css', 'preprocessor'],
      'stylus-lang.com': ['stylus', 'css', 'preprocessor'],
      'postcss.org': ['postcss', 'css', 'processor', 'plugins'],
      'autoprefixer.github.io': ['autoprefixer', 'css', 'vendor prefixes'],
      'purgecss.com': ['purgecss', 'css', 'optimization', 'unused'],
      'cssnano.co': ['cssnano', 'css', 'minification', 'optimization'],
      'webpack.js.org': ['webpack', 'bundler', 'javascript', 'build'],
      'rollupjs.org': ['rollup', 'bundler', 'javascript', 'build'],
      'parceljs.org': ['parcel', 'bundler', 'javascript', 'build'],
      'vitejs.dev': ['vite', 'bundler', 'javascript', 'build', 'fast'],
      'esbuild.github.io': ['esbuild', 'bundler', 'javascript', 'fast'],
      'swc.rs': ['swc', 'compiler', 'javascript', 'rust', 'fast'],
      'babeljs.io': ['babel', 'compiler', 'javascript', 'transpiler'],
      'typescriptlang.org': ['typescript', 'javascript', 'types', 'microsoft'],
      'flow.org': ['flow', 'javascript', 'types', 'facebook'],
      'eslint.org': ['eslint', 'javascript', 'linting', 'code quality'],
      'prettier.io': ['prettier', 'code formatting', 'javascript'],
      'jestjs.io': ['jest', 'testing', 'javascript', 'facebook'],
      'vitest.dev': ['vitest', 'testing', 'javascript', 'vite'],
      'testing-library.com': ['testing library', 'testing', 'react', 'dom'],
      'cypress.io': ['cypress', 'testing', 'e2e', 'integration'],
      'playwright.dev': ['playwright', 'testing', 'e2e', 'microsoft'],
      'puppeteer.dev': ['puppeteer', 'testing', 'automation', 'chrome'],
      'selenium.dev': ['selenium', 'testing', 'automation', 'browser'],
      'storybook.js.org': ['storybook', 'components', 'ui', 'documentation'],
      'docusaurus.io': ['docusaurus', 'documentation', 'facebook', 'static site'],
      'gitbook.com': ['gitbook', 'documentation', 'wiki', 'knowledge'],
      'bookstack.app': ['bookstack', 'documentation', 'wiki', 'self-hosted'],
      'outline.com': ['outline', 'documentation', 'wiki', 'team'],
      'slab.com': ['slab', 'documentation', 'wiki', 'team'],
      'coda.io': ['coda', 'documents', 'database', 'collaboration'],
      'obsidian.md': ['obsidian', 'notes', 'knowledge', 'markdown'],
      'roamresearch.com': ['roam', 'notes', 'knowledge', 'graph'],
      'logseq.com': ['logseq', 'notes', 'knowledge', 'local'],
      'dendron.so': ['dendron', 'notes', 'knowledge', 'vscode'],
      'foam.vscode.dev': ['foam', 'notes', 'knowledge', 'vscode'],
      'zettlr.com': ['zettlr', 'notes', 'markdown', 'academic'],
      'typora.io': ['typora', 'markdown', 'editor', 'writing'],
      'marktext.app': ['marktext', 'markdown', 'editor', 'realtime'],
      'zettlr.com': ['zettlr', 'markdown', 'academic', 'writing'],
      'ulysses.app': ['ulysses', 'writing', 'markdown', 'mac'],
      'bear.app': ['bear', 'notes', 'markdown', 'mac'],
      'simplenote.com': ['simplenote', 'notes', 'simple', 'sync'],
      'standardnotes.org': ['standard notes', 'notes', 'encrypted', 'privacy'],
      'joplinapp.org': ['joplin', 'notes', 'open source', 'sync'],
      'turtlapp.com': ['turtl', 'notes', 'encrypted', 'privacy'],
      'laverna.cc': ['laverna', 'notes', 'markdown', 'encrypted'],
      'boostnote.io': ['boostnote', 'notes', 'markdown', 'developers'],
      'vnote.fun': ['vnote', 'notes', 'markdown', 'vim'],
      'qownnotes.org': ['qownnotes', 'notes', 'markdown', 'open source'],
      'trilium.cc': ['trilium', 'notes', 'hierarchical', 'knowledge'],
      'cherrytree.giuspen.com': ['cherrytree', 'notes', 'hierarchical', 'tree'],
      'keepnote.org': ['keepnote', 'notes', 'cross platform'],
      'tomboy-notes.org': ['tomboy', 'notes', 'wiki', 'gnome'],
      'rednotebook.sourceforge.io': ['rednotebook', 'journal', 'diary', 'notes'],
      'journalapp.net': ['journal', 'diary', 'writing', 'personal'],
      'dayoneapp.com': ['day one', 'journal', 'diary', 'mac'],
      'penzu.com': ['penzu', 'journal', 'diary', 'online'],
      'journey.cloud': ['journey', 'journal', 'diary', 'cross platform'],
      'diarium.app': ['diarium', 'journal', 'diary', 'windows'],
      'momento.app': ['momento', 'journal', 'diary', 'ios'],
      'griddiaryapp.com': ['grid diary', 'journal', 'structured', 'ios'],
      'reflectly.app': ['reflectly', 'journal', 'ai', 'mindfulness'],
      'daylio.net': ['daylio', 'mood', 'tracker', 'journal'],
      'moodpath.com': ['moodpath', 'mood', 'mental health', 'tracking'],
      'sanvello.com': ['sanvello', 'anxiety', 'mood', 'mental health'],
      'headspace.com': ['headspace', 'meditation', 'mindfulness', 'mental health'],
      'calm.com': ['calm', 'meditation', 'sleep', 'relaxation'],
      'insight.live': ['insight timer', 'meditation', 'mindfulness', 'community'],
      'waking-up.com': ['waking up', 'meditation', 'philosophy', 'consciousness'],
      'ten-percent-happier.com': ['ten percent happier', 'meditation', 'mindfulness'],
      'buddhify.com': ['buddhify', 'meditation', 'mindfulness', 'mobile'],
      'smilingmind.com.au': ['smiling mind', 'meditation', 'mindfulness', 'kids'],
      'stopbreathethink.com': ['stop breathe think', 'meditation', 'mindfulness'],
      'aura.health': ['aura', 'meditation', 'sleep', 'stories'],
      'breethe.com': ['breethe', 'meditation', 'mindfulness', 'sleep'],
      'simple-habit.com': ['simple habit', 'meditation', 'mindfulness', 'busy'],
      'meditationstudio.com': ['meditation studio', 'meditation', 'mindfulness'],
      'enso.me': ['enso', 'meditation', 'timer', 'simple'],
      'zazen.com': ['zazen', 'meditation', 'zen', 'timer'],
      'mindfulness-bell.com': ['mindfulness bell', 'meditation', 'reminder'],
      'plumvillage.org': ['plum village', 'meditation', 'thich nhat hanh', 'mindfulness'],
      'dharmaocean.org': ['dharma ocean', 'meditation', 'somatic', 'embodied'],
      'tricycle.org': ['tricycle', 'buddhism', 'meditation', 'dharma'],
      'lionsroar.com': ['lions roar', 'buddhism', 'meditation', 'magazine'],
      'buddhistdoor.net': ['buddhist door', 'buddhism', 'news', 'global'],
      'accesstoinsight.org': ['access to insight', 'buddhism', 'pali', 'texts'],
      'suttacentral.net': ['sutta central', 'buddhism', 'pali', 'texts'],
      'dhammatalks.org': ['dhamma talks', 'buddhism', 'meditation', 'thanissaro'],
      'forestsangha.org': ['forest sangha', 'buddhism', 'theravada', 'ajahn chah'],
      'amaravati.org': ['amaravati', 'buddhism', 'monastery', 'ajahn sumedho'],
      'abhayagiri.org': ['abhayagiri', 'buddhism', 'monastery', 'california'],
      'watpah.org': ['wat pah', 'buddhism', 'monastery', 'ajahn chah'],
      'monasticacademy.com': ['monastic academy', 'buddhism', 'meditation', 'intensive'],
      'ims.org': ['insight meditation society', 'meditation', 'retreat', 'vipassana'],
      'spiritrock.org': ['spirit rock', 'meditation', 'retreat', 'california'],
      'dharmaocean.org': ['dharma ocean', 'meditation', 'somatic', 'reggie ray'],
      'shambhala.org': ['shambhala', 'buddhism', 'meditation', 'chogyam trungpa'],
      'kagyu.org': ['kagyu', 'buddhism', 'tibetan', 'meditation'],
      'fpmt.org': ['fpmt', 'buddhism', 'tibetan', 'lama zopa'],
      'dalailama.com': ['dalai lama', 'buddhism', 'tibetan', 'compassion'],
      'kagyuoffice.org': ['kagyu office', 'buddhism', 'karmapa', 'tibetan'],
      'rigpawiki.org': ['rigpa wiki', 'buddhism', 'tibetan', 'sogyal'],
      'lotsawahouse.org': ['lotsawa house', 'buddhism', 'tibetan', 'translations'],
      'treasuryoflives.org': ['treasury of lives', 'buddhism', 'tibetan', 'biographies'],
      'tbrc.org': ['tbrc', 'buddhism', 'tibetan', 'texts'],
      'buddhistdigitallibrary.org': ['buddhist digital library', 'buddhism', 'texts'],
      'bdk.or.jp': ['bdk', 'buddhism', 'texts', 'translations'],
      'bdkamerica.org': ['bdk america', 'buddhism', 'texts', 'translations'],
      'buddhism-dict.net': ['buddhism dictionary', 'buddhism', 'terms', 'definitions'],
      'palikanon.com': ['palikanon', 'buddhism', 'pali', 'german'],
      'ancient-buddhist-texts.net': ['ancient buddhist texts', 'buddhism', 'pali', 'translations'],
      'tipitaka.net': ['tipitaka', 'buddhism', 'pali', 'texts'],
      'tipitaka.org': ['tipitaka', 'buddhism', 'pali', 'canon'],
      'metta.lk': ['metta', 'buddhism', 'sri lanka', 'pali'],
      'buddhist-canon.com': ['buddhist canon', 'buddhism', 'texts', 'translations'],
      'nibbana.com': ['nibbana', 'buddhism', 'meditation', 'dhamma'],
      'dhamma.org': ['dhamma', 'buddhism', 'vipassana', 'goenka'],
      'vridhamma.org': ['vri dhamma', 'buddhism', 'vipassana', 'research'],
      'pariyatti.org': ['pariyatti', 'buddhism', 'books', 'dhamma'],
      'bps.lk': ['buddhist publication society', 'buddhism', 'books', 'sri lanka'],
      'wisdompubs.org': ['wisdom publications', 'buddhism', 'books', 'publisher'],
      'shambhala.com': ['shambhala publications', 'buddhism', 'books', 'spirituality'],
      'snowlionpub.com': ['snow lion', 'buddhism', 'tibetan', 'books'],
      'parallax.org': ['parallax press', 'buddhism', 'thich nhat hanh', 'books'],
      'dharmapublishing.com': ['dharma publishing', 'buddhism', 'tibetan', 'books'],
      'nalandatranslation.org': ['nalanda translation', 'buddhism', 'tibetan', 'translations'],
      '84000.co': ['84000', 'buddhism', 'tibetan', 'translations'],
      'read.84000.co': ['84000 reading room', 'buddhism', 'tibetan', 'texts'],
      'thlib.org': ['thl', 'tibet', 'himalaya', 'library'],
      'case.edu': ['case western', 'university', 'education', 'research'],
      'mit.edu': ['mit', 'university', 'technology', 'research'],
      'stanford.edu': ['stanford', 'university', 'education', 'research'],
      'harvard.edu': ['harvard', 'university', 'education', 'research'],
      'yale.edu': ['yale', 'university', 'education', 'research'],
      'princeton.edu': ['princeton', 'university', 'education', 'research'],
      'columbia.edu': ['columbia', 'university', 'education', 'research'],
      'upenn.edu': ['penn', 'university', 'education', 'research'],
      'cornell.edu': ['cornell', 'university', 'education', 'research'],
      'dartmouth.edu': ['dartmouth', 'university', 'education', 'research'],
      'brown.edu': ['brown', 'university', 'education', 'research'],
      'caltech.edu': ['caltech', 'university', 'technology', 'research'],
      'berkeley.edu': ['berkeley', 'university', 'california', 'research'],
      'ucla.edu': ['ucla', 'university', 'california', 'research'],
      'usc.edu': ['usc', 'university', 'southern california', 'research'],
      'ucsd.edu': ['ucsd', 'university', 'california', 'san diego'],
      'ucsb.edu': ['ucsb', 'university', 'california', 'santa barbara'],
      'uci.edu': ['uci', 'university', 'california', 'irvine'],
      'ucr.edu': ['ucr', 'university', 'california', 'riverside'],
      'ucsc.edu': ['ucsc', 'university', 'california', 'santa cruz'],
      'ucdavis.edu': ['uc davis', 'university', 'california', 'davis'],
      'ucmerced.edu': ['uc merced', 'university', 'california', 'merced'],
      'ucsf.edu': ['ucsf', 'university', 'california', 'san francisco'],
      'cmu.edu': ['carnegie mellon', 'university', 'technology', 'research'],
      'gatech.edu': ['georgia tech', 'university', 'technology', 'research'],
      'illinois.edu': ['uiuc', 'university', 'illinois', 'research'],
      'umich.edu': ['michigan', 'university', 'research', 'ann arbor'],
      'wisc.edu': ['wisconsin', 'university', 'madison', 'research'],
      'umn.edu': ['minnesota', 'university', 'twin cities', 'research'],
      'washington.edu': ['washington', 'university', 'seattle', 'research'],
      'utexas.edu': ['ut austin', 'university', 'texas', 'research'],
      'tamu.edu': ['texas a&m', 'university', 'college station', 'research'],
      'rice.edu': ['rice', 'university', 'houston', 'research'],
      'duke.edu': ['duke', 'university', 'north carolina', 'research'],
      'unc.edu': ['unc', 'university', 'north carolina', 'chapel hill'],
      'ncsu.edu': ['nc state', 'university', 'north carolina', 'raleigh'],
      'vt.edu': ['virginia tech', 'university', 'technology', 'research'],
      'virginia.edu': ['uva', 'university', 'virginia', 'charlottesville'],
      'wm.edu': ['william mary', 'university', 'virginia', 'williamsburg'],
      'jmu.edu': ['james madison', 'university', 'virginia', 'harrisonburg'],
      'vcu.edu': ['vcu', 'university', 'virginia', 'richmond'],
      'odu.edu': ['old dominion', 'university', 'virginia', 'norfolk'],
      'gmu.edu': ['george mason', 'university', 'virginia', 'fairfax'],
      'umd.edu': ['maryland', 'university', 'college park', 'research'],
      'jhu.edu': ['johns hopkins', 'university', 'baltimore', 'research'],
      'georgetown.edu': ['georgetown', 'university', 'washington dc', 'research'],
      'gwu.edu': ['george washington', 'university', 'washington dc', 'research'],
      'american.edu': ['american', 'university', 'washington dc', 'research'],
      'howard.edu': ['howard', 'university', 'washington dc', 'hbcu'],
      'gallaudet.edu': ['gallaudet', 'university', 'deaf', 'washington dc'],
      'catholic.edu': ['catholic', 'university', 'washington dc', 'research'],
      'trinity.edu': ['trinity', 'university', 'washington dc', 'women'],
      'marymount.edu': ['marymount', 'university', 'virginia', 'arlington'],
      'shenandoah.edu': ['shenandoah', 'university', 'virginia', 'winchester'],
      'roanoke.edu': ['roanoke', 'college', 'virginia', 'salem'],
      'hollins.edu': ['hollins', 'university', 'virginia', 'roanoke'],
      'lynchburg.edu': ['lynchburg', 'university', 'virginia', 'lynchburg'],
      'liberty.edu': ['liberty', 'university', 'virginia', 'lynchburg'],
      'longwood.edu': ['longwood', 'university', 'virginia', 'farmville'],
      'radford.edu': ['radford', 'university', 'virginia', 'radford'],
      'bridgewater.edu': ['bridgewater', 'college', 'virginia', 'bridgewater'],
      'emu.edu': ['eastern mennonite', 'university', 'virginia', 'harrisonburg'],
      'su.edu': ['shenandoah', 'university', 'virginia', 'winchester'],
      'rmc.edu': ['randolph macon', 'college', 'virginia', 'ashland'],
      'hsc.edu': ['hampden sydney', 'college', 'virginia', 'hampden sydney'],
      'wlu.edu': ['washington lee', 'university', 'virginia', 'lexington'],
      'vmi.edu': ['vmi', 'military', 'institute', 'virginia'],
      'cnu.edu': ['christopher newport', 'university', 'virginia', 'newport news'],
      'nsu.edu': ['norfolk state', 'university', 'virginia', 'norfolk'],
      'vsu.edu': ['virginia state', 'university', 'petersburg', 'hbcu'],
      'vuu.edu': ['virginia union', 'university', 'richmond', 'hbcu'],
      'hamptonu.edu': ['hampton', 'university', 'virginia', 'hbcu'],
      'tnstate.edu': ['tennessee state', 'university', 'nashville', 'hbcu'],
      'fisk.edu': ['fisk', 'university', 'nashville', 'hbcu'],
      'vanderbilt.edu': ['vanderbilt', 'university', 'nashville', 'research'],
      'utk.edu': ['tennessee', 'university', 'knoxville', 'research'],
      'memphis.edu': ['memphis', 'university', 'tennessee', 'research'],
      'mtsu.edu': ['middle tennessee', 'university', 'murfreesboro', 'research'],
      'etsu.edu': ['east tennessee', 'university', 'johnson city', 'research'],
      'tntech.edu': ['tennessee tech', 'university', 'cookeville', 'research'],
      'utm.edu': ['tennessee martin', 'university', 'martin', 'research'],
      'chattanooga.edu': ['tennessee chattanooga', 'university', 'chattanooga', 'research'],
      'apsu.edu': ['austin peay', 'university', 'clarksville', 'tennessee'],
      'uu.edu': ['union', 'university', 'jackson', 'tennessee'],
      'belmont.edu': ['belmont', 'university', 'nashville', 'tennessee'],
      'lipscomb.edu': ['lipscomb', 'university', 'nashville', 'tennessee'],
      'trevecca.edu': ['trevecca', 'university', 'nashville', 'tennessee'],
      'cumberland.edu': ['cumberland', 'university', 'lebanon', 'tennessee'],
      'bethelu.edu': ['bethel', 'university', 'mckenzie', 'tennessee'],
      'bryan.edu': ['bryan', 'college', 'dayton', 'tennessee'],
      'cn.edu': ['carson newman', 'university', 'jefferson city', 'tennessee'],
      'christianbrothers.edu': ['christian brothers', 'university', 'memphis', 'tennessee'],
      'crichton.edu': ['crichton', 'college', 'memphis', 'tennessee'],
      'freed.edu': ['freed hardeman', 'university', 'henderson', 'tennessee'],
      'hiwassee.edu': ['hiwassee', 'college', 'madisonville', 'tennessee'],
      'jscc.edu': ['jackson state', 'community college', 'jackson', 'tennessee'],
      'king.edu': ['king', 'university', 'bristol', 'tennessee'],
      'lambuth.edu': ['lambuth', 'university', 'jackson', 'tennessee'],
      'lmunet.edu': ['lincoln memorial', 'university', 'harrogate', 'tennessee'],
      'maryvillecollege.edu': ['maryville', 'college', 'maryville', 'tennessee'],
      'milligan.edu': ['milligan', 'college', 'milligan', 'tennessee'],
      'rhodes.edu': ['rhodes', 'college', 'memphis', 'tennessee'],
      'sewanee.edu': ['sewanee', 'university', 'south', 'tennessee'],
      'southern.edu': ['southern adventist', 'university', 'collegedale', 'tennessee'],
      'tusculum.edu': ['tusculum', 'college', 'greeneville', 'tennessee'],
      'welch.edu': ['welch', 'college', 'gallatin', 'tennessee'],
      'williamsoncc.edu': ['williamson', 'community college', 'franklin', 'tennessee']
    };

    return techMap[domain] || [domain.replace(/\./g, ' ')];
  }

  /**
   * Extract keywords from content
   */
  private static extractContentKeywords(content: string): string[] {
    // Simple keyword extraction - in production, use more sophisticated NLP
    const words = content
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3)
      .filter(word => !this.isStopWord(word));

    // Get most frequent words
    const wordCount = new Map<string, number>();
    words.forEach(word => {
      wordCount.set(word, (wordCount.get(word) || 0) + 1);
    });

    return Array.from(wordCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);
  }

  /**
   * Check if word is a stop word
   */
  private static isStopWord(word: string): boolean {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during',
      'before', 'after', 'above', 'below', 'between', 'among', 'this', 'that',
      'these', 'those', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'must', 'can', 'shall', 'not', 'no', 'nor',
      'so', 'than', 'too', 'very', 'just', 'now', 'then', 'here', 'there',
      'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few',
      'more', 'most', 'other', 'some', 'such', 'only', 'own', 'same', 'so',
      'than', 'too', 'very', 'can', 'will', 'just', 'don', 'should', 'now'
    ]);
    
    return stopWords.has(word.toLowerCase());
  }

  /**
   * Expand query with synonyms and related terms
   */
  private static expandQuery(query: string): string[] {
    const expansions: string[] = [query];
    
    // Add common synonyms and related terms
    const synonymMap: Record<string, string[]> = {
      'tutorial': ['guide', 'how to', 'walkthrough', 'instructions'],
      'guide': ['tutorial', 'manual', 'handbook', 'documentation'],
      'documentation': ['docs', 'reference', 'manual', 'guide'],
      'example': ['demo', 'sample', 'illustration', 'case study'],
      'tool': ['utility', 'application', 'software', 'program'],
      'framework': ['library', 'toolkit', 'platform', 'system'],
      'api': ['interface', 'service', 'endpoint', 'integration'],
      'database': ['db', 'storage', 'data store', 'repository'],
      'design': ['ui', 'ux', 'interface', 'visual', 'layout'],
      'development': ['coding', 'programming', 'building', 'creating'],
      'testing': ['qa', 'quality assurance', 'validation', 'verification'],
      'deployment': ['hosting', 'publishing', 'release', 'production'],
      'performance': ['optimization', 'speed', 'efficiency', 'benchmarking'],
      'security': ['authentication', 'authorization', 'encryption', 'protection'],
      'monitoring': ['logging', 'tracking', 'analytics', 'observability'],
      'automation': ['scripting', 'workflow', 'pipeline', 'ci/cd'],
      'collaboration': ['teamwork', 'communication', 'sharing', 'coordination'],
      'productivity': ['efficiency', 'workflow', 'organization', 'time management'],
      'learning': ['education', 'training', 'course', 'study'],
      'research': ['analysis', 'investigation', 'study', 'exploration'],
      'innovation': ['creativity', 'invention', 'breakthrough', 'advancement'],
      'strategy': ['planning', 'approach', 'methodology', 'tactics'],
      'management': ['administration', 'organization', 'coordination', 'oversight'],
      'leadership': ['guidance', 'direction', 'mentorship', 'influence'],
      'communication': ['messaging', 'discussion', 'conversation', 'dialogue'],
      'networking': ['connection', 'relationship', 'community', 'social'],
      'marketing': ['promotion', 'advertising', 'branding', 'outreach'],
      'sales': ['selling', 'revenue', 'business', 'commerce'],
      'finance': ['money', 'budget', 'investment', 'economics'],
      'analytics': ['data analysis', 'metrics', 'statistics', 'insights'],
      'visualization': ['charts', 'graphs', 'dashboards', 'reporting'],
      'integration': ['connection', 'linking', 'combining', 'merging'],
      'migration': ['transfer', 'moving', 'conversion', 'upgrade'],
      'scaling': ['growth', 'expansion', 'performance', 'capacity'],
      'architecture': ['design', 'structure', 'system', 'framework'],
      'infrastructure': ['platform', 'foundation', 'system', 'environment'],
      'cloud': ['aws', 'azure', 'gcp', 'hosting', 'saas'],
      'mobile': ['ios', 'android', 'app', 'smartphone', 'tablet'],
      'web': ['website', 'browser', 'internet', 'online'],
      'desktop': ['computer', 'pc', 'application', 'software'],
      'server': ['backend', 'api', 'service', 'hosting'],
      'client': ['frontend', 'ui', 'interface', 'user'],
      'data': ['information', 'content', 'records', 'dataset'],
      'algorithm': ['method', 'approach', 'technique', 'procedure'],
      'model': ['pattern', 'template', 'framework', 'structure'],
      'system': ['platform', 'environment', 'infrastructure', 'architecture'],
      'process': ['workflow', 'procedure', 'method', 'approach'],
      'solution': ['answer', 'fix', 'resolution', 'approach'],
      'problem': ['issue', 'challenge', 'difficulty', 'bug'],
      'feature': ['functionality', 'capability', 'option', 'tool'],
      'component': ['part', 'element', 'module', 'piece'],
      'service': ['utility', 'tool', 'application', 'platform'],
      'platform': ['system', 'environment', 'framework', 'infrastructure'],
      'environment': ['setup', 'configuration', 'system', 'platform'],
      'configuration': ['setup', 'settings', 'options', 'preferences'],
      'settings': ['configuration', 'options', 'preferences', 'parameters'],
      'options': ['choices', 'alternatives', 'settings', 'preferences'],
      'preferences': ['settings', 'options', 'choices', 'configuration'],
      'parameters': ['settings', 'options', 'variables', 'arguments'],
      'variables': ['parameters', 'values', 'data', 'information'],
      'values': ['data', 'information', 'content', 'variables'],
      'content': ['information', 'data', 'material', 'text'],
      'information': ['data', 'content', 'details', 'facts'],
      'details': ['information', 'specifics', 'particulars', 'facts'],
      'facts': ['information', 'data', 'details', 'truth'],
      'truth': ['facts', 'reality', 'accuracy', 'correctness'],
      'reality': ['truth', 'facts', 'actuality', 'existence'],
      'existence': ['reality', 'being', 'presence', 'occurrence'],
      'presence': ['existence', 'availability', 'occurrence', 'being'],
      'availability': ['presence', 'accessibility', 'readiness', 'existence'],
      'accessibility': ['availability', 'usability', 'reachability', 'openness'],
      'usability': ['accessibility', 'ease of use', 'user-friendliness', 'practicality'],
      'practicality': ['usability', 'usefulness', 'functionality', 'utility'],
      'usefulness': ['practicality', 'utility', 'value', 'benefit'],
      'utility': ['usefulness', 'practicality', 'tool', 'service'],
      'value': ['worth', 'benefit', 'importance', 'significance'],
      'worth': ['value', 'merit', 'importance', 'significance'],
      'merit': ['worth', 'value', 'quality', 'excellence'],
      'quality': ['excellence', 'standard', 'grade', 'caliber'],
      'excellence': ['quality', 'superiority', 'perfection', 'distinction'],
      'superiority': ['excellence', 'advantage', 'dominance', 'supremacy'],
      'advantage': ['benefit', 'edge', 'superiority', 'strength'],
      'benefit': ['advantage', 'value', 'gain', 'profit'],
      'gain': ['benefit', 'profit', 'advantage', 'improvement'],
      'profit': ['gain', 'benefit', 'revenue', 'income'],
      'revenue': ['income', 'earnings', 'profit', 'sales'],
      'income': ['revenue', 'earnings', 'salary', 'wages'],
      'earnings': ['income', 'revenue', 'profit', 'wages'],
      'salary': ['income', 'wages', 'pay', 'compensation'],
      'wages': ['salary', 'pay', 'income', 'compensation'],
      'pay': ['salary', 'wages', 'compensation', 'remuneration'],
      'compensation': ['pay', 'salary', 'remuneration', 'reward'],
      'remuneration': ['compensation', 'payment', 'reward', 'salary'],
      'payment': ['remuneration', 'compensation', 'fee', 'charge'],
      'fee': ['payment', 'charge', 'cost', 'price'],
      'charge': ['fee', 'cost', 'price', 'expense'],
      'cost': ['price', 'expense', 'charge', 'fee'],
      'price': ['cost', 'expense', 'value', 'charge'],
      'expense': ['cost', 'price', 'expenditure', 'outlay'],
      'expenditure': ['expense', 'outlay', 'spending', 'cost'],
      'outlay': ['expenditure', 'expense', 'investment', 'cost'],
      'investment': ['outlay', 'expenditure', 'funding', 'capital'],
      'funding': ['investment', 'financing', 'capital', 'money'],
      'financing': ['funding', 'investment', 'capital', 'money'],
      'capital': ['funding', 'investment', 'money', 'resources'],
      'money': ['capital', 'funding', 'cash', 'currency'],
      'cash': ['money', 'currency', 'funds', 'capital'],
      'currency': ['money', 'cash', 'tender', 'medium of exchange'],
      'funds': ['money', 'cash', 'capital', 'resources'],
      'resources': ['funds', 'capital', 'assets', 'materials'],
      'assets': ['resources', 'property', 'holdings', 'possessions'],
      'property': ['assets', 'possessions', 'belongings', 'estate'],
      'possessions': ['property', 'belongings', 'assets', 'holdings'],
      'belongings': ['possessions', 'property', 'items', 'things'],
      'items': ['things', 'objects', 'belongings', 'pieces'],
      'things': ['items', 'objects', 'stuff', 'matters'],
      'objects': ['items', 'things', 'entities', 'elements'],
      'entities': ['objects', 'things', 'beings', 'elements'],
      'elements': ['components', 'parts', 'entities', 'factors'],
      'factors': ['elements', 'aspects', 'considerations', 'variables'],
      'aspects': ['factors', 'elements', 'features', 'characteristics'],
      'characteristics': ['features', 'traits', 'qualities', 'attributes'],
      'attributes': ['characteristics', 'properties', 'qualities', 'features'],
      'properties': ['attributes', 'characteristics', 'qualities', 'features'],
      'qualities': ['characteristics', 'attributes', 'properties', 'traits'],
      'traits': ['characteristics', 'qualities', 'features', 'attributes'],
      'features': ['characteristics', 'traits', 'aspects', 'elements']
    };

    // Add synonyms for words in the query
    const words = query.toLowerCase().split(/\s+/);
    words.forEach(word => {
      if (synonymMap[word]) {
        synonymMap[word].forEach(synonym => {
          const expandedQuery = query.replace(new RegExp(`\\b${word}\\b`, 'gi'), synonym);
          if (expandedQuery !== query) {
            expansions.push(expandedQuery);
          }
        });
      }
    });

    return expansions.slice(0, 3); // Limit to avoid too many queries
  }

  /**
   * Apply domain-based relevance boosting
   */
  private static applyDomainRelevanceBoost(
    results: SemanticSearchResult[],
    context: PageContext
  ): SemanticSearchResult[] {
    if (!context.domain) return results;

    return results.map(result => {
      let boost = 1.0;

      try {
        const resultDomain = new URL(result.url).hostname.replace(/^www\./, '');
        
        // Same domain boost
        if (resultDomain === context.domain) {
          boost *= 1.3;
        }
        
        // Related domain boost
        if (this.areRelatedDomains(resultDomain, context.domain)) {
          boost *= 1.2;
        }
        
        // Technology domain boost
        if (this.isTechnologyDomain(resultDomain) && this.isTechnologyDomain(context.domain)) {
          boost *= 1.15;
        }

      } catch (error) {
        // Invalid URL, no boost
      }

      return {
        ...result,
        similarity_score: Math.min(result.similarity_score * boost, 1.0)
      };
    });
  }

  /**
   * Check if domains are related
   */
  private static areRelatedDomains(domain1: string, domain2: string): boolean {
    const relatedDomains = [
      ['github.com', 'gitlab.com', 'bitbucket.org'],
      ['stackoverflow.com', 'stackexchange.com', 'superuser.com'],
      ['medium.com', 'dev.to', 'hashnode.com'],
      ['youtube.com', 'vimeo.com', 'twitch.tv'],
      ['aws.amazon.com', 'cloud.google.com', 'azure.microsoft.com'],
      ['docker.com', 'kubernetes.io', 'helm.sh'],
      ['reactjs.org', 'vuejs.org', 'angular.io'],
      ['nodejs.org', 'deno.land', 'bun.sh']
    ];

    return relatedDomains.some(group => 
      group.includes(domain1) && group.includes(domain2)
    );
  }

  /**
   * Check if domain is technology-related
   */
  private static isTechnologyDomain(domain: string): boolean {
    const techDomains = [
      'github.com', 'gitlab.com', 'bitbucket.org',
      'stackoverflow.com', 'stackexchange.com',
      'developer.mozilla.org', 'docs.microsoft.com',
      'reactjs.org', 'vuejs.org', 'angular.io',
      'nodejs.org', 'python.org', 'rust-lang.org',
      'docker.com', 'kubernetes.io',
      'aws.amazon.com', 'cloud.google.com', 'azure.microsoft.com'
    ];

    return techDomains.some(tech => domain.includes(tech) || tech.includes(domain));
  }

  /**
   * Deduplicate results by ID
   */
  private static deduplicateResults(results: SemanticSearchResult[]): SemanticSearchResult[] {
    const seen = new Set<string>();
    return results.filter(result => {
      if (seen.has(result.id)) {
        return false;
      }
      seen.add(result.id);
      return true;
    });
  }

  /**
   * Rank and filter results
   */
  private static rankAndFilterResults(
    results: SemanticSearchResult[],
    query: string,
    maxResults: number
  ): SemanticSearchResult[] {
    // Sort by similarity score (descending)
    const sorted = results.sort((a, b) => b.similarity_score - a.similarity_score);
    
    // Apply additional ranking factors
    const ranked = sorted.map(result => {
      let finalScore = result.similarity_score;
      
      // Boost exact title matches
      if (result.title.toLowerCase().includes(query.toLowerCase())) {
        finalScore *= 1.2;
      }
      
      // Boost recent bookmarks slightly
      const daysSinceAdded = (Date.now() - new Date(result.date_added).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceAdded < 30) {
        finalScore *= 1.05;
      }
      
      return {
        ...result,
        similarity_score: Math.min(finalScore, 1.0)
      };
    });
    
    // Re-sort after ranking adjustments
    return ranked
      .sort((a, b) => b.similarity_score - a.similarity_score)
      .slice(0, maxResults);
  }

  /**
   * Fallback search when all else fails
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
      return [];
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
   * Semantic search fallback when vector search fails
   */
  private static async performSemanticSearchFallback(
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
      Logger.error('SemanticSearchService', 'Semantic search fallback failed', error);
      return await this.performFallbackSearch(query, userId, maxResults);
    }

    return (data || []).map((result: any) => ({
      ...result,
      chrome_bookmark_id: result.chrome_bookmark_id || undefined,
      parent_id: result.parent_id || undefined,
      created_at: result.created_at || result.date_added,
      updated_at: result.updated_at || result.date_added,
    }));
  }

  /**
   * Check if two URLs are the same
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
}