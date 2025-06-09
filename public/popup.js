// Chrome Extension Popup Script - Enhanced with Auto-Opening Support
class PopupManager {
  constructor() {
    this.isConnected = false;
    this.bookmarkCount = 0;
    this.isSyncing = false;
    this.contextMenuEnabled = true;
    this.pageAnalysisEnabled = true;
    this.elements = {};
    
    this.init();
  }

  init() {
    this.cacheElements();
    this.setupEventListeners();
    this.loadStoredData();
    this.startConnectionMonitoring();
    this.loadSearchResults();
    this.handleAutoOpen();
  }

  handleAutoOpen() {
    // Check if popup was auto-opened due to search results
    chrome.storage.local.get(['lastSearchResults'], (result) => {
      const searchData = result.lastSearchResults;
      
      if (searchData && searchData.timestamp) {
        const timeSinceSearch = Date.now() - searchData.timestamp;
        
        // If search was recent (within 10 seconds), it was likely auto-opened
        if (timeSinceSearch < 10000) {
          // Clear the badge since user is now viewing results
          chrome.action.setBadgeText({ text: '' });
          
          // Highlight the search results section
          if (this.elements.searchResults && searchData.results.length > 0) {
            this.elements.searchResults.classList.add('auto-opened');
            
            // Remove highlight after 3 seconds
            setTimeout(() => {
              this.elements.searchResults.classList.remove('auto-opened');
            }, 3000);
          }
        }
      }
    });
  }

  cacheElements() {
    this.elements = {
      status: document.getElementById('status'),
      stats: document.getElementById('stats'),
      bookmarkCount: document.getElementById('bookmarkCount'),
      lastSync: document.getElementById('lastSync'),
      openWebAppBtn: document.getElementById('openWebApp'),
      syncBookmarksBtn: document.getElementById('syncBookmarks'),
      refreshResultsBtn: document.getElementById('refreshResults'),
      clearResultsBtn: document.getElementById('clearResults'),
      testSearchBtn: document.getElementById('testSearch'),
      contextMenuToggle: document.getElementById('contextMenuToggle'),
      pageAnalysisToggle: document.getElementById('pageAnalysisToggle'),
      searchResults: document.getElementById('searchResults'),
      searchQuery: document.getElementById('searchQuery'),
      searchQueryText: document.getElementById('searchQueryText'),
      searchResultsTitle: document.getElementById('searchResultsTitle'),
      searchResultsContent: document.getElementById('searchResultsContent')
    };
  }

  setupEventListeners() {
    this.elements.openWebAppBtn.addEventListener('click', () => this.openWebApp());
    this.elements.syncBookmarksBtn.addEventListener('click', () => this.syncBookmarks());
    this.elements.refreshResultsBtn.addEventListener('click', () => this.loadSearchResults());
    this.elements.clearResultsBtn.addEventListener('click', () => this.clearSearchResults());
    this.elements.testSearchBtn.addEventListener('click', () => this.testSearchFunction());
    this.elements.contextMenuToggle.addEventListener('change', (e) => this.toggleContextMenu(e.target.checked));
    this.elements.pageAnalysisToggle.addEventListener('change', (e) => this.togglePageAnalysis(e.target.checked));
    
    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleBackgroundMessage(message, sender, sendResponse);
    });

    // Listen for storage changes (for real-time updates)
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local' && changes.lastSearchResults) {
        this.loadSearchResults();
      }
    });
  }

  async testSearchFunction() {
    this.elements.testSearchBtn.disabled = true;
    this.elements.testSearchBtn.innerHTML = '🧪 Testing...';
    
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'testSearch'
      });

      if (response?.success) {
        this.showTemporaryMessage(`✅ Test passed: ${response.message}`, 'success');
      } else {
        this.showTemporaryMessage(`❌ Test failed: ${response.error}`, 'error');
      }
    } catch (error) {
      this.showTemporaryMessage(`❌ Test error: ${error.message}`, 'error');
    } finally {
      this.elements.testSearchBtn.disabled = false;
      this.elements.testSearchBtn.innerHTML = '🧪 Test Search Function';
    }
  }

  handleBackgroundMessage(message, sender, sendResponse) {
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
      case 'searchResultsUpdated':
        this.loadSearchResults();
        break;
    }
    
    sendResponse({ success: true });
  }

  async loadSearchResults() {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getSearchResults'
      });

      if (response?.success && response.searchData) {
        this.displaySearchResults(response.searchData);
      } else {
        this.hideSearchResults();
      }
    } catch (error) {
      this.hideSearchResults();
    }
  }

  displaySearchResults(searchData) {
    const { results, query, searchType, timestamp } = searchData;
    
    if (!results || results.length === 0) {
      this.hideSearchResults();
      return;
    }

    // Show search query if available
    if (query) {
      this.elements.searchQueryText.textContent = query;
      this.elements.searchQuery.style.display = 'block';
    } else {
      this.elements.searchQuery.style.display = 'none';
    }

    // Update title based on search type
    const searchTypeLabels = {
      keyword: '🔍 Keyword Search Results',
      context: '🤖 Related Bookmarks Found',
      manual: '📋 Search Results'
    };
    
    this.elements.searchResultsTitle.textContent = searchTypeLabels[searchType] || '📋 Search Results';

    // Add timestamp info for recent searches
    const timeSinceSearch = Date.now() - timestamp;
    if (timeSinceSearch < 30000) { // Less than 30 seconds
      const timeText = timeSinceSearch < 1000 ? 'just now' : `${Math.round(timeSinceSearch / 1000)}s ago`;
      this.elements.searchResultsTitle.textContent += ` (${timeText})`;
    }

    // Display results
    const resultsHtml = results.map((result, index) => `
      <div class="search-result" data-index="${index}">
        <a href="${result.url}" target="_blank" class="search-result-title" data-url="${result.url}">
          ${this.truncateText(result.title, 45)}
        </a>
        <div class="search-result-url">${this.truncateText(result.url, 50)}</div>
        <div class="search-result-meta">
          <span class="search-result-type">${this.getSearchTypeLabel(result.search_type)}</span>
          <span class="search-result-score">${Math.round((result.similarity_score || 0.5) * 100)}%</span>
        </div>
      </div>
    `).join('');
    
    this.elements.searchResultsContent.innerHTML = resultsHtml;
    this.elements.searchResults.style.display = 'block';

    // Add click handlers for opening bookmarks
    this.elements.searchResultsContent.querySelectorAll('.search-result-title').forEach((link, index) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        
        // Open in new tab
        chrome.tabs.create({ url: link.dataset.url });
        
        // Close popup after opening bookmark
        window.close();
      });
    });

    // Add keyboard navigation
    this.setupKeyboardNavigation();
  }

  setupKeyboardNavigation() {
    const results = this.elements.searchResultsContent.querySelectorAll('.search-result');
    let selectedIndex = 0;

    // Highlight first result
    if (results.length > 0) {
      results[0].classList.add('keyboard-selected');
    }

    // Handle keyboard events
    document.addEventListener('keydown', (e) => {
      if (results.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          results[selectedIndex].classList.remove('keyboard-selected');
          selectedIndex = (selectedIndex + 1) % results.length;
          results[selectedIndex].classList.add('keyboard-selected');
          results[selectedIndex].scrollIntoView({ block: 'nearest' });
          break;
          
        case 'ArrowUp':
          e.preventDefault();
          results[selectedIndex].classList.remove('keyboard-selected');
          selectedIndex = selectedIndex === 0 ? results.length - 1 : selectedIndex - 1;
          results[selectedIndex].classList.add('keyboard-selected');
          results[selectedIndex].scrollIntoView({ block: 'nearest' });
          break;
          
        case 'Enter':
          e.preventDefault();
          const selectedLink = results[selectedIndex].querySelector('.search-result-title');
          if (selectedLink) {
            chrome.tabs.create({ url: selectedLink.dataset.url });
            window.close();
          }
          break;
      }
    });
  }

  hideSearchResults() {
    this.elements.searchResults.style.display = 'none';
  }

  async clearSearchResults() {
    try {
      await chrome.runtime.sendMessage({
        action: 'clearSearchResults'
      });
      
      this.hideSearchResults();
      
      // Show confirmation
      this.showTemporaryMessage('Search results cleared', 'success');
      
    } catch (error) {
      // Could not clear search results
    }
  }

  showTemporaryMessage(message, type = 'success') {
    // Create temporary message element
    const messageEl = document.createElement('div');
    messageEl.className = `temporary-message ${type}`;
    messageEl.textContent = message;
    
    const colors = {
      success: { bg: '#10b981', border: '#059669' },
      error: { bg: '#ef4444', border: '#dc2626' },
      info: { bg: '#3b82f6', border: '#2563eb' }
    };
    
    const color = colors[type] || colors.success;
    
    messageEl.style.cssText = `
      position: fixed;
      top: 10px;
      left: 50%;
      transform: translateX(-50%);
      background: ${color.bg};
      border: 1px solid ${color.border};
      color: white;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 12px;
      z-index: 1000;
      animation: fadeInOut 3s ease-in-out;
      max-width: 300px;
      text-align: center;
    `;
    
    // Add animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fadeInOut {
        0%, 100% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
        15%, 85% { opacity: 1; transform: translateX(-50%) translateY(0); }
      }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(messageEl);
    
    // Remove after animation
    setTimeout(() => {
      messageEl.remove();
      style.remove();
    }, 3000);
  }

  getSearchTypeLabel(searchType) {
    const labels = {
      keyword: 'Keyword',
      context: 'Context',
      semantic: 'AI',
      trigram: 'Text',
      manual: 'Search',
      text_fallback: 'Text'
    };
    
    return labels[searchType] || 'Match';
  }

  truncateText(text, maxLength) {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  }

  async toggleContextMenu(enabled) {
    this.contextMenuEnabled = enabled;
    
    // Save preference
    chrome.storage.local.set({ contextMenuEnabled: enabled });
    
    // Notify background script
    try {
      await chrome.runtime.sendMessage({
        action: 'toggleContextMenu',
        enabled: enabled
      });
    } catch (error) {
      // Could not toggle context menu
    }
  }

  async togglePageAnalysis(enabled) {
    this.pageAnalysisEnabled = enabled;
    
    // Save preference
    chrome.storage.local.set({ pageAnalysisEnabled: enabled });
    
    // Notify background script
    try {
      await chrome.runtime.sendMessage({
        action: 'togglePageAnalysis',
        enabled: enabled
      });
    } catch (error) {
      // Could not toggle page analysis
    }
  }

  updateStatus(connected, message) {
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
    chrome.storage.local.get([
      'lastSyncTime', 
      'lastBookmarkCount', 
      'contextMenuEnabled', 
      'pageAnalysisEnabled'
    ], (result) => {
      if (result.lastSyncTime) {
        const lastSync = new Date(result.lastSyncTime);
        this.elements.lastSync.textContent = lastSync.toLocaleTimeString();
      }
      
      if (result.contextMenuEnabled !== undefined) {
        this.contextMenuEnabled = result.contextMenuEnabled;
        this.elements.contextMenuToggle.checked = this.contextMenuEnabled;
      }
      
      if (result.pageAnalysisEnabled !== undefined) {
        this.pageAnalysisEnabled = result.pageAnalysisEnabled;
        this.elements.pageAnalysisToggle.checked = this.pageAnalysisEnabled;
      }
    });
  }

  startConnectionMonitoring() {
    this.checkConnection();
    setInterval(() => this.checkConnection(), 3000);
  }

  async checkConnection() {
    try {
      const webAppUrls = [
        'http://localhost:*/*',
        'https://localhost:*/*',
        'https://*.netlify.app/*',
        'https://*.vercel.app/*'
      ];
      
      const tabs = await chrome.tabs.query({ url: webAppUrls });
      
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
      this.updateStatus(false, '❌ Connection Error');
    }
  }

  async testTabResponsiveness(tab) {
    try {
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'testConnection'
      });
      
      return response?.success && response?.responsive;
    } catch (error) {
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
        return false;
      }
    }
  }

  getBookmarkCount() {
    chrome.bookmarks.getTree((bookmarkTree) => {
      if (chrome.runtime.lastError) {
        return;
      }
      
      const count = this.countBookmarks(bookmarkTree);
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
    const urls = [
      'http://localhost:5173',
      'http://localhost:3000'
    ];
    
    chrome.tabs.create({ url: urls[0] }, (tab) => {
      if (chrome.runtime.lastError) {
        // Failed to open tab
      } else {
        window.close();
      }
    });
  }

  async syncBookmarks() {
    if (this.isSyncing) {
      return;
    }

    this.isSyncing = true;
    this.elements.syncBookmarksBtn.disabled = true;
    this.updateSyncButton('🔄 Checking...');

    try {
      const syncCheck = await this.checkSyncNeeded();

      if (!syncCheck.needsSync) {
        this.updateStatus(true, '✅ Already Up to Date');
        this.updateSyncButton('✅ Up to Date');
        
        setTimeout(() => this.resetSyncButton(), 2000);
        return;
      }

      await this.performSync(syncCheck);
      
    } catch (error) {
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
        
        break;
      } catch (error) {
        continue;
      }
    }
  }

  handleSyncComplete(data) {
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