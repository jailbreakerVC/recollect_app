// Chrome Extension Background Script - Complete Search Flow Fix
class BackgroundManager {
  constructor() {
    this.contextMenuEnabled = true;
    this.pageAnalysisEnabled = true;
    this.searchCache = new Map();
    this.pendingSearches = new Map();
    this.responseHandlers = new Map();
    
    this.init();
  }

  init() {
    console.log('🚀 Background script initializing...');
    
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

    // Handle messages from content scripts and popup
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      return this.handleMessage(request, sender, sendResponse);
    });

    // Keep service worker alive
    chrome.runtime.onConnect.addListener((port) => {
      console.log('Content script connected:', port.name);
      port.onDisconnect.addListener(() => {
        console.log('Content script disconnected');
      });
    });
  }

  setupContextMenu() {
    console.log('🔍 Setting up context menu for bookmark search...');
    
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
    console.log('🤖 Setting up automatic page analysis...');
    
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
    console.log('🔍 Context menu search triggered for:', selectedText);
    
    try {
      // Show immediate feedback
      chrome.action.setBadgeText({ text: '...' });
      chrome.action.setBadgeBackgroundColor({ color: '#3b82f6' });
      
      // Send search request to web app
      const results = await this.searchBookmarksByKeyword(selectedText);
      
      console.log(`📋 Context menu search found ${results.length} results`);
      
      // Show results and auto-open popup
      await this.showSearchResults(results, selectedText, 'keyword', true);
      
    } catch (error) {
      console.error('❌ Context menu search failed:', error);
      chrome.action.setBadgeText({ text: '!' });
      chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
      this.showSearchError('Failed to search bookmarks: ' + error.message);
    }
  }

  async handleTabUpdate(tabId, tab) {
    if (!this.pageAnalysisEnabled) return;

    try {
      console.log('🤖 Analyzing page for bookmarks:', tab.title);
      await this.analyzePageForBookmarks(tabId, tab);
    } catch (error) {
      console.log('Could not analyze page:', error.message);
    }
  }

  async handleTabActivation(tabId, tab) {
    if (!this.pageAnalysisEnabled) return;

    try {
      console.log('🤖 Analyzing activated tab:', tab.title);
      await this.analyzePageForBookmarks(tabId, tab);
    } catch (error) {
      console.log('Could not analyze activated tab:', error.message);
    }
  }

  async analyzePageForBookmarks(tabId, tab) {
    try {
      // Extract page context
      const context = await this.extractPageContext(tabId, tab);
      
      if (context && context.title) {
        console.log('📄 Page context extracted:', context.title);
        
        // Search for related bookmarks
        const results = await this.searchBookmarksByPageContext(context);
        
        if (results.length > 0) {
          console.log(`🎯 Found ${results.length} related bookmarks for page: ${context.title}`);
          
          // Show contextual suggestions and auto-open popup
          await this.showSearchResults(results, context.title, 'context', true);
        } else {
          console.log('📄 No related bookmarks found for:', context.title);
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
    
    const requestId = `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return new Promise((resolve, reject) => {
      let responseReceived = false;
      let timeoutId;
      
      // Set up response listener FIRST
      const responseHandler = (message, sender, sendResponse) => {
        console.log('📨 Background received message:', message);
        
        if (message && message.action === 'searchResponse' && 
            message.data && message.data.requestId === requestId) {
          
          console.log('✅ Matching search response received for:', requestId);
          responseReceived = true;
          clearTimeout(timeoutId);
          chrome.runtime.onMessage.removeListener(responseHandler);
          
          if (message.data.success) {
            console.log('✅ Keyword search response received:', message.data.results?.length || 0, 'results');
            resolve(message.data.results || []);
          } else {
            console.error('❌ Keyword search failed:', message.data.message);
            reject(new Error(message.data.message || 'Search failed'));
          }
        }
      };

      // Add the response handler
      chrome.runtime.onMessage.addListener(responseHandler);
      
      // Store handler for cleanup
      this.responseHandlers.set(requestId, responseHandler);

      // Send search request to web app
      this.sendMessageToWebApp({
        action: 'searchByKeyword',
        keyword: keyword,
        requestId: requestId
      }).then(() => {
        console.log('📤 Search request sent successfully');
      }).catch(error => {
        console.error('❌ Failed to send search request:', error);
        chrome.runtime.onMessage.removeListener(responseHandler);
        this.responseHandlers.delete(requestId);
        reject(error);
      });

      // Timeout after 15 seconds
      timeoutId = setTimeout(() => {
        if (!responseReceived) {
          console.error('⏰ Keyword search timeout for request:', requestId);
          chrome.runtime.onMessage.removeListener(responseHandler);
          this.responseHandlers.delete(requestId);
          reject(new Error('Search timeout - web app did not respond'));
        }
      }, 15000);
    });
  }

  async searchBookmarksByPageContext(context) {
    console.log('🤖 Searching bookmarks by page context:', context.title);
    
    const requestId = `context_search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return new Promise((resolve, reject) => {
      let responseReceived = false;
      let timeoutId;
      
      // Set up response listener FIRST
      const responseHandler = (message, sender, sendResponse) => {
        if (message && message.action === 'searchResponse' && 
            message.data && message.data.requestId === requestId) {
          
          responseReceived = true;
          clearTimeout(timeoutId);
          chrome.runtime.onMessage.removeListener(responseHandler);
          
          if (message.data.success) {
            console.log('✅ Context search response received:', message.data.results?.length || 0, 'results');
            resolve(message.data.results || []);
          } else {
            console.error('❌ Context search failed:', message.data.message);
            reject(new Error(message.data.message || 'Context search failed'));
          }
        }
      };

      chrome.runtime.onMessage.addListener(responseHandler);
      this.responseHandlers.set(requestId, responseHandler);

      // Send search request to web app
      this.sendMessageToWebApp({
        action: 'searchByPageContext',
        context: context,
        requestId: requestId
      }).then(() => {
        console.log('📤 Context search request sent successfully');
      }).catch(error => {
        chrome.runtime.onMessage.removeListener(responseHandler);
        this.responseHandlers.delete(requestId);
        reject(error);
      });

      // Timeout after 15 seconds
      timeoutId = setTimeout(() => {
        if (!responseReceived) {
          console.error('⏰ Context search timeout for request:', requestId);
          chrome.runtime.onMessage.removeListener(responseHandler);
          this.responseHandlers.delete(requestId);
          reject(new Error('Context search timeout'));
        }
      }, 15000);
    });
  }

  async sendMessageToWebApp(message) {
    console.log('📤 Sending message to web app:', message);
    
    const webAppUrls = [
      'http://localhost:*/*',
      'https://localhost:*/*',
      'https://*.netlify.app/*',
      'https://*.vercel.app/*'
    ];
    
    try {
      const tabs = await chrome.tabs.query({ url: webAppUrls });
      
      if (!tabs || tabs.length === 0) {
        console.log('❌ No web app tabs found for search request');
        throw new Error('Web app not open - please open http://localhost:5173');
      }
      
      let messageSent = false;
      let lastError = null;
      
      for (const tab of tabs) {
        try {
          console.log(`🔄 Trying to send message to tab ${tab.id}`);
          
          // Check if content script is ready
          await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
          console.log(`✅ Tab ${tab.id} content script is ready`);
          
          // Send the actual message
          await chrome.tabs.sendMessage(tab.id, {
            action: 'forwardToWebApp',
            payload: message
          });
          
          console.log(`✅ Search request sent to tab ${tab.id}`);
          messageSent = true;
          break;
          
        } catch (error) {
          console.log(`⚠️ Tab ${tab.id} not ready, trying content script injection:`, error.message);
          lastError = error;
          
          try {
            // Inject content script and try again
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['content.js']
            });
            
            console.log(`🔄 Content script injected into tab ${tab.id}, waiting...`);
            
            // Wait for injection to complete
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Try sending message again
            await chrome.tabs.sendMessage(tab.id, {
              action: 'forwardToWebApp',
              payload: message
            });
            
            console.log(`✅ Search request sent to tab ${tab.id} after injection`);
            messageSent = true;
            break;
            
          } catch (injectionError) {
            console.log(`❌ Failed to inject content script into tab ${tab.id}:`, injectionError.message);
            lastError = injectionError;
            continue;
          }
        }
      }
      
      if (!messageSent) {
        throw new Error(`Could not send message to any web app tab. Last error: ${lastError?.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('❌ Error sending message to web app:', error);
      throw error;
    }
  }

  async showSearchResults(results, query, searchType, autoOpen = false) {
    console.log(`📋 Showing ${results.length} search results for "${query}" (${searchType})`);
    
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

    console.log('💾 Search results stored in chrome.storage.local');

    // Show badge with result count
    if (results.length > 0) {
      chrome.action.setBadgeText({ text: results.length.toString() });
      chrome.action.setBadgeBackgroundColor({ color: '#10b981' });
      
      // Auto-open popup if requested and results found
      if (autoOpen) {
        console.log('🚀 Auto-opening extension popup with search results');
        
        // Try multiple methods to open popup
        try {
          await chrome.action.openPopup();
          console.log('✅ Popup opened via chrome.action.openPopup()');
        } catch (error) {
          console.log('⚠️ chrome.action.openPopup() failed:', error.message);
          
          // Fallback: Show notification with action
          chrome.notifications.create({
            type: 'basic',
            iconUrl: '/icon48.png',
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
          iconUrl: '/icon48.png',
          title: 'No Bookmarks Found',
          message: `No bookmarks found for "${query}"`
        });
      }
    }
  }

  showSearchError(message) {
    console.error('❌ Search error:', message);
    
    chrome.notifications.create({
      type: 'basic',
      iconUrl: '/icon48.png',
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
    console.log('📨 Background received message:', request);
    
    // Fix: Check if request exists and has action property
    if (!request || typeof request.action !== 'string') {
      console.error('❌ Invalid request format:', request);
      sendResponse({ success: false, error: 'Invalid request format' });
      return false;
    }
    
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
      case 'ping':
        sendResponse({ success: true, message: 'pong' });
        return false;
      default:
        console.warn('⚠️ Unknown action:', request.action);
        sendResponse({ success: false, error: 'Unknown action' });
        return false;
    }
  }

  handleTestSearch(request, sendResponse) {
    console.log('🧪 Testing search functionality');
    
    // Test with a simple keyword search
    this.searchBookmarksByKeyword('test')
      .then(results => {
        console.log('✅ Test search completed:', results.length, 'results');
        sendResponse({ 
          success: true, 
          results: results,
          message: `Test search found ${results.length} results`
        });
      })
      .catch(error => {
        console.error('❌ Test search failed:', error);
        sendResponse({ 
          success: false, 
          error: error.message 
        });
      });
    
    return true;
  }

  handleSearchResponse(data) {
    console.log('📨 Received search response:', data);
    // Response handling is done in the promise resolvers
    // This is just for logging
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
      
      console.log('📋 Returning search results:', searchData?.results?.length || 0, 'results');
      
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
      console.log('🗑️ Search results cleared');
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