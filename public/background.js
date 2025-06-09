// Chrome Extension Background Script - Enhanced with Auto-Opening Popup
class BackgroundManager {
  constructor() {
    this.contextMenuEnabled = true;
    this.pageAnalysisEnabled = true;
    this.lastPageContext = null;
    this.searchCache = new Map();
    this.pendingSearches = new Map();
    
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.setupBookmarkListeners();
    this.setupContextMenu();
    this.setupPageAnalysis();
  }

  setupEventListeners() {
    // Handle extension installation
    chrome.runtime.onInstalled.addListener((details) => {
      this.handleInstallation(details);
    });

    // Handle extension startup
    chrome.runtime.onStartup.addListener(() => {
      // Extension started
    });

    // Handle messages from content scripts and popup
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      return this.handleMessage(request, sender, sendResponse);
    });

    // Keep service worker alive
    chrome.runtime.onConnect.addListener((port) => {
      // Content script connected
    });
  }

  setupContextMenu() {
    // Remove existing context menu items
    chrome.contextMenus.removeAll(() => {
      // Create context menu item for selected text
      chrome.contextMenus.create({
        id: 'searchBookmarksKeyword',
        title: 'Search Bookmarks for "%s"',
        contexts: ['selection'],
        documentUrlPatterns: ['http://*/*', 'https://*/*']
      });
    });

    // Handle context menu clicks
    chrome.contextMenus.onClicked.addListener((info, tab) => {
      if (info.menuItemId === 'searchBookmarksKeyword' && info.selectionText) {
        this.handleContextMenuSearch(info.selectionText, tab);
      }
    });
  }

  setupPageAnalysis() {
    // Listen for tab updates to trigger page analysis
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && tab.url && this.isValidUrl(tab.url)) {
        // Delay to let page fully load
        setTimeout(() => {
          this.handleTabUpdate(tabId, tab);
        }, 3000);
      }
    });

    // Listen for tab activation
    chrome.tabs.onActivated.addListener((activeInfo) => {
      chrome.tabs.get(activeInfo.tabId, (tab) => {
        if (tab.url && this.isValidUrl(tab.url)) {
          setTimeout(() => {
            this.handleTabActivation(activeInfo.tabId, tab);
          }, 1000);
        }
      });
    });
  }

  async handleContextMenuSearch(selectedText, tab) {
    try {
      // Show immediate feedback
      chrome.action.setBadgeText({ text: '...' });
      chrome.action.setBadgeBackgroundColor({ color: '#3b82f6' });
      
      // Send search request to web app
      const results = await this.searchBookmarksByKeyword(selectedText);
      
      // Show results and auto-open popup
      await this.showSearchResults(results, selectedText, 'keyword', true);
      
    } catch (error) {
      chrome.action.setBadgeText({ text: '!' });
      chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
      this.showSearchError('Failed to search bookmarks: ' + error.message);
    }
  }

  async handleTabUpdate(tabId, tab) {
    if (!this.pageAnalysisEnabled) return;

    try {
      await this.analyzePageForBookmarks(tabId, tab);
    } catch (error) {
      // Could not analyze page
    }
  }

  async handleTabActivation(tabId, tab) {
    if (!this.pageAnalysisEnabled) return;

    try {
      await this.analyzePageForBookmarks(tabId, tab);
    } catch (error) {
      // Could not analyze activated tab
    }
  }

  async analyzePageForBookmarks(tabId, tab) {
    try {
      // Extract page context
      const context = await this.extractPageContext(tabId, tab);
      
      if (context && context.title) {
        // Search for related bookmarks
        const results = await this.searchBookmarksByPageContext(context);
        
        if (results.length > 0) {
          // Show contextual suggestions and auto-open popup
          await this.showSearchResults(results, context.title, 'context', true);
        }
      }
    } catch (error) {
      // Page analysis failed
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
    const requestId = `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return new Promise((resolve, reject) => {
      let responseReceived = false;
      
      // Set up response listener
      const responseHandler = (message, sender, sendResponse) => {
        if (message.action === 'searchResponse' && 
            message.data.requestId === requestId) {
          responseReceived = true;
          chrome.runtime.onMessage.removeListener(responseHandler);
          
          if (message.data.success) {
            resolve(message.data.results || []);
          } else {
            reject(new Error(message.data.message || 'Search failed'));
          }
        }
      };

      chrome.runtime.onMessage.addListener(responseHandler);

      // Send search request to web app
      this.sendMessageToWebApp({
        action: 'searchByKeyword',
        keyword: keyword,
        requestId: requestId
      }).catch(error => {
        chrome.runtime.onMessage.removeListener(responseHandler);
        reject(error);
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        if (!responseReceived) {
          chrome.runtime.onMessage.removeListener(responseHandler);
          reject(new Error('Search timeout'));
        }
      }, 10000);
    });
  }

  async searchBookmarksByPageContext(context) {
    const requestId = `context_search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return new Promise((resolve, reject) => {
      let responseReceived = false;
      
      // Set up response listener
      const responseHandler = (message, sender, sendResponse) => {
        if (message.action === 'searchResponse' && 
            message.data.requestId === requestId) {
          responseReceived = true;
          chrome.runtime.onMessage.removeListener(responseHandler);
          
          if (message.data.success) {
            resolve(message.data.results || []);
          } else {
            reject(new Error(message.data.message || 'Context search failed'));
          }
        }
      };

      chrome.runtime.onMessage.addListener(responseHandler);

      // Send search request to web app
      this.sendMessageToWebApp({
        action: 'searchByPageContext',
        context: context,
        requestId: requestId
      }).catch(error => {
        chrome.runtime.onMessage.removeListener(responseHandler);
        reject(error);
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        if (!responseReceived) {
          chrome.runtime.onMessage.removeListener(responseHandler);
          reject(new Error('Context search timeout'));
        }
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
        throw new Error('Web app not open - please open http://localhost:5173');
      }
      
      let messageSent = false;
      
      for (const tab of tabs) {
        try {
          // First try to send message directly
          await chrome.tabs.sendMessage(tab.id, {
            action: 'forwardToWebApp',
            payload: message
          });
          
          messageSent = true;
          break;
        } catch (error) {
          try {
            // Inject content script and try again
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['content.js']
            });
            
            // Wait a moment for injection
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Try sending message again
            await chrome.tabs.sendMessage(tab.id, {
              action: 'forwardToWebApp',
              payload: message
            });
            
            messageSent = true;
            break;
          } catch (injectionError) {
            continue;
          }
        }
      }
      
      if (!messageSent) {
        throw new Error('Could not send message to any web app tab');
      }
    } catch (error) {
      throw error;
    }
  }

  async showSearchResults(results, query, searchType, autoOpen = false) {
    // Store results for popup to display
    const searchData = {
      results: results,
      query: query,
      searchType: searchType,
      timestamp: Date.now()
    };
    
    await chrome.storage.local.set({
      lastSearchResults: searchData
    });

    // Show badge with result count
    if (results.length > 0) {
      chrome.action.setBadgeText({ text: results.length.toString() });
      chrome.action.setBadgeBackgroundColor({ color: '#10b981' });
      
      // Auto-open popup if requested and results found
      if (autoOpen) {
        // Try multiple methods to open popup
        try {
          await chrome.action.openPopup();
        } catch (error) {
          // Fallback: Show notification with action
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icon48.png',
            title: `${results.length} Bookmark${results.length > 1 ? 's' : ''} Found`,
            message: `Found bookmarks for "${query.substring(0, 50)}${query.length > 50 ? '...' : ''}". Click extension icon to view.`,
            buttons: [{ title: 'View Results' }]
          });
          
          // Handle notification click
          chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
            if (buttonIndex === 0) {
              chrome.notifications.clear(notificationId);
            }
          });
          
          chrome.notifications.onClicked.addListener((notificationId) => {
            chrome.notifications.clear(notificationId);
          });
        }
      }
      
      // Clear badge after 30 seconds if popup wasn't opened
      setTimeout(() => {
        chrome.action.setBadgeText({ text: '' });
      }, 30000);
    } else {
      // Clear badge if no results
      chrome.action.setBadgeText({ text: '' });
      
      if (autoOpen && searchType === 'keyword') {
        // Show "no results" notification for manual searches
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icon48.png',
          title: 'No Bookmarks Found',
          message: `No bookmarks found for "${query}"`
        });
      }
    }
  }

  showSearchError(message) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon48.png',
      title: 'Bookmark Search Failed',
      message: message
    });
    
    // Clear error badge after 5 seconds
    setTimeout(() => {
      chrome.action.setBadgeText({ text: '' });
    }, 5000);
  }

  isValidUrl(url) {
    return url && 
           !url.startsWith('chrome://') && 
           !url.startsWith('chrome-extension://') &&
           !url.startsWith('moz-extension://') &&
           !url.startsWith('about:') &&
           !url.startsWith('edge://') &&
           !url.startsWith('file://') &&
           (url.startsWith('http://') || url.startsWith('https://'));
  }

  handleMessage(request, sender, sendResponse) {
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
      case 'openPopup':
        return this.handleOpenPopup(sendResponse);
      case 'searchResponse':
        this.handleSearchResponse(request.data);
        sendResponse({ success: true });
        return false;
      case 'testSearch':
        return this.handleTestSearch(request, sendResponse);
      default:
        sendResponse({ success: false, error: 'Unknown action' });
        return false;
    }
  }

  handleTestSearch(request, sendResponse) {
    // Test with a simple keyword search
    this.searchBookmarksByKeyword('test')
      .then(results => {
        sendResponse({ 
          success: true, 
          results: results,
          message: `Test search found ${results.length} results`
        });
      })
      .catch(error => {
        sendResponse({ 
          success: false, 
          error: error.message 
        });
      });
    
    return true;
  }

  handleSearchResponse(data) {
    // Response handling is done in the promise resolvers
  }

  handleOpenPopup(sendResponse) {
    chrome.action.openPopup()
      .then(() => {
        sendResponse({ success: true });
      })
      .catch((error) => {
        sendResponse({ success: false, error: error.message });
      });
    
    return true;
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
    
    sendResponse({ 
      success: true, 
      enabled: this.contextMenuEnabled 
    });
    
    return false;
  }

  handleTogglePageAnalysis(request, sendResponse) {
    this.pageAnalysisEnabled = request.enabled;
    
    sendResponse({ 
      success: true, 
      enabled: this.pageAnalysisEnabled 
    });
    
    return false;
  }

  handleInstallation(details) {
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
          sendResponse({ 
            success: false, 
            error: chrome.runtime.lastError.message 
          });
          return;
        }
        
        const bookmarks = this.extractBookmarks(bookmarkTree);
        
        sendResponse({ 
          success: true, 
          bookmarks: bookmarks 
        });
      });
    } catch (error) {
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
          sendResponse({ 
            success: false, 
            error: chrome.runtime.lastError.message 
          });
          return;
        }
        
        sendResponse({ 
          success: true, 
          bookmark: bookmark 
        });
        
        this.notifyWebApp('bookmarkCreated', bookmark);
      });
    } catch (error) {
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
          sendResponse({ 
            success: false, 
            error: chrome.runtime.lastError.message 
          });
          return;
        }
        
        sendResponse({ 
          success: true 
        });
        
        this.notifyWebApp('bookmarkRemoved', { id });
      });
    } catch (error) {
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
      this.notifyWebApp('bookmarkCreated', bookmark);
    });

    chrome.bookmarks.onRemoved.addListener((id, removeInfo) => {
      this.notifyWebApp('bookmarkRemoved', { id, removeInfo });
    });

    chrome.bookmarks.onChanged.addListener((id, changeInfo) => {
      this.notifyWebApp('bookmarkChanged', { id, changeInfo });
    });

    chrome.bookmarks.onMoved.addListener((id, moveInfo) => {
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
        return;
      }
      
      for (const tab of tabs) {
        try {
          await chrome.tabs.sendMessage(tab.id, {
            action: 'notifyWebApp',
            event: event,
            data: data
          });
        } catch (error) {
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
          } catch (injectionError) {
            // Failed to inject content script
          }
        }
      }
    } catch (error) {
      // Error notifying web app
    }
  }
}

// Initialize background manager
new BackgroundManager();