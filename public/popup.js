// Chrome Extension Popup Script
document.addEventListener('DOMContentLoaded', () => {
  const statusEl = document.getElementById('status');
  const statsEl = document.getElementById('stats');
  const bookmarkCountEl = document.getElementById('bookmarkCount');
  const lastSyncEl = document.getElementById('lastSync');
  const openWebAppBtn = document.getElementById('openWebApp');
  const syncBookmarksBtn = document.getElementById('syncBookmarks');
  
  let isConnected = false;
  let bookmarkCount = 0;
  
  // Update status display
  function updateStatus(connected, message) {
    isConnected = connected;
    statusEl.className = `status ${connected ? 'connected' : 'disconnected'}`;
    statusEl.innerHTML = message;
    
    if (connected) {
      statsEl.style.display = 'block';
    } else {
      statsEl.style.display = 'none';
    }
  }
  
  // Update bookmark count
  function updateBookmarkCount(count) {
    bookmarkCount = count;
    bookmarkCountEl.textContent = count.toLocaleString();
  }
  
  // Update last sync time
  function updateLastSync() {
    const now = new Date();
    lastSyncEl.textContent = now.toLocaleTimeString();
  }
  
  // Check if web app is open
  function checkWebAppConnection() {
    const webAppUrls = [
      'http://localhost:*/*',
      'https://localhost:*/*',
      'https://*.netlify.app/*',
      'https://*.vercel.app/*'
    ];
    
    chrome.tabs.query({ url: webAppUrls }, (tabs) => {
      if (chrome.runtime.lastError) {
        updateStatus(false, '❌ Connection Error');
        return;
      }
      
      if (tabs && tabs.length > 0) {
        updateStatus(true, '✅ Connected to Web App');
        
        // Try to get bookmark count
        getBookmarkCount();
      } else {
        updateStatus(false, '⚠️ Web App Not Open');
      }
    });
  }
  
  // Get bookmark count from Chrome
  function getBookmarkCount() {
    chrome.bookmarks.getTree((bookmarkTree) => {
      if (chrome.runtime.lastError) {
        console.error('Failed to get bookmarks:', chrome.runtime.lastError);
        return;
      }
      
      const count = countBookmarks(bookmarkTree);
      updateBookmarkCount(count);
    });
  }
  
  // Count bookmarks recursively
  function countBookmarks(bookmarkTree) {
    let count = 0;
    
    function traverse(nodes) {
      if (!nodes) return;
      
      for (const node of nodes) {
        if (node.url) {
          count++;
        } else if (node.children) {
          traverse(node.children);
        }
      }
    }
    
    traverse(bookmarkTree);
    return count;
  }
  
  // Open web app
  openWebAppBtn.addEventListener('click', () => {
    // Try localhost first, then production URLs
    const urls = [
      'http://localhost:5173',
      'http://localhost:3000',
      'https://your-app.netlify.app',
      'https://your-app.vercel.app'
    ];
    
    // Open the first URL (localhost development)
    chrome.tabs.create({ url: urls[0] }, () => {
      if (chrome.runtime.lastError) {
        console.error('Failed to open tab:', chrome.runtime.lastError);
      } else {
        window.close();
      }
    });
  });
  
  // Sync bookmarks
  syncBookmarksBtn.addEventListener('click', () => {
    syncBookmarksBtn.disabled = true;
    syncBookmarksBtn.innerHTML = '🔄 Syncing...';
    
    chrome.bookmarks.getTree((bookmarkTree) => {
      if (chrome.runtime.lastError) {
        console.error('Failed to get bookmarks:', chrome.runtime.lastError);
        updateStatus(false, '❌ Sync Failed');
        resetSyncButton();
        return;
      }
      
      const count = countBookmarks(bookmarkTree);
      updateBookmarkCount(count);
      updateLastSync();
      updateStatus(true, `✅ Synced ${count} bookmarks`);
      
      // Notify web app if it's open
      chrome.tabs.query({ 
        url: [
          'http://localhost:*/*',
          'https://localhost:*/*',
          'https://*.netlify.app/*',
          'https://*.vercel.app/*'
        ] 
      }, (tabs) => {
        if (tabs && tabs.length > 0) {
          for (const tab of tabs) {
            chrome.tabs.sendMessage(tab.id, {
              action: 'notifyWebApp',
              event: 'syncRequested',
              data: { count }
            }, () => {
              // Ignore errors - tab might not have content script
              if (chrome.runtime.lastError) {
                console.log('Tab not ready for messages:', chrome.runtime.lastError.message);
              }
            });
          }
        }
      });
      
      resetSyncButton();
    });
  });
  
  function resetSyncButton() {
    syncBookmarksBtn.disabled = false;
    syncBookmarksBtn.innerHTML = '🔄 Sync Bookmarks';
  }
  
  // Initial connection check
  checkWebAppConnection();
  
  // Refresh connection status every 2 seconds
  setInterval(checkWebAppConnection, 2000);
  
  // Get initial bookmark count
  getBookmarkCount();
});