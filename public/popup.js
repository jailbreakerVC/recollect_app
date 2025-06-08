// Chrome Extension Popup Script - Enhanced with Contextual Search
class PopupManager {
  constructor() {
    this.isConnected = false;
    this.bookmarkCount = 0;
    this.isSyncing = false;
    this.contextualSearchEnabled = true;
    this.currentPageContext = null;
    this.contextualResults = [];
    this.elements = {};
    
    this.init();
  }

  init() {
    console.log('🚀 Popup initializing with contextual search...');
    
    this.cacheElements();
    this.setupEventListeners();
    this.loadStoredData();
    this.startConnectionMonitoring();
    this.loadContextualSearchResults();
    
    console.log('✅ Popup initialized successfully');
  }

  cacheElements() {
    this.elements = {
      status: document.getElementById('status'),
      stats: document.getElementById('stats'),
      bookmarkCount: document.getElementById('bookmarkCount'),
      lastSync: document.getElementById('lastSync'),
      openWebAppBtn: document.getElementById('openWebApp'),
      syncBookmarksBtn: document.getElementById('syncBookmarks'),
      searchContextualBtn: document.getElementById('searchContextual'),
      contextualToggle: document.getElementById('contextualToggle'),
      pageContext: document.getElementById('pageContext'),
      pageContextContent: document.getElementById('pageContextContent'),
      contextualResults: document.getElementById('contextualResults'),
      contextualResultsContent: document.getElementById('contextualResultsContent')
    };
  }

  setupEventListeners() {
    this.elements.openWebAppBtn.addEventListener('click', () => this.openWebApp());
    this.elements.syncBookmarksBtn.addEventListener('click', () => this.syncBookmarks());
    this.elements.searchContextualBtn.addEventListener('click', () => this.performContextualSearch());
    this.elements.contextualToggle.addEventListener('change', (e) => this.toggleContextualSearch(e.target.checked));
    
    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleBackgroundMessage(message, sender, sendResponse);
    });
  }

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
      case 'contextualSearchResults':
        this.handleContextualSearchResults(message.results, message.context);
        break;
    }
    
    sendResponse({ success: true });
  }

  updateStatus(connected, message) {
    console.log('📊 Updating status:', { connected, message });
    
    this.isConnected = connected;
    this.elements.status.className = `status ${connected ? 'connected' : 'disconnected'}`;
    this.elements.status.innerHTML = message;
    
    this.elements.stats.style.display = connected ? 'block' : 'none';
  }

  updateBookmarkCount(count) {
    this.bookmarkCount = count;
    this.elements.bookmarkCount.textContent = count.toLocaleString();
  }

  updateLastSync() {
    const now = new Date();
    this.elements.lastSync.textContent = now.toLocaleTimeString();
    
    chrome.storage.local.set({
      lastSyncTime: now.toISOString(),
      lastBookmarkCount: this.bookmarkCount
    });
  }

  loadStoredData() {
    chrome.storage.local.get(['lastSyncTime', 'lastBookmarkCount', 'contextualSearchEnabled'], (result) => {
      if (result.lastSyncTime) {
        const lastSync = new Date(result.lastSyncTime);
        this.elements.lastSync.textContent = lastSync.toLocaleTimeString();
      }
      
      if (result.contextualSearchEnabled !== undefined) {
        this.contextualSearchEnabled = result.contextualSearchEnabled;
        this.elements.contextualToggle.checked = this.contextualSearchEnabled;
      }
    });
  }

  async loadContextualSearchResults() {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getContextualSearchResults'
      });

      if (response?.success) {
        this.currentPageContext = response.context;
        this.contextualResults = response.results || [];
        
        this.updatePageContextDisplay();
        this.updateContextualResultsDisplay();
      }
    } catch (error) {
      console.log('Could not load contextual search results:', error.message);
    }
  }

  updatePageContextDisplay() {
    if (!this.currentPageContext) {
      this.elements.pageContext.style.display = 'none';
      return;
    }

    const context = this.currentPageContext;
    const contextHtml = `
      <div class="page-context-item"><strong>Title:</strong> ${this.truncateText(context.title, 40)}</div>
      <div class="page-context-item"><strong>Domain:</strong> ${context.domain}</div>
      ${context.technology && context.technology.length > 0 ? 
        `<div class="page-context-item"><strong>Tech:</strong> ${context.technology.join(', ')}</div>` : ''}
    `;
    
    this.elements.pageContextContent.innerHTML = contextHtml;
    this.elements.pageContext.style.display = 'block';
  }

  updateContextualResultsDisplay() {
    if (!this.contextualResults || this.contextualResults.length === 0) {
      this.elements.contextualResults.style.display = 'none';
      return;
    }

    const resultsHtml = this.contextualResults.map(result => `
      <div class="contextual-result">
        <a href="${result.url}" target="_blank" class="contextual-result-title">
          ${this.truncateText(result.title, 50)}
        </a>
        <div class="contextual-result-url">${this.truncateText(result.url, 60)}</div>
        <div class="contextual-result-score">
          ${Math.round(result.similarity_score * 100)}% match (${result.search_type})
        </div>
      </div>
    `).join('');
    
    this.elements.contextualResultsContent.innerHTML = resultsHtml;
    this.elements.contextualResults.style.display = 'block';
  }

  truncateText(text, maxLength) {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  }

  async toggleContextualSearch(enabled) {
    this.contextualSearchEnabled = enabled;
    
    // Save preference
    chrome.storage.local.set({ contextualSearchEnabled: enabled });
    
    // Notify background script
    try {
      await chrome.runtime.sendMessage({
        action: 'toggleContextualSearch',
        enabled: enabled
      });
      
      console.log('🔍 Contextual search:', enabled ? 'enabled' : 'disabled');
    } catch (error) {
      console.log('Could not toggle contextual search:', error.message);
    }
  }

  async performContextualSearch() {
    if (!this.contextualSearchEnabled) {
      alert('Contextual search is disabled. Please enable it first.');
      return;
    }

    console.log('🔍 Performing manual contextual search...');
    
    this.elements.searchContextualBtn.disabled = true;
    this.elements.searchContextualBtn.innerHTML = '🔍 Searching...';

    try {
      // Get current active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab || !tab.id) {
        throw new Error('No active tab found');
      }

      // Request contextual search
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'searchRelatedBookmarks'
      });

      if (response?.success) {
        this.contextualResults = response.results || [];
        this.updateContextualResultsDisplay();
        
        console.log(`✅ Found ${this.contextualResults.length} related bookmarks`);
      } else {
        throw new Error(response?.error || 'Search failed');
      }
    } catch (error) {
      console.error('Contextual search failed:', error);
      alert(`Contextual search failed: ${error.message}`);
    } finally {
      this.elements.searchContextualBtn.disabled = false;
      this.elements.searchContextualBtn.innerHTML = '🎯 Find Related Bookmarks';
    }
  }

  handleContextualSearchResults(results, context) {
    console.log('📨 Received contextual search results:', results);
    
    this.contextualResults = results || [];
    this.currentPageContext = context;
    
    this.updatePageContextDisplay();
    this.updateContextualResultsDisplay();
  }

  startConnectionMonitoring() {
    this.checkConnection();
    setInterval(() => this.checkConnection(), 3000);
  }

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

  async testTabResponsiveness(tab) {
    console.log('🧪 Testing tab responsiveness:', tab.id);
    
    try {
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'testConnection'
      });
      
      return response?.success && response?.responsive;
    } catch (error) {
      console.log('⚠️ Tab not responsive, trying content script injection:', error.message);
      
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
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
      const syncCheck = await this.checkSyncNeeded();
      console.log('🔍 Sync check result:', syncCheck);

      if (!syncCheck.needsSync) {
        console.log('✅ No sync needed');
        this.updateStatus(true, '✅ Already Up to Date');
        this.updateSyncButton('✅ Up to Date');
        
        setTimeout(() => this.resetSyncButton(), 2000);
        return;
      }

      await this.performSync(syncCheck);
      
    } catch (error) {
      console.error('❌ Sync error:', error);
      this.updateStatus(false, '❌ Sync Failed');
      this.resetSyncButton();
    }
  }

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

  async performSync(syncCheck) {
    const reasonText = {
      'first-time': 'First sync',
      'count-changed': 'New bookmarks detected',
      'time-elapsed': 'Scheduled sync'
    };
    
    this.updateSyncButton(`🔄 ${reasonText[syncCheck.reason]}...`);
    
    chrome.bookmarks.getTree(async (bookmarkTree) => {
      if (chrome.runtime.lastError) {
        throw new Error(`Failed to get bookmarks: ${chrome.runtime.lastError.message}`);
      }
      
      const count = this.countBookmarks(bookmarkTree);
      this.updateBookmarkCount(count);
      
      await this.sendSyncRequest(count, syncCheck.reason);
    });
  }

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
    
    for (const tab of tabs) {
      try {
        await chrome.tabs.sendMessage(tab.id, {
          action: 'notifyWebApp',
          event: 'syncRequested',
          data: { count, reason, timestamp: Date.now() }
        });
        
        console.log('📨 Sync request sent to tab:', tab.id);
        break;
      } catch (error) {
        console.log('⚠️ Tab not ready:', error.message);
        continue;
      }
    }
  }

  handleSyncComplete(data) {
    console.log('✅ Sync completed:', data);
    
    this.updateLastSync();
    this.updateStatus(true, `✅ Synced ${this.bookmarkCount} bookmarks`);
    this.updateSyncButton('✅ Sync Complete');
    
    setTimeout(() => this.resetSyncButton(), 2000);
  }

  updateSyncButton(text) {
    this.elements.syncBookmarksBtn.innerHTML = text;
  }

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