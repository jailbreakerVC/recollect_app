// Chrome Extension Background Script - Enhanced with Context Menu and Page Analysis
class BackgroundManager {
  constructor() {
    this.contextMenuEnabled = true;
    this.pageAnalysisEnabled = true;
    this.lastPageContext = null;
    this.searchCache = new Map();
    
    this.init();
  }

  init() {
    console.log('🚀 Background script initializing with context menu and page analysis...');
    
    this.setupEventListeners();
    this.setupBookmarkListeners();
    this.setupContextMenu();
    this.setupPageAnalysis();
    
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

  setupContextMenu() {
    console.log('🔍 Setting up context menu for bookmark search...');
    
    // Create context menu item for selected text
    chrome.contextMenus.create({
      id: 'searchBookmarks',
      title: 'Search Bookmarks for "%s"',
      contexts: ['selection'],
      documentUrlPatterns: ['http://*/*', 'https://*/*']
    });

    // Handle context menu clicks
    chrome.contextMenus.onClicked.addListener((info, tab) => {
      if (info.menuItemId === 'searchBookmarks' && info.selectionText) {
        this.handleContextMenuSearch(info.selectionText, tab);
      }
    });
  }

  setupPageAnalysis() {
    console.log('🤖 Setting up automatic page analysis...');
    
    // Listen for tab updates to trigger page analysis
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

  async handleContextMenuSearch(selectedText, tab) {
    console.log('🔍 Context menu search triggered:', selectedText);
    
    try {
      // Send search request to web app
      const results = await this.searchBookmarksByKeyword(selectedText);
      
      // Show results in extension popup or notification
      this.showSearchResults(results, selectedText, 'keyword');
      
    } catch (error) {
      console.error('Context menu search failed:', error);
      this.showSearchError('Failed to search bookmarks');
    }
  }

  async handleTabUpdate(tabId, tab) {
    if (!this.pageAnalysisEnabled) return;

    try {
      // Small delay to let the page load
      setTimeout(() => {
        this.analyzePageForBookmarks(tabId, tab);
      }, 2000);
      
    } catch (error) {
      console.log('Could not analyze page:', error.message);
    }
  }

  async handleTabActivation(tabId, tab) {
    if (!this.pageAnalysisEnabled) return;

    try {
      // Analyze the activated tab
      this.analyzePageForBookmarks(tabId, tab);
    } catch (error) {
      console.log('Could not analyze activated tab:', error.message);
    }
  }

  async analyzePageForBookmarks(tabId, tab) {
    try {
      // Extract page context
      const context = await this.extractPageContext(tabId, tab);
      
      if (context) {
        console.log('📄 Page context extracted:', context);
        
        // Search for related bookmarks
        const results = await this.searchBookmarksByPageContext(context);
        
        if (results.length > 0) {
          console.log(`🎯 Found ${results.length} related bookmarks for page: ${context.title}`);
          
          // Show contextual suggestions
          this.showSearchResults(results, context.title, 'context');
        }
      }
    } catch (error) {
      console.log('Page analysis failed:', error.message);
    }
  }

  async extractPageContext(tabId, tab) {
    try {
      // Try to inject and execute context extraction script
      const results = await chrome.scripting.executeScript({
        target: { tabId: tabId },
        function: () => {
          // Extract page information
          const title = document.title || '';
          const url = window.location.href;
          const domain = window.location.hostname.replace(/^www\./, '');
          
          // Extract meta description
          const metaDescription = document.querySelector('meta[name="description"]');
          const description = metaDescription?.content || '';
          
          // Extract keywords from headings and title
          const headings = Array.from(document.querySelectorAll('h1, h2, h3'))
            .map(h => h.textContent?.trim())
            .filter(Boolean)
            .slice(0, 5);
          
          const titleWords = title.toLowerCase()
            .split(/\s+/)
            .filter(word => word.length > 3)
            .slice(0, 10);
          
          const keywords = [...new Set([...titleWords, ...headings.join(' ').toLowerCase().split(/\s+/).filter(word => word.length > 3)])];
          
          return {
            title,
            url,
            domain,
            description,
            keywords: keywords.slice(0, 15),
            timestamp: Date.now()
          };
        }
      });

      return results[0]?.result || null;
    } catch (error) {
      console.log('Failed to extract page context:', error.message);
      
      // Fallback: create basic context from tab info
      return {
        title: tab.title || '',
        url: tab.url,
        domain: new URL(tab.url).hostname.replace(/^www\./, ''),
        description: '',
        keywords: [],
        timestamp: Date.now()
      };
    }
  }

  async searchBookmarksByKeyword(keyword) {
    console.log('🔍 Searching bookmarks by keyword:', keyword);
    
    return new Promise((resolve, reject) => {
      const requestId = `search_${Date.now()}`;
      
      // Send search request to web app
      this.sendMessageToWebApp({
        action: 'searchByKeyword',
        keyword: keyword,
        requestId: requestId
      });

      // Listen for response
      const responseHandler = (event) => {
        if (event.data.source === 'bookmark-manager-webapp' && 
            event.data.requestId === requestId) {
          window.removeEventListener('message', responseHandler);
          
          if (event.data.success) {
            resolve(event.data.results || []);
          } else {
            reject(new Error(event.data.message || 'Search failed'));
          }
        }
      };

      // Set up response listener in web app tabs
      this.setupResponseListener(responseHandler);

      // Timeout after 10 seconds
      setTimeout(() => {
        reject(new Error('Search timeout'));
      }, 10000);
    });
  }

  async searchBookmarksByPageContext(context) {
    console.log('🤖 Searching bookmarks by page context:', context);
    
    return new Promise((resolve, reject) => {
      const requestId = `context_search_${Date.now()}`;
      
      // Send search request to web app
      this.sendMessageToWebApp({
        action: 'searchByPageContext',
        context: context,
        requestId: requestId
      });

      // Listen for response
      const responseHandler = (event) => {
        if (event.data.source === 'bookmark-manager-webapp' && 
            event.data.requestId === requestId) {
          
          if (event.data.success) {
            resolve(event.data.results || []);
          } else {
            reject(new Error(event.data.message || 'Context search failed'));
          }
        }
      };

      // Set up response listener in web app tabs
      this.setupResponseListener(responseHandler);

      // Timeout after 10 seconds
      setTimeout(() => {
        reject(new Error('Context search timeout'));
      }, 10000);
    });
  }

  async sendMessageToWebApp(message) {
    const webAppUrls = [
      'http://localhost:*/*',
      'https://localhost:*/*',
      'https://*.netlify.app/*',
      'https://*.vercel.app/*'
    ];
    
    try {
      const tabs = await chrome.tabs.query({ url: webAppUrls });
      
      if (!tabs || tabs.length === 0) {
        console.log('No web app tabs found for search request');
        return;
      }
      
      for (const tab of tabs) {
        try {
          await chrome.tabs.sendMessage(tab.id, {
            action: 'forwardToWebApp',
            payload: message
          });
          
          console.log(`Search request sent to tab ${tab.id}`);
          break;
        } catch (error) {
          console.log(`Tab ${tab.id} not ready:`, error.message);
          continue;
        }
      }
    } catch (error) {
      console.error('Error sending message to web app:', error);
    }
  }

  async setupResponseListener(handler) {
    const webAppUrls = [
      'http://localhost:*/*',
      'https://localhost:*/*',
      'https://*.netlify.app/*',
      'https://*.vercel.app/*'
    ];
    
    try {
      const tabs = await chrome.tabs.query({ url: webAppUrls });
      
      for (const tab of tabs) {
        try {
          await chrome.tabs.sendMessage(tab.id, {
            action: 'setupResponseListener',
            handler: handler.toString()
          });
        } catch (error) {
          console.log(`Could not set up response listener in tab ${tab.id}`);
        }
      }
    } catch (error) {
      console.error('Error setting up response listener:', error);
    }
  }

  showSearchResults(results, query, searchType) {
    console.log(`📋 Showing ${results.length} search results for "${query}" (${searchType})`);
    
    // Store results for popup to display
    chrome.storage.local.set({
      lastSearchResults: {
        results: results,
        query: query,
        searchType: searchType,
        timestamp: Date.now()
      }
    });

    // Show badge with result count
    if (results.length > 0) {
      chrome.action.setBadgeText({ text: results.length.toString() });
      chrome.action.setBadgeBackgroundColor({ color: '#10b981' });
      
      // Clear badge after 10 seconds
      setTimeout(() => {
        chrome.action.setBadgeText({ text: '' });
      }, 10000);
    }

    // Send notification for context searches
    if (searchType === 'context' && results.length > 0) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon48.png',
        title: 'Related Bookmarks Found',
        message: `Found ${results.length} bookmarks related to "${query.substring(0, 50)}${query.length > 50 ? '...' : ''}"`
      });
    }
  }

  showSearchError(message) {
    console.error('Search error:', message);
    
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon48.png',
      title: 'Bookmark Search Failed',
      message: message
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

  handleMessage(request, sender, sendResponse) {
    console.log('Background received message:', request);
    
    switch (request.action) {
      case 'getBookmarks':
        return this.handleGetBookmarks(sendResponse);
      case 'addBookmark':
        return this.handleAddBookmark(request, sendResponse);
      case 'removeBookmark':
        return this.handleRemoveBookmark(request, sendResponse);
      case 'getSearchResults':
        return this.handleGetSearchResults(sendResponse);
      case 'clearSearchResults':
        return this.handleClearSearchResults(sendResponse);
      case 'toggleContextMenu':
        return this.handleToggleContextMenu(request, sendResponse);
      case 'togglePageAnalysis':
        return this.handleTogglePageAnalysis(request, sendResponse);
      default:
        sendResponse({ success: false, error: 'Unknown action' });
        return false;
    }
  }

  handleGetSearchResults(sendResponse) {
    chrome.storage.local.get(['lastSearchResults'], (result) => {
      const searchData = result.lastSearchResults || null;
      
      sendResponse({
        success: true,
        searchData: searchData
      });
    });
    
    return false;
  }

  handleClearSearchResults(sendResponse) {
    chrome.storage.local.remove(['lastSearchResults'], () => {
      chrome.action.setBadgeText({ text: '' });
      sendResponse({ success: true });
    });
    
    return false;
  }

  handleToggleContextMenu(request, sendResponse) {
    this.contextMenuEnabled = request.enabled;
    console.log('🔍 Context menu search:', this.contextMenuEnabled ? 'enabled' : 'disabled');
    
    sendResponse({ 
      success: true, 
      enabled: this.contextMenuEnabled 
    });
    
    return false;
  }

  handleTogglePageAnalysis(request, sendResponse) {
    this.pageAnalysisEnabled = request.enabled;
    console.log('🤖 Page analysis:', this.pageAnalysisEnabled ? 'enabled' : 'disabled');
    
    sendResponse({ 
      success: true, 
      enabled: this.pageAnalysisEnabled 
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