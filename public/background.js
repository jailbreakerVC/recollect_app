// Chrome Extension Background Script - Refactored for better reliability
class BackgroundManager {
  constructor() {
    this.init();
  }

  // Initialize background script
  init() {
    console.log('🚀 Background script initializing...');
    
    this.setupEventListeners();
    this.setupBookmarkListeners();
    
    console.log('✅ Background script initialized successfully');
  }

  // Set up event listeners
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

  // Handle extension installation
  handleInstallation(details) {
    console.log('Bookmark Manager Extension installed:', details.reason);
    
    if (details.reason === 'install') {
      // Open welcome page on first install
      chrome.tabs.create({
        url: 'http://localhost:5173'
      });
    }
  }

  // Handle messages
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
      default:
        sendResponse({ success: false, error: 'Unknown action' });
        return false;
    }
  }

  // Get all bookmarks
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
    
    return true; // Keep message channel open
  }

  // Add a bookmark
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
        parentId: parentId || '1' // Default to bookmarks bar
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
        
        // Notify web app
        this.notifyWebApp('bookmarkCreated', bookmark);
      });
    } catch (error) {
      console.error('Error in handleAddBookmark:', error);
      sendResponse({ 
        success: false, 
        error: error.message 
      });
    }
    
    return true; // Keep message channel open
  }

  // Remove a bookmark
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
        
        // Notify web app
        this.notifyWebApp('bookmarkRemoved', { id });
      });
    } catch (error) {
      console.error('Error in handleRemoveBookmark:', error);
      sendResponse({ 
        success: false, 
        error: error.message 
      });
    }
    
    return true; // Keep message channel open
  }

  // Handle sync completion
  handleSyncComplete(request, sendResponse) {
    console.log('Sync completion received:', request.data);
    
    // Forward to popup if it's open
    chrome.runtime.sendMessage(request).catch(() => {
      console.log('Popup not open to receive sync completion');
    });
    
    sendResponse({ success: true });
    return false;
  }

  // Extract bookmarks from Chrome's bookmark tree
  extractBookmarks(bookmarkTree, folder = '') {
    let bookmarks = [];
    
    const traverse = (nodes, currentFolder) => {
      if (!nodes) return;
      
      for (const node of nodes) {
        if (node.url) {
          // This is a bookmark
          bookmarks.push({
            id: node.id,
            title: node.title || 'Untitled',
            url: node.url,
            dateAdded: node.dateAdded ? new Date(node.dateAdded).toISOString() : new Date().toISOString(),
            folder: currentFolder || undefined,
            parentId: node.parentId
          });
        } else if (node.children) {
          // This is a folder
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

  // Set up bookmark change listeners
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

  // Notify web app of bookmark changes
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
      
      // Send message to all matching tabs
      for (const tab of tabs) {
        try {
          await chrome.tabs.sendMessage(tab.id, {
            action: 'notifyWebApp',
            event: event,
            data: data
          });
          
          console.log(`Notified tab ${tab.id} of ${event}`);
        } catch (error) {
          // Tab might not have content script loaded, try to inject it
          console.log(`Tab ${tab.id} not ready, trying to inject content script:`, error.message);
          
          try {
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['content.js']
            });
            
            // Wait for script to initialize
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Try sending message again
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