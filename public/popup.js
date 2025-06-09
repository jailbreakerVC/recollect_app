// Chrome Extension Popup Script - Beautiful Dark Theme
class PopupManager {
  constructor() {
    this.isConnected = false;
    this.bookmarkCount = 0;
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
          
          // Highlight the search results section with a subtle animation
          if (this.elements.searchSection && searchData.results && searchData.results.length > 0) {
            this.elements.searchSection.style.animation = 'fadeIn 0.5s ease-in-out';
          }
        }
      }
    });
  }

  cacheElements() {
    this.elements = {
      bookmarkCount: document.getElementById('bookmarkCount'),
      lastSync: document.getElementById('lastSync'),
      statusIndicator: document.getElementById('statusIndicator'),
      statusText: document.getElementById('statusText'),
      searchSection: document.getElementById('searchSection'),
      searchQuery: document.getElementById('searchQuery'),
      searchQueryText: document.getElementById('searchQueryText'),
      searchTitle: document.getElementById('searchTitle'),
      searchResults: document.getElementById('searchResults'),
      noResults: document.getElementById('noResults'),
      openWebAppBtn: document.getElementById('openWebAppBtn')
    };
  }

  setupEventListeners() {
    this.elements.openWebAppBtn.addEventListener('click', () => this.openWebApp());
    
    // Listen for storage changes (for real-time updates)
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local' && changes.lastSearchResults) {
        this.loadSearchResults();
      }
    });
  }

  async loadSearchResults() {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getSearchResults'
      });

      if (response && response.success && response.searchData) {
        this.displaySearchResults(response.searchData);
      } else {
        this.showNoResults();
      }
    } catch (error) {
      this.showNoResults();
    }
  }

  displaySearchResults(searchData) {
    const { results, query, searchType, timestamp } = searchData;
    
    if (!results || results.length === 0) {
      this.showNoResults();
      return;
    }

    // Show search query if available
    if (query) {
      this.elements.searchQueryText.textContent = query;
      this.elements.searchQuery.classList.remove('hidden');
    } else {
      this.elements.searchQuery.classList.add('hidden');
    }

    // Update title based on search type
    const searchTypeLabels = {
      keyword: '🔍 Keyword Search Results',
      context: '🤖 Related Bookmarks Found',
      manual: '📋 Search Results'
    };
    
    const titleText = searchTypeLabels[searchType] || '📋 Found bookmarks:';
    this.elements.searchTitle.innerHTML = `
      <span>${this.getSearchTypeIcon(searchType)}</span>
      <span>${titleText}</span>
    `;

    // Add timestamp info for recent searches
    const timeSinceSearch = Date.now() - timestamp;
    if (timeSinceSearch < 30000) { // Less than 30 seconds
      const timeText = timeSinceSearch < 1000 ? 'just now' : `${Math.round(timeSinceSearch / 1000)}s ago`;
      this.elements.searchTitle.innerHTML += ` <span style="color: rgba(255,255,255,0.5); font-size: 12px;">(${timeText})</span>`;
    }

    // Display results
    const resultsHtml = results.map((result, index) => `
      <div class="search-result" data-index="${index}" data-url="${this.escapeHtml(result.url)}">
        <div class="result-title">${this.escapeHtml(result.title || 'Untitled')}</div>
        <div class="result-url">${this.escapeHtml(this.truncateUrl(result.url))}</div>
        <div class="result-meta">
          <span class="result-type">${this.getSearchTypeLabel(result.search_type)}</span>
          <span class="result-score">${Math.round((result.similarity_score || 0.5) * 100)}%</span>
        </div>
      </div>
    `).join('');
    
    this.elements.searchResults.innerHTML = resultsHtml;
    this.elements.noResults.classList.add('hidden');

    // Add click handlers for opening bookmarks
    this.elements.searchResults.querySelectorAll('.search-result').forEach((element) => {
      element.addEventListener('click', (e) => {
        e.preventDefault();
        
        const url = element.dataset.url;
        if (url) {
          // Open in new tab
          chrome.tabs.create({ url: url });
          
          // Close popup after opening bookmark
          window.close();
        }
      });
    });

    // Add keyboard navigation
    this.setupKeyboardNavigation();
  }

  showNoResults() {
    this.elements.searchQuery.classList.add('hidden');
    this.elements.searchResults.innerHTML = '';
    this.elements.noResults.classList.remove('hidden');
    
    this.elements.searchTitle.innerHTML = `
      <span>🔍</span>
      <span>Ready to search</span>
    `;
  }

  setupKeyboardNavigation() {
    const results = this.elements.searchResults.querySelectorAll('.search-result');
    let selectedIndex = 0;

    // Highlight first result
    if (results.length > 0) {
      results[0].style.background = 'rgba(100, 255, 218, 0.1)';
      results[0].style.borderColor = 'rgba(100, 255, 218, 0.3)';
    }

    // Handle keyboard events
    document.addEventListener('keydown', (e) => {
      if (results.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          // Remove highlight from current
          results[selectedIndex].style.background = 'rgba(255, 255, 255, 0.05)';
          results[selectedIndex].style.borderColor = 'rgba(255, 255, 255, 0.1)';
          
          selectedIndex = (selectedIndex + 1) % results.length;
          
          // Add highlight to new
          results[selectedIndex].style.background = 'rgba(100, 255, 218, 0.1)';
          results[selectedIndex].style.borderColor = 'rgba(100, 255, 218, 0.3)';
          results[selectedIndex].scrollIntoView({ block: 'nearest' });
          break;
          
        case 'ArrowUp':
          e.preventDefault();
          // Remove highlight from current
          results[selectedIndex].style.background = 'rgba(255, 255, 255, 0.05)';
          results[selectedIndex].style.borderColor = 'rgba(255, 255, 255, 0.1)';
          
          selectedIndex = selectedIndex === 0 ? results.length - 1 : selectedIndex - 1;
          
          // Add highlight to new
          results[selectedIndex].style.background = 'rgba(100, 255, 218, 0.1)';
          results[selectedIndex].style.borderColor = 'rgba(100, 255, 218, 0.3)';
          results[selectedIndex].scrollIntoView({ block: 'nearest' });
          break;
          
        case 'Enter':
          e.preventDefault();
          const selectedResult = results[selectedIndex];
          if (selectedResult) {
            const url = selectedResult.dataset.url;
            if (url) {
              chrome.tabs.create({ url: url });
              window.close();
            }
          }
          break;
      }
    });
  }

  getSearchTypeIcon(searchType) {
    switch (searchType) {
      case 'keyword':
        return '🔍';
      case 'context':
        return '🤖';
      case 'manual':
        return '📋';
      default:
        return '📋';
    }
  }

  getSearchTypeLabel(searchType) {
    switch (searchType) {
      case 'semantic':
        return 'AI Match';
      case 'trigram':
        return 'Text Match';
      case 'keyword':
        return 'Keyword';
      case 'context':
        return 'Context';
      case 'text_fallback':
        return 'Simple Match';
      default:
        return 'Match';
    }
  }

  truncateUrl(url, maxLength = 40) {
    if (!url) return '';
    if (url.length <= maxLength) return url;
    
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname;
      const path = urlObj.pathname;
      
      if (domain.length + 3 >= maxLength) {
        return domain.substring(0, maxLength - 3) + '...';
      }
      
      const remainingLength = maxLength - domain.length - 3;
      const truncatedPath = path.length > remainingLength ? 
        path.substring(0, remainingLength) + '...' : path;
      
      return domain + truncatedPath;
    } catch {
      return url.substring(0, maxLength) + '...';
    }
  }

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  updateStatus(connected, message) {
    this.isConnected = connected;
    this.elements.statusText.textContent = connected ? 'Connected' : 'Disconnected';
    
    // Update status indicator
    this.elements.statusIndicator.className = `status-indicator ${
      connected ? 'status-connected' : 'status-disconnected'
    }`;
  }

  updateBookmarkCount(count) {
    this.bookmarkCount = count;
    this.elements.bookmarkCount.textContent = count.toLocaleString();
  }

  updateLastSync() {
    const now = new Date();
    this.elements.lastSync.textContent = now.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    
    chrome.storage.local.set({
      lastSyncTime: now.toISOString(),
      lastBookmarkCount: this.bookmarkCount
    });
  }

  loadStoredData() {
    chrome.storage.local.get([
      'lastSyncTime', 
      'lastBookmarkCount'
    ], (result) => {
      if (result.lastSyncTime) {
        const lastSync = new Date(result.lastSyncTime);
        this.elements.lastSync.textContent = lastSync.toLocaleTimeString([], { 
          hour: '2-digit', 
          minute: '2-digit' 
        });
      }
      
      if (result.lastBookmarkCount) {
        this.updateBookmarkCount(result.lastBookmarkCount);
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
            this.updateStatus(true, 'Connected');
            this.getBookmarkCount();
            return;
          }
        }
        
        this.updateStatus(false, 'Not Responsive');
      } else {
        this.updateStatus(false, 'Not Open');
      }
    } catch (error) {
      this.updateStatus(false, 'Error');
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
}

// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new PopupManager();
});

// Add CSS animation for fade in effect
const style = document.createElement('style');
style.textContent = `
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;
document.head.appendChild(style);