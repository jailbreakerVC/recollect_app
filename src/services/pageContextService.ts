import { Logger } from '../utils/logger';

export interface PageContext {
  title: string;
  url: string;
  description?: string;
  keywords?: string[];
  content?: string;
  domain: string;
  technology?: string[];
}

export class PageContextService {
  /**
   * Extract page context from the current tab
   */
  static async extractPageContext(): Promise<PageContext | null> {
    try {
      // This will be called from the extension content script
      const context: PageContext = {
        title: document.title || '',
        url: window.location.href,
        domain: window.location.hostname.replace(/^www\./, ''),
        description: this.extractDescription(),
        keywords: this.extractKeywords(),
        content: this.extractMainContent(),
        technology: this.detectTechnology()
      };

      Logger.info('PageContextService', 'Extracted page context', context);
      return context;
    } catch (error) {
      Logger.error('PageContextService', 'Failed to extract page context', error);
      return null;
    }
  }

  /**
   * Extract page description from meta tags
   */
  private static extractDescription(): string | undefined {
    const metaDescription = document.querySelector('meta[name="description"]') as HTMLMetaElement;
    if (metaDescription?.content) {
      return metaDescription.content.trim();
    }

    const ogDescription = document.querySelector('meta[property="og:description"]') as HTMLMetaElement;
    if (ogDescription?.content) {
      return ogDescription.content.trim();
    }

    // Fallback: extract from first paragraph
    const firstParagraph = document.querySelector('p');
    if (firstParagraph?.textContent) {
      return firstParagraph.textContent.trim().substring(0, 200);
    }

    return undefined;
  }

  /**
   * Extract keywords from meta tags and content
   */
  private static extractKeywords(): string[] {
    const keywords: Set<string> = new Set();

    // Meta keywords
    const metaKeywords = document.querySelector('meta[name="keywords"]') as HTMLMetaElement;
    if (metaKeywords?.content) {
      metaKeywords.content.split(',').forEach(keyword => {
        const clean = keyword.trim().toLowerCase();
        if (clean.length > 2) keywords.add(clean);
      });
    }

    // Extract from headings
    const headings = document.querySelectorAll('h1, h2, h3');
    headings.forEach(heading => {
      if (heading.textContent) {
        const words = heading.textContent
          .toLowerCase()
          .split(/\s+/)
          .filter(word => word.length > 3 && !this.isStopWord(word));
        words.forEach(word => keywords.add(word));
      }
    });

    // Extract from title
    if (document.title) {
      const titleWords = document.title
        .toLowerCase()
        .split(/\s+/)
        .filter(word => word.length > 3 && !this.isStopWord(word));
      titleWords.forEach(word => keywords.add(word));
    }

    return Array.from(keywords).slice(0, 10); // Limit to 10 keywords
  }

  /**
   * Extract main content from the page
   */
  private static extractMainContent(): string | undefined {
    // Try to find main content areas
    const contentSelectors = [
      'main',
      'article',
      '[role="main"]',
      '.content',
      '.main-content',
      '.post-content',
      '.entry-content',
      '#content',
      '#main'
    ];

    for (const selector of contentSelectors) {
      const element = document.querySelector(selector);
      if (element?.textContent) {
        return this.cleanTextContent(element.textContent);
      }
    }

    // Fallback: extract from body but filter out navigation, footer, etc.
    const body = document.body;
    if (body) {
      // Clone body and remove unwanted elements
      const clone = body.cloneNode(true) as HTMLElement;
      
      // Remove navigation, footer, sidebar, ads, etc.
      const unwantedSelectors = [
        'nav', 'header', 'footer', 'aside',
        '.nav', '.navigation', '.menu', '.sidebar',
        '.footer', '.header', '.ads', '.advertisement',
        'script', 'style', 'noscript'
      ];

      unwantedSelectors.forEach(selector => {
        clone.querySelectorAll(selector).forEach(el => el.remove());
      });

      return this.cleanTextContent(clone.textContent || '');
    }

    return undefined;
  }

  /**
   * Detect technology/framework from page content
   */
  private static detectTechnology(): string[] {
    const technologies: Set<string> = new Set();

    // Check for common frameworks/libraries in scripts
    const scripts = Array.from(document.scripts);
    scripts.forEach(script => {
      const src = script.src.toLowerCase();
      const content = script.textContent?.toLowerCase() || '';

      // React
      if (src.includes('react') || content.includes('react')) {
        technologies.add('react');
      }
      
      // Vue
      if (src.includes('vue') || content.includes('vue')) {
        technologies.add('vue');
      }
      
      // Angular
      if (src.includes('angular') || content.includes('angular')) {
        technologies.add('angular');
      }
      
      // jQuery
      if (src.includes('jquery') || content.includes('jquery')) {
        technologies.add('jquery');
      }

      // Node.js indicators
      if (content.includes('node') || content.includes('npm')) {
        technologies.add('nodejs');
      }
    });

    // Check meta tags for generators
    const generator = document.querySelector('meta[name="generator"]') as HTMLMetaElement;
    if (generator?.content) {
      const gen = generator.content.toLowerCase();
      if (gen.includes('wordpress')) technologies.add('wordpress');
      if (gen.includes('drupal')) technologies.add('drupal');
      if (gen.includes('joomla')) technologies.add('joomla');
      if (gen.includes('gatsby')) technologies.add('gatsby');
      if (gen.includes('next')) technologies.add('nextjs');
      if (gen.includes('nuxt')) technologies.add('nuxtjs');
    }

    // Check for CSS frameworks
    const stylesheets = Array.from(document.styleSheets);
    stylesheets.forEach(sheet => {
      try {
        const href = (sheet.ownerNode as HTMLLinkElement)?.href?.toLowerCase() || '';
        if (href.includes('bootstrap')) technologies.add('bootstrap');
        if (href.includes('tailwind')) technologies.add('tailwindcss');
        if (href.includes('bulma')) technologies.add('bulma');
      } catch (e) {
        // Cross-origin stylesheets may throw errors
      }
    });

    return Array.from(technologies);
  }

  /**
   * Clean and truncate text content
   */
  private static cleanTextContent(text: string): string {
    return text
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[^\w\s.,!?-]/g, '') // Remove special characters
      .trim()
      .substring(0, 500); // Limit length
  }

  /**
   * Check if a word is a stop word
   */
  private static isStopWord(word: string): boolean {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during',
      'before', 'after', 'above', 'below', 'between', 'among', 'this', 'that',
      'these', 'those', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'must', 'can', 'shall'
    ]);
    
    return stopWords.has(word.toLowerCase());
  }
}