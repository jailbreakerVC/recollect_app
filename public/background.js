// Chrome Extension Background Script - Enhanced with Contextual Search
class BackgroundManager {
  constructor() {
    this.contextualSearchEnabled = true;
    this.lastPageContext = null;
    this.searchCache = new Map();
    
    this.init();
  }

  init() {
    console.log('🚀 Background script initializing with contextual search...');
    
    this.setupEventListeners();
    this.setupBookmarkListeners();
    this.setupContextualSearch();
    
    console.log('✅ Background script initialized successfully');
  }

  setupEventListeners() {
    // Handle extension installation
    chrome.runtime.onInstalled.addListener((details) => {
      this.handleInstallation(details);
    });

    // Handle extension startup
    chrome.runtime.onStartup.addListener(() => {
      console.log('Bookmark Manager Extension started');
    });

    // Handle messages from content scripts and popup
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      return this.handleMessage(request, sender, sendResponse);
    });

    // Keep service worker alive
    chrome.runtime.onConnect.addListener((port) => {
      console.log('Content script connected:', port.name);
    });
  }

  setupContextualSearch() {
    console.log('🔍 Setting up contextual search...');
    
    // Listen for tab updates to trigger contextual search
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && tab.url && this.isValidUrl(tab.url)) {
        this.handleTabUpdate(tabId, tab);
      }
    });

    // Listen for tab activation
    chrome.tabs.onActivated.addListener((activeInfo) => {
      chrome.tabs.get(activeInfo.tabId, (tab) => {
        if (tab.url && this.isValidUrl(tab.url)) {
          this.handleTabActivation(activeInfo.tabId, tab);
        }
      });
    });
  }

  isValidUrl(url) {
    return url && 
           !url.startsWith('chrome://') && 
           !url.startsWith('chrome-extension://') &&
           !url.startsWith('moz-extension://') &&
           !url.startsWith('about:') &&
           (url.startsWith('http://') || url.startsWith('https://'));
  }

  async handleTabUpdate(tabId, tab) {
    if (!this.contextualSearchEnabled) return;

    try {
      // Inject contextual search script if not already present
      await this.injectContextualSearchScript(tabId);
      
      // Small delay to let the page load
      setTimeout(() => {
        this.requestPageContext(tabId);
      }, 1000);
      
    } catch (error) {
      console.log('Could not inject contextual search script:', error.message);
    }
  }

  async handleTabActivation(tabId, tab) {
    if (!this.contextualSearchEnabled) return;

    try {
      // Request page context for the activated tab
      this.requestPageContext(tabId);
    } catch (error) {
      console.log('Could not get context for activated tab:', error.message);
    }
  }

  async injectContextualSearchScript(tabId) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['contextual-search.js']
      });
      console.log('✅ Contextual search script injected into tab:', tabId);
    } catch (error) {
      console.log('⚠️ Failed to inject contextual search script:', error.message);
      throw error;
    }
  }

  async requestPageContext(tabId) {
    try {
      const response = await chrome.tabs.sendMessage(tabId, {
        action: 'getPageContext'
      });

      if (response?.success && response.context) {
        this.lastPageContext = response.context;
        console.log('📄 Page context received:', response.context);
        
        // Trigger contextual search
        this.performContextualSearch(tabId, response.context);
      }
    } catch (error) {
      console.log('Could not get page context:', error.message);
    }
  }

  async performContextualSearch(tabId, context) {
    try {
      // Check cache first
      const cacheKey = `${context.domain}_${context.title}`;
      if (this.searchCache.has(cacheKey)) {
        console.log('🔍 Using cached search results for:', context.title);
        return;
      }

      console.log('🔍 Performing contextual search for:', context.title);
      
      // Send search request to content script
      const response = await chrome.tabs.sendMessage(tabId, {
        action: 'searchRelatedBookmarks',
        context: context
      });

      if (response?.success && response.results) {
        console.log(`✅ Found ${response.results.length} related bookmarks`);
        
        // Cache results for 5 minutes
        this.searchCache.set(cacheKey, {
          results: response.results,
          timestamp: Date.now()
        });
        
        // Clean old cache entries
        this.cleanSearchCache();
        
        // Notify popup if it's open
        this.notifyPopupOfSearchResults(response.results, context);
      }
    } catch (error) {
      console.log('Contextual search failed:', error.message);
    }
  }

  cleanSearchCache() {
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    
    for (const [key, value] of this.searchCache.entries()) {
      if (value.timestamp < fiveMinutesAgo) {
        this.searchCache.delete(key);
      }
    }
  }

  notifyPopupOfSearchResults(results, context) {
    // Try to notify popup
    chrome.runtime.sendMessage({
      action: 'contextualSearchResults',
      results: results,
      context: context
    }).catch(() => {
      // Popup not open, that's fine
      console.log('Popup not open to receive search results');
    });
  }

  handleMessage(request, sender, sendResponse) {
    console.log('Background received message:', request);
    
    switch (request.action) {
      case 'getBookmarks':
        return this.handleGetBookmarks(sendResponse);
      case 'addBookmark':
        return this.handleAddBookmark(request, sendResponse);
      case 'removeBookmark':
        return this.handleRemoveBookmark(request, sendResponse);
      case 'syncComplete':
        return this.handleSyncComplete(request, sendResponse);
      case 'pageContextChanged':
        return this.handlePageContextChanged(request, sendResponse);
      case 'getContextualSearchResults':
        return this.handleGetContextualSearchResults(sendResponse);
      case 'toggleContextualSearch':
        return this.handleToggleContextualSearch(request, sendResponse);
      default:
        sendResponse({ success: false, error: 'Unknown action' });
        return false;
    }
  }

  handlePageContextChanged(request, sendResponse) {
    this.lastPageContext = request.context;
    console.log('📄 Page context updated:', request.context);
    sendResponse({ success: true });
    return false;
  }

  handleGetContextualSearchResults(sendResponse) {
    const cacheKey = this.lastPageContext ? 
      `${this.lastPageContext.domain}_${this.lastPageContext.title}` : null;
    
    const cachedResults = cacheKey ? this.searchCache.get(cacheKey) : null;
    
    sendResponse({
      success: true,
      results: cachedResults?.results || [],
      context: this.lastPageContext,
      cached: !!cachedResults
    });
    
    return false;
  }

  handleToggleContextualSearch(request, sendResponse) {
    this.contextualSearchEnabled = request.enabled;
    console.log('🔍 Contextual search:', this.contextualSearchEnabled ? 'enabled' : 'disabled');
    
    sendResponse({ 
      success: true, 
      enabled: this.contextualSearchEnabled 
    });
    
    return false;
  }

  handleInstallation(details) {
    console.log('Bookmark Manager Extension installed:', details.reason);
    
    if (details.reason === 'install') {
      chrome.tabs.create({
        url: 'http://localhost:5173'
      });
    }
  }

  handleGetBookmarks(sendResponse) {
    try {
      chrome.bookmarks.getTree((bookmarkTree) => {
        if (chrome.runtime.lastError) {
          console.error('Failed to get bookmarks:', chrome.runtime.lastError);
          sendResponse({ 
            success: false, 
            error: chrome.runtime.lastError.message 
          });
          return;
        }
        
        const bookmarks = this.extractBookmarks(bookmarkTree);
        console.log(`Extracted ${bookmarks.length} bookmarks`);
        
        sendResponse({ 
          success: true, 
          bookmarks: bookmarks 
        });
      });
    } catch (error) {
      console.error('Error in handleGetBookmarks:', error);
      sendResponse({ 
        success: false, 
        error: error.message 
      });
    }
    
    return true;
  }

  handleAddBookmark(request, sendResponse) {
    try {
      const { title, url, parentId } = request;
      
      if (!title || !url) {
        sendResponse({ 
          success: false, 
          error: 'Title and URL are required' 
        });
        return false;
      }
      
      chrome.bookmarks.create({
        title: title,
        url: url,
        parentId: parentId || '1'
      }, (bookmark) => {
        if (chrome.runtime.lastError) {
          console.error('Failed to create bookmark:', chrome.runtime.lastError);
          sendResponse({ 
            success: false, 
            error: chrome.runtime.lastError.message 
          });
          return;
        }
        
        console.log('Bookmark created:', bookmark);
        sendResponse({ 
          success: true, 
          bookmark: bookmark 
        });
        
        this.notifyWebApp('bookmarkCreated', bookmark);
      });
    } catch (error) {
      console.error('Error in handleAddBookmark:', error);
      sendResponse({ 
        success: false, 
        error: error.message 
      });
    }
    
    return true;
  }

  handleRemoveBookmark(request, sendResponse) {
    try {
      const { id } = request;
      
      if (!id) {
        sendResponse({ 
          success: false, 
          error: 'Bookmark ID is required' 
        });
        return false;
      }
      
      chrome.bookmarks.remove(id, () => {
        if (chrome.runtime.lastError) {
          console.error('Failed to remove bookmark:', chrome.runtime.lastError);
          sendResponse({ 
            success: false, 
            error: chrome.runtime.lastError.message 
          });
          return;
        }
        
        console.log('Bookmark removed:', id);
        sendResponse({ 
          success: true 
        });
        
        this.notifyWebApp('bookmarkRemoved', { id });
      });
    } catch (error) {
      console.error('Error in handleRemoveBookmark:', error);
      sendResponse({ 
        success: false, 
        error: error.message 
      });
    }
    
    return true;
  }

  handleSyncComplete(request, sendResponse) {
    console.log('Sync completion received:', request.data);
    
    chrome.runtime.sendMessage(request).catch(() => {
      console.log('Popup not open to receive sync completion');
    });
    
    sendResponse({ success: true });
    return false;
  }

  extractBookmarks(bookmarkTree, folder = '') {
    let bookmarks = [];
    
    const traverse = (nodes, currentFolder) => {
      if (!nodes) return;
      
      for (const node of nodes) {
        if (node.url) {
          bookmarks.push({
            id: node.id,
            title: node.title || 'Untitled',
            url: node.url,
            dateAdded: node.dateAdded ? new Date(node.dateAdded).toISOString() : new Date().toISOString(),
            folder: currentFolder || undefined,
            parentId: node.parentId
          });
        } else if (node.children) {
          const folderName = currentFolder 
            ? `${currentFolder}/${node.title}` 
            : node.title;
          traverse(node.children, folderName);
        }
      }
    };
    
    traverse(bookmarkTree, folder);
    return bookmarks;
  }

  setupBookmarkListeners() {
    chrome.bookmarks.onCreated.addListener((id, bookmark) => {
      console.log('Bookmark created:', id, bookmark);
      this.notifyWebApp('bookmarkCreated', bookmark);
    });

    chrome.bookmarks.onRemoved.addListener((id, removeInfo) => {
      console.log('Bookmark removed:', id, removeInfo);
      this.notifyWebApp('bookmarkRemoved', { id, removeInfo });
    });

    chrome.bookmarks.onChanged.addListener((id, changeInfo) => {
      console.log('Bookmark changed:', id, changeInfo);
      this.notifyWebApp('bookmarkChanged', { id, changeInfo });
    });

    chrome.bookmarks.onMoved.addListener((id, moveInfo) => {
      console.log('Bookmark moved:', id, moveInfo);
      this.notifyWebApp('bookmarkMoved', { id, moveInfo });
    });
  }

  async notifyWebApp(event, data) {
    const webAppUrls = [
      'http://localhost:*/*',
      'https://localhost:*/*',
      'https://*.netlify.app/*',
      'https://*.vercel.app/*'
    ];
    
    try {
      const tabs = await chrome.tabs.query({ url: webAppUrls });
      
      if (!tabs || tabs.length === 0) {
        console.log('No web app tabs found for notification');
        return;
      }
      
      for (const tab of tabs) {
        try {
          await chrome.tabs.sendMessage(tab.id, {
            action: 'notifyWebApp',
            event: event,
            data: data
          });
          
          console.log(`Notified tab ${tab.id} of ${event}`);
        } catch (error) {
          console.log(`Tab ${tab.id} not ready:`, error.message);
          
          try {
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['content.js']
            });
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            await chrome.tabs.sendMessage(tab.id, {
              action: 'notifyWebApp',
              event: event,
              data: data
            });
            
            console.log(`Notified tab ${tab.id} of ${event} after injection`);
          } catch (injectionError) {
            console.log(`Failed to inject content script into tab ${tab.id}:`, injectionError.message);
          }
        }
      }
    } catch (error) {
      console.error('Error notifying web app:', error);
    }
  }
}

// Initialize background manager
new BackgroundManager();