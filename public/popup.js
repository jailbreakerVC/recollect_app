// Chrome Extension Popup Script - Refactored for better reliability
class PopupManager {
  constructor() {
    this.isConnected = false;
    this.bookmarkCount = 0;
    this.isSyncing = false;
    this.elements = {};
    
    this.init();
  }

  // Initialize popup
  init() {
    console.log('🚀 Popup initializing...');
    
    this.cacheElements();
    this.setupEventListeners();
    this.loadStoredData();
    this.startConnectionMonitoring();
    
    console.log('✅ Popup initialized successfully');
  }

  // Cache DOM elements
  cacheElements() {
    this.elements = {
      status: document.getElementById('status'),
      stats: document.getElementById('stats'),
      bookmarkCount: document.getElementById('bookmarkCount'),
      lastSync: document.getElementById('lastSync'),
      openWebAppBtn: document.getElementById('openWebApp'),
      syncBookmarksBtn: document.getElementById('syncBookmarks')
    };
  }

  // Set up event listeners
  setupEventListeners() {
    this.elements.openWebAppBtn.addEventListener('click', () => this.openWebApp());
    this.elements.syncBookmarksBtn.addEventListener('click', () => this.syncBookmarks());
    
    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleBackgroundMessage(message, sender, sendResponse);
    });
  }

  // Handle messages from background script
  handleBackgroundMessage(message, sender, sendResponse) {
    console.log('📨 Popup received message:', message);
    
    switch (message.action) {
      case 'syncStarted':
        this.updateSyncButton('🔄 Syncing...');
        break;
      case 'syncProgress':
        this.updateSyncButton(`🔄 ${message.data.status}...`);
        break;
      case 'syncComplete':
        this.handleSyncComplete(message.data);
        break;
    }
    
    sendResponse({ success: true });
  }

  // Update status display
  updateStatus(connected, message) {
    console.log('📊 Updating status:', { connected, message });
    
    this.isConnected = connected;
    this.elements.status.className = `status ${connected ? 'connected' : 'disconnected'}`;
    this.elements.status.innerHTML = message;
    
    this.elements.stats.style.display = connected ? 'block' : 'none';
  }

  // Update bookmark count
  updateBookmarkCount(count) {
    this.bookmarkCount = count;
    this.elements.bookmarkCount.textContent = count.toLocaleString();
  }

  // Update last sync time
  updateLastSync() {
    const now = new Date();
    this.elements.lastSync.textContent = now.toLocaleTimeString();
    
    // Store sync info
    chrome.storage.local.set({
      lastSyncTime: now.toISOString(),
      lastBookmarkCount: this.bookmarkCount
    });
  }

  // Load stored sync information
  loadStoredData() {
    chrome.storage.local.get(['lastSyncTime', 'lastBookmarkCount'], (result) => {
      if (result.lastSyncTime) {
        const lastSync = new Date(result.lastSyncTime);
        this.elements.lastSync.textContent = lastSync.toLocaleTimeString();
      }
    });
  }

  // Start connection monitoring
  startConnectionMonitoring() {
    // Check immediately
    this.checkConnection();
    
    // Check every 3 seconds
    setInterval(() => this.checkConnection(), 3000);
  }

  // Check connection to web app
  async checkConnection() {
    console.log('🔍 Checking web app connection...');
    
    try {
      const webAppUrls = [
        'http://localhost:*/*',
        'https://localhost:*/*',
        'https://*.netlify.app/*',
        'https://*.vercel.app/*'
      ];
      
      const tabs = await chrome.tabs.query({ url: webAppUrls });
      console.log('📋 Found tabs:', tabs?.length || 0);
      
      if (tabs && tabs.length > 0) {
        // Test responsiveness of each tab
        for (const tab of tabs) {
          const isResponsive = await this.testTabResponsiveness(tab);
          if (isResponsive) {
            this.updateStatus(true, '✅ Connected to Web App');
            this.getBookmarkCount();
            return;
          }
        }
        
        this.updateStatus(false, '⚠️ Web App Not Responsive');
      } else {
        this.updateStatus(false, '⚠️ Web App Not Open');
      }
    } catch (error) {
      console.error('❌ Connection check error:', error);
      this.updateStatus(false, '❌ Connection Error');
    }
  }

  // Test if a tab is responsive
  async testTabResponsiveness(tab) {
    console.log('🧪 Testing tab responsiveness:', tab.id);
    
    try {
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'testConnection'
      });
      
      return response?.success && response?.responsive;
    } catch (error) {
      console.log('⚠️ Tab not responsive, trying content script injection:', error.message);
      
      // Try to inject content script
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
        
        // Wait for initialization
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Test again
        const response = await chrome.tabs.sendMessage(tab.id, {
          action: 'testConnection'
        });
        
        return response?.success && response?.responsive;
      } catch (injectionError) {
        console.log('❌ Content script injection failed:', injectionError.message);
        return false;
      }
    }
  }

  // Get bookmark count from Chrome
  getBookmarkCount() {
    console.log('📊 Getting bookmark count...');
    
    chrome.bookmarks.getTree((bookmarkTree) => {
      if (chrome.runtime.lastError) {
        console.error('❌ Failed to get bookmarks:', chrome.runtime.lastError);
        return;
      }
      
      const count = this.countBookmarks(bookmarkTree);
      console.log('📚 Bookmark count:', count);
      this.updateBookmarkCount(count);
    });
  }

  // Count bookmarks recursively
  countBookmarks(bookmarkTree) {
    let count = 0;
    
    const traverse = (nodes) => {
      if (!nodes) return;
      
      for (const node of nodes) {
        if (node.url) {
          count++;
        } else if (node.children) {
          traverse(node.children);
        }
      }
    };
    
    traverse(bookmarkTree);
    return count;
  }

  // Open web app
  openWebApp() {
    console.log('🌐 Opening web app...');
    
    const urls = [
      'http://localhost:5173',
      'http://localhost:3000'
    ];
    
    chrome.tabs.create({ url: urls[0] }, (tab) => {
      if (chrome.runtime.lastError) {
        console.error('❌ Failed to open tab:', chrome.runtime.lastError);
      } else {
        console.log('✅ Web app opened in new tab:', tab.id);
        window.close();
      }
    });
  }

  // Sync bookmarks
  async syncBookmarks() {
    if (this.isSyncing) {
      console.log('⏭️ Sync already in progress');
      return;
    }

    console.log('🔄 Starting sync process...');
    
    this.isSyncing = true;
    this.elements.syncBookmarksBtn.disabled = true;
    this.updateSyncButton('🔄 Checking...');

    try {
      // Check if sync is needed
      const syncCheck = await this.checkSyncNeeded();
      console.log('🔍 Sync check result:', syncCheck);

      if (!syncCheck.needsSync) {
        console.log('✅ No sync needed');
        this.updateStatus(true, '✅ Already Up to Date');
        this.updateSyncButton('✅ Up to Date');
        
        setTimeout(() => this.resetSyncButton(), 2000);
        return;
      }

      // Perform sync
      await this.performSync(syncCheck);
      
    } catch (error) {
      console.error('❌ Sync error:', error);
      this.updateStatus(false, '❌ Sync Failed');
      this.resetSyncButton();
    }
  }

  // Check if sync is needed
  async checkSyncNeeded() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['lastSyncTime', 'lastBookmarkCount'], (result) => {
        const now = Date.now();
        const lastSyncTime = result.lastSyncTime ? new Date(result.lastSyncTime).getTime() : 0;
        const lastCount = result.lastBookmarkCount || 0;
        
        const timeSinceLastSync = now - lastSyncTime;
        const fiveMinutes = 5 * 60 * 1000;
        
        const needsSync = !lastSyncTime || 
                         this.bookmarkCount !== lastCount || 
                         timeSinceLastSync > fiveMinutes;
        
        const reason = !lastSyncTime ? 'first-time' :
                      this.bookmarkCount !== lastCount ? 'count-changed' :
                      timeSinceLastSync > fiveMinutes ? 'time-elapsed' : 'up-to-date';
        
        resolve({ needsSync, reason });
      });
    });
  }

  // Perform the actual sync
  async performSync(syncCheck) {
    const reasonText = {
      'first-time': 'First sync',
      'count-changed': 'New bookmarks detected',
      'time-elapsed': 'Scheduled sync'
    };
    
    this.updateSyncButton(`🔄 ${reasonText[syncCheck.reason]}...`);
    
    // Get current bookmarks
    chrome.bookmarks.getTree(async (bookmarkTree) => {
      if (chrome.runtime.lastError) {
        throw new Error(`Failed to get bookmarks: ${chrome.runtime.lastError.message}`);
      }
      
      const count = this.countBookmarks(bookmarkTree);
      this.updateBookmarkCount(count);
      
      // Send sync request to web app
      await this.sendSyncRequest(count, syncCheck.reason);
    });
  }

  // Send sync request to web app
  async sendSyncRequest(count, reason) {
    const webAppUrls = [
      'http://localhost:*/*',
      'https://localhost:*/*',
      'https://*.netlify.app/*',
      'https://*.vercel.app/*'
    ];
    
    const tabs = await chrome.tabs.query({ url: webAppUrls });
    
    if (!tabs || tabs.length === 0) {
      throw new Error('No web app tabs found');
    }
    
    // Set up response listener
    let syncCompleted = false;
    const responseTimeout = setTimeout(() => {
      if (!syncCompleted) {
        console.log('⏰ Sync timeout');
        this.updateStatus(true, '⚠️ Sync may be incomplete');
        this.resetSyncButton();
      }
    }, 15000);
    
    const responseListener = (message) => {
      if (message.action === 'syncComplete') {
        syncCompleted = true;
        clearTimeout(responseTimeout);
        chrome.runtime.onMessage.removeListener(responseListener);
        
        this.handleSyncComplete(message.data);
      }
    };
    
    chrome.runtime.onMessage.addListener(responseListener);
    
    // Send sync request to responsive tabs
    for (const tab of tabs) {
      try {
        await chrome.tabs.sendMessage(tab.id, {
          action: 'notifyWebApp',
          event: 'syncRequested',
          data: { count, reason, timestamp: Date.now() }
        });
        
        console.log('📨 Sync request sent to tab:', tab.id);
        break; // Only send to first responsive tab
      } catch (error) {
        console.log('⚠️ Tab not ready:', error.message);
        continue;
      }
    }
  }

  // Handle sync completion
  handleSyncComplete(data) {
    console.log('✅ Sync completed:', data);
    
    this.updateLastSync();
    this.updateStatus(true, `✅ Synced ${this.bookmarkCount} bookmarks`);
    this.updateSyncButton('✅ Sync Complete');
    
    setTimeout(() => this.resetSyncButton(), 2000);
  }

  // Update sync button text
  updateSyncButton(text) {
    this.elements.syncBookmarksBtn.innerHTML = text;
  }

  // Reset sync button
  resetSyncButton() {
    this.elements.syncBookmarksBtn.disabled = false;
    this.elements.syncBookmarksBtn.innerHTML = '🔄 Sync Bookmarks';
    this.isSyncing = false;
  }
}

// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new PopupManager();
});