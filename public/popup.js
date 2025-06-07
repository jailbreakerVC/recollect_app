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
  let isSyncing = false;
  
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
    
    // Store last sync time
    chrome.storage.local.set({
      lastSyncTime: now.toISOString(),
      lastBookmarkCount: bookmarkCount
    });
  }
  
  // Load stored sync info
  function loadSyncInfo() {
    chrome.storage.local.get(['lastSyncTime', 'lastBookmarkCount'], (result) => {
      if (result.lastSyncTime) {
        const lastSync = new Date(result.lastSyncTime);
        lastSyncEl.textContent = lastSync.toLocaleTimeString();
      }
      
      if (result.lastBookmarkCount !== undefined) {
        // Don't overwrite current count, just use for comparison
      }
    });
  }
  
  // Check if web app is open and responsive
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
        // Test if web app is actually responsive
        testWebAppResponsiveness(tabs[0]);
      } else {
        updateStatus(false, '⚠️ Web App Not Open');
      }
    });
  }
  
  // Test if web app can receive messages
  function testWebAppResponsiveness(tab) {
    const testMessage = {
      action: 'notifyWebApp',
      event: 'connectionTest',
      data: { timestamp: Date.now() }
    };
    
    chrome.tabs.sendMessage(tab.id, testMessage, (response) => {
      if (chrome.runtime.lastError) {
        updateStatus(false, '⚠️ Web App Not Responsive');
      } else {
        updateStatus(true, '✅ Connected to Web App');
        getBookmarkCount();
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
  
  // Check if sync is needed
  function checkIfSyncNeeded() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['lastSyncTime', 'lastBookmarkCount'], (result) => {
        const now = Date.now();
        const lastSyncTime = result.lastSyncTime ? new Date(result.lastSyncTime).getTime() : 0;
        const lastCount = result.lastBookmarkCount || 0;
        
        // Sync if:
        // 1. Never synced before
        // 2. Bookmark count changed
        // 3. More than 5 minutes since last sync
        const timeSinceLastSync = now - lastSyncTime;
        const fiveMinutes = 5 * 60 * 1000;
        
        const needsSync = !lastSyncTime || 
                         bookmarkCount !== lastCount || 
                         timeSinceLastSync > fiveMinutes;
        
        resolve({
          needsSync,
          reason: !lastSyncTime ? 'first-time' :
                  bookmarkCount !== lastCount ? 'count-changed' :
                  timeSinceLastSync > fiveMinutes ? 'time-elapsed' : 'up-to-date'
        });
      });
    });
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
  
  // Sync bookmarks with smart detection
  syncBookmarksBtn.addEventListener('click', async () => {
    if (isSyncing) return;
    
    isSyncing = true;
    syncBookmarksBtn.disabled = true;
    syncBookmarksBtn.innerHTML = '🔄 Checking...';
    
    try {
      // First check if sync is needed
      const syncCheck = await checkIfSyncNeeded();
      
      if (!syncCheck.needsSync) {
        updateStatus(true, '✅ Already Up to Date');
        syncBookmarksBtn.innerHTML = '✅ Up to Date';
        
        setTimeout(() => {
          syncBookmarksBtn.innerHTML = '🔄 Sync Bookmarks';
          syncBookmarksBtn.disabled = false;
          isSyncing = false;
        }, 2000);
        return;
      }
      
      // Show sync reason
      const reasonText = {
        'first-time': 'First sync',
        'count-changed': 'New bookmarks detected',
        'time-elapsed': 'Scheduled sync'
      };
      
      syncBookmarksBtn.innerHTML = `🔄 ${reasonText[syncCheck.reason]}...`;
      
      // Get current bookmarks
      chrome.bookmarks.getTree((bookmarkTree) => {
        if (chrome.runtime.lastError) {
          console.error('Failed to get bookmarks:', chrome.runtime.lastError);
          updateStatus(false, '❌ Sync Failed');
          resetSyncButton();
          return;
        }
        
        const count = countBookmarks(bookmarkTree);
        updateBookmarkCount(count);
        
        // Notify web app to perform sync
        chrome.tabs.query({ 
          url: [
            'http://localhost:*/*',
            'https://localhost:*/*',
            'https://*.netlify.app/*',
            'https://*.vercel.app/*'
          ] 
        }, (tabs) => {
          if (tabs && tabs.length > 0) {
            let syncCompleted = false;
            let responseTimeout;
            
            // Set up response listener
            const responseListener = (message, sender, sendResponse) => {
              if (message.action === 'syncComplete') {
                syncCompleted = true;
                clearTimeout(responseTimeout);
                chrome.runtime.onMessage.removeListener(responseListener);
                
                updateLastSync();
                updateStatus(true, `✅ Synced ${count} bookmarks`);
                syncBookmarksBtn.innerHTML = '✅ Sync Complete';
                
                setTimeout(() => {
                  resetSyncButton();
                }, 2000);
              }
            };
            
            chrome.runtime.onMessage.addListener(responseListener);
            
            // Send sync request to web app
            for (const tab of tabs) {
              chrome.tabs.sendMessage(tab.id, {
                action: 'notifyWebApp',
                event: 'syncRequested',
                data: { 
                  count,
                  reason: syncCheck.reason,
                  timestamp: Date.now()
                }
              }, () => {
                if (chrome.runtime.lastError) {
                  console.log('Tab not ready for messages:', chrome.runtime.lastError.message);
                }
              });
            }
            
            // Timeout if no response in 10 seconds
            responseTimeout = setTimeout(() => {
              if (!syncCompleted) {
                chrome.runtime.onMessage.removeListener(responseListener);
                updateStatus(true, '⚠️ Sync may be incomplete');
                resetSyncButton();
              }
            }, 10000);
            
          } else {
            updateStatus(false, '⚠️ Web App Not Open');
            resetSyncButton();
          }
        });
      });
      
    } catch (error) {
      console.error('Sync error:', error);
      updateStatus(false, '❌ Sync Failed');
      resetSyncButton();
    }
  });
  
  function resetSyncButton() {
    syncBookmarksBtn.disabled = false;
    syncBookmarksBtn.innerHTML = '🔄 Sync Bookmarks';
    isSyncing = false;
  }
  
  // Listen for messages from web app
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'syncStarted') {
      syncBookmarksBtn.innerHTML = '🔄 Syncing...';
    } else if (message.action === 'syncProgress') {
      syncBookmarksBtn.innerHTML = `🔄 ${message.data.status}...`;
    }
  });
  
  // Initial setup
  loadSyncInfo();
  checkWebAppConnection();
  getBookmarkCount();
  
  // Refresh connection status every 3 seconds
  setInterval(checkWebAppConnection, 3000);
});