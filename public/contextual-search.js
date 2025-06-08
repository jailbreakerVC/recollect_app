// Contextual Search Content Script for Chrome Extension
class ContextualSearchManager {
  constructor() {
    this.isInitialized = false;
    this.searchResults = [];
    this.currentContext = null;
    
    this.init();
  }

  init() {
    console.log('🔍 Contextual Search Manager initializing...');
    
    this.setupMessageHandlers();
    this.extractPageContext();
    
    this.isInitialized = true;
    console.log('✅ Contextual Search Manager initialized');
  }

  setupMessageHandlers() {
    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      return this.handleMessage(request, sender, sendResponse);
    });

    // Listen for page changes
    let lastUrl = location.href;
    new MutationObserver(() => {
      const url = location.href;
      if (url !== lastUrl) {
        lastUrl = url;
        this.extractPageContext();
      }
    }).observe(document, { subtree: true, childList: true });
  }

  handleMessage(request, sender, sendResponse) {
    console.log('🔍 Contextual search received message:', request);
    
    switch (request.action) {
      case 'getPageContext':
        return this.handleGetPageContext(sendResponse);
      case 'searchRelatedBookmarks':
        return this.handleSearchRelatedBookmarks(request, sendResponse);
      case 'getSearchResults':
        return this.handleGetSearchResults(sendResponse);
      default:
        sendResponse({ success: false, error: 'Unknown action' });
        return false;
    }
  }

  handleGetPageContext(sendResponse) {
    try {
      const context = this.extractPageContext();
      sendResponse({ 
        success: true, 
        context: context 
      });
    } catch (error) {
      console.error('Failed to get page context:', error);
      sendResponse({ 
        success: false, 
        error: error.message 
      });
    }
    return false;
  }

  handleSearchRelatedBookmarks(request, sendResponse) {
    console.log('🔍 Searching for related bookmarks...');
    
    // Forward the search request to the web app
    this.searchRelatedBookmarks(request.context || this.currentContext)
      .then(results => {
        this.searchResults = results;
        sendResponse({ 
          success: true, 
          results: results 
        });
      })
      .catch(error => {
        console.error('Search failed:', error);
        sendResponse({ 
          success: false, 
          error: error.message 
        });
      });
    
    return true; // Keep message channel open
  }

  handleGetSearchResults(sendResponse) {
    sendResponse({ 
      success: true, 
      results: this.searchResults,
      context: this.currentContext
    });
    return false;
  }

  extractPageContext() {
    try {
      const context = {
        title: document.title || '',
        url: window.location.href,
        domain: window.location.hostname.replace(/^www\./, ''),
        description: this.extractDescription(),
        keywords: this.extractKeywords(),
        content: this.extractMainContent(),
        technology: this.detectTechnology(),
        timestamp: Date.now()
      };

      this.currentContext = context;
      console.log('🔍 Extracted page context:', context);
      
      // Notify background script of context change
      chrome.runtime.sendMessage({
        action: 'pageContextChanged',
        context: context
      }).catch(() => {
        // Background script might not be ready
        console.log('Background script not ready for context update');
      });

      return context;
    } catch (error) {
      console.error('Failed to extract page context:', error);
      return null;
    }
  }

  extractDescription() {
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription?.content) {
      return metaDescription.content.trim();
    }

    const ogDescription = document.querySelector('meta[property="og:description"]');
    if (ogDescription?.content) {
      return ogDescription.content.trim();
    }

    const firstParagraph = document.querySelector('p');
    if (firstParagraph?.textContent) {
      return firstParagraph.textContent.trim().substring(0, 200);
    }

    return undefined;
  }

  extractKeywords() {
    const keywords = new Set();

    // Meta keywords
    const metaKeywords = document.querySelector('meta[name="keywords"]');
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

    return Array.from(keywords).slice(0, 10);
  }

  extractMainContent() {
    const contentSelectors = [
      'main', 'article', '[role="main"]', '.content', '.main-content',
      '.post-content', '.entry-content', '#content', '#main'
    ];

    for (const selector of contentSelectors) {
      const element = document.querySelector(selector);
      if (element?.textContent) {
        return this.cleanTextContent(element.textContent);
      }
    }

    // Fallback to body content
    const body = document.body;
    if (body) {
      const clone = body.cloneNode(true);
      
      // Remove unwanted elements
      const unwantedSelectors = [
        'nav', 'header', 'footer', 'aside', '.nav', '.navigation',
        '.menu', '.sidebar', '.footer', '.header', '.ads',
        '.advertisement', 'script', 'style', 'noscript'
      ];

      unwantedSelectors.forEach(selector => {
        clone.querySelectorAll(selector).forEach(el => el.remove());
      });

      return this.cleanTextContent(clone.textContent || '');
    }

    return undefined;
  }

  detectTechnology() {
    const technologies = new Set();

    // Check scripts
    const scripts = Array.from(document.scripts);
    scripts.forEach(script => {
      const src = script.src.toLowerCase();
      const content = script.textContent?.toLowerCase() || '';

      if (src.includes('react') || content.includes('react')) technologies.add('react');
      if (src.includes('vue') || content.includes('vue')) technologies.add('vue');
      if (src.includes('angular') || content.includes('angular')) technologies.add('angular');
      if (src.includes('jquery') || content.includes('jquery')) technologies.add('jquery');
      if (content.includes('node') || content.includes('npm')) technologies.add('nodejs');
    });

    // Check meta generator
    const generator = document.querySelector('meta[name="generator"]');
    if (generator?.content) {
      const gen = generator.content.toLowerCase();
      if (gen.includes('wordpress')) technologies.add('wordpress');
      if (gen.includes('gatsby')) technologies.add('gatsby');
      if (gen.includes('next')) technologies.add('nextjs');
    }

    return Array.from(technologies);
  }

  cleanTextContent(text) {
    return text
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s.,!?-]/g, '')
      .trim()
      .substring(0, 500);
  }

  isStopWord(word) {
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

  async searchRelatedBookmarks(context) {
    if (!context) {
      throw new Error('No page context available');
    }

    // Send message to web app for semantic search
    return new Promise((resolve, reject) => {
      window.postMessage({
        source: 'bookmark-manager-extension',
        action: 'searchRelatedBookmarks',
        context: context,
        requestId: `search_${Date.now()}`
      }, window.location.origin);

      // Listen for response
      const responseHandler = (event) => {
        if (event.data.source === 'bookmark-manager-webapp' && 
            event.data.action === 'searchResults') {
          window.removeEventListener('message', responseHandler);
          
          if (event.data.success) {
            resolve(event.data.results || []);
          } else {
            reject(new Error(event.data.error || 'Search failed'));
          }
        }
      };

      window.addEventListener('message', responseHandler);

      // Timeout after 10 seconds
      setTimeout(() => {
        window.removeEventListener('message', responseHandler);
        reject(new Error('Search timeout'));
      }, 10000);
    });
  }
}

// Initialize contextual search manager
new ContextualSearchManager();