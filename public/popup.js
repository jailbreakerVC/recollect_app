// Chrome Extension Popup Script
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Popup script loaded');
  
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
    console.log('📊 Updating status:', { connected, message });
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
    });
  }
  
  // Inject content script if not present
  async function ensureContentScript(tabId) {
    try {
      console.log('💉 Injecting content script into tab:', tabId);
      
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content.js']
      });
      
      console.log('✅ Content script injected successfully');
      
      // Wait a moment for script to initialize
      await new Promise(resolve => setTimeout(resolve, 500));
      
      return true;
    } catch (error) {
      console.error('❌ Failed to inject content script:', error);
      return false;
    }
  }
  
  // Check if web app is open and responsive
  async function checkWebAppConnection() {
    console.log('🔍 Checking web app connection...');
    
    const webAppUrls = [
      'http://localhost:*/*',
      'https://localhost:*/*',
      'https://*.netlify.app/*',
      'https://*.vercel.app/*'
    ];
    
    try {
      const tabs = await chrome.tabs.query({ url: webAppUrls });
      console.log('📋 Found tabs:', tabs?.length || 0);
      
      if (tabs && tabs.length > 0) {
        // Try each tab until we find a responsive one
        for (const tab of tabs) {
          const isResponsive = await testTabResponsiveness(tab);
          if (isResponsive) {
            updateStatus(true, '✅ Connected to Web App');
            getBookmarkCount();
            return;
          }
        }
        
        // No responsive tabs found
        updateStatus(false, '⚠️ Web App Not Responsive');
      } else {
        updateStatus(false, '⚠️ Web App Not Open');
      }
    } catch (error) {
      console.error('❌ Error checking connection:', error);
      updateStatus(false, '❌ Connection Error');
    }
  }
  
  // Test if a specific tab is responsive
  async function testTabResponsiveness(tab) {
    console.log('🧪 Testing tab responsiveness:', tab.id, tab.url);
    
    try {
      // First, try to send a message to see if content script is loaded
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'testConnection'
      });
      
      console.log('📨 Tab response:', response);
      
      if (response && response.success) {
        if (response.responsive) {
          console.log('✅ Tab is responsive');
          return true;
        } else {
          console.log('⚠️ Tab not responsive');
          return false;
        }
      } else {
        console.log('❌ Invalid response from tab');
        return false;
      }
      
    } catch (error) {
      console.log('⚠️ Content script not responding, trying to inject:', error.message);
      
      // Try to inject content script
      const injected = await ensureContentScript(tab.id);
      if (!injected) {
        return false;
      }
      
      // Try again after injection
      try {
        const response = await chrome.tabs.sendMessage(tab.id, {
          action: 'testConnection'
        });
        
        console.log('📨 Tab response after injection:', response);
        return response && response.success && response.responsive;
      } catch (retryError) {
        console.error('❌ Still no response after injection:', retryError.message);
        return false;
      }
    }
  }
  
  // Get bookmark count from Chrome
  function getBookmarkCount() {
    console.log('📊 Getting bookmark count...');
    
    chrome.bookmarks.getTree((bookmarkTree) => {
      if (chrome.runtime.lastError) {
        console.error('❌ Failed to get bookmarks:', chrome.runtime.lastError);
        return;
      }
      
      const count = countBookmarks(bookmarkTree);
      console.log('📚 Bookmark count:', count);
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
    console.log('🌐 Opening web app...');
    
    // Try localhost first, then production URLs
    const urls = [
      'http://localhost:5173',
      'http://localhost:3000',
      'https://your-app.netlify.app',
      'https://your-app.vercel.app'
    ];
    
    // Open the first URL (localhost development)
    chrome.tabs.create({ url: urls[0] }, (tab) => {
      if (chrome.runtime.lastError) {
        console.error('❌ Failed to open tab:', chrome.runtime.lastError);
      } else {
        console.log('✅ Web app opened in new tab:', tab.id);
        window.close();
      }
    });
  });
  
  // Sync bookmarks with smart detection
  syncBookmarksBtn.addEventListener('click', async () => {
    if (isSyncing) {
      console.log('⏭️ Sync already in progress, skipping');
      return;
    }
    
    console.log('🔄 Starting sync process...');
    
    isSyncing = true;
    syncBookmarksBtn.disabled = true;
    syncBookmarksBtn.innerHTML = '🔄 Checking...';
    
    try {
      // First check if sync is needed
      const syncCheck = await checkIfSyncNeeded();
      console.log('🔍 Sync check result:', syncCheck);
      
      if (!syncCheck.needsSync) {
        console.log('✅ No sync needed');
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
      console.log('🔄 Sync reason:', reasonText[syncCheck.reason]);
      
      // Get current bookmarks
      chrome.bookmarks.getTree(async (bookmarkTree) => {
        if (chrome.runtime.lastError) {
          console.error('❌ Failed to get bookmarks:', chrome.runtime.lastError);
          updateStatus(false, '❌ Sync Failed');
          resetSyncButton();
          return;
        }
        
        const count = countBookmarks(bookmarkTree);
        updateBookmarkCount(count);
        console.log('📚 Current bookmark count:', count);
        
        // Find responsive web app tabs
        const webAppUrls = [
          'http://localhost:*/*',
          'https://localhost:*/*',
          'https://*.netlify.app/*',
          'https://*.vercel.app/*'
        ];
        
        try {
          const tabs = await chrome.tabs.query({ url: webAppUrls });
          
          if (tabs && tabs.length > 0) {
            console.log('📤 Sending sync request to web app...');
            
            let syncCompleted = false;
            let responseTimeout;
            
            // Set up response listener
            const responseListener = (message, sender, sendResponse) => {
              if (message.action === 'syncComplete') {
                console.log('✅ Sync completion notification received:', message.data);
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
            
            // Send sync request to responsive tabs
            let messageSent = false;
            for (const tab of tabs) {
              try {
                await chrome.tabs.sendMessage(tab.id, {
                  action: 'notifyWebApp',
                  event: 'syncRequested',
                  data: { 
                    count,
                    reason: syncCheck.reason,
                    timestamp: Date.now()
                  }
                });
                
                console.log('📨 Sync request sent to tab:', tab.id);
                messageSent = true;
                break; // Only need to send to one responsive tab
              } catch (error) {
                console.log('⚠️ Tab not ready for messages:', error.message);
                // Try to inject content script and retry
                const injected = await ensureContentScript(tab.id);
                if (injected) {
                  try {
                    await chrome.tabs.sendMessage(tab.id, {
                      action: 'notifyWebApp',
                      event: 'syncRequested',
                      data: { 
                        count,
                        reason: syncCheck.reason,
                        timestamp: Date.now()
                      }
                    });
                    
                    console.log('📨 Sync request sent to tab after injection:', tab.id);
                    messageSent = true;
                    break;
                  } catch (retryError) {
                    console.log('⚠️ Still failed after injection:', retryError.message);
                  }
                }
              }
            }
            
            if (!messageSent) {
              console.log('❌ Could not send sync request to any tab');
              updateStatus(false, '⚠️ Web App Not Responsive');
              resetSyncButton();
              chrome.runtime.onMessage.removeListener(responseListener);
              return;
            }
            
            // Timeout if no response in 10 seconds
            responseTimeout = setTimeout(() => {
              if (!syncCompleted) {
                console.log('⏰ Sync timeout - no response from web app');
                chrome.runtime.onMessage.removeListener(responseListener);
                updateStatus(true, '⚠️ Sync may be incomplete');
                resetSyncButton();
              }
            }, 10000);
            
          } else {
            console.log('❌ No web app tabs found');
            updateStatus(false, '⚠️ Web App Not Open');
            resetSyncButton();
          }
        } catch (error) {
          console.error('❌ Error during sync:', error);
          updateStatus(false, '❌ Sync Failed');
          resetSyncButton();
        }
      });
      
    } catch (error) {
      console.error('❌ Sync error:', error);
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
    console.log('📨 Popup received message:', message);
    
    if (message.action === 'syncStarted') {
      syncBookmarksBtn.innerHTML = '🔄 Syncing...';
    } else if (message.action === 'syncProgress') {
      syncBookmarksBtn.innerHTML = `🔄 ${message.data.status}...`;
    }
  });
  
  // Initial setup
  console.log('🚀 Initializing popup...');
  loadSyncInfo();
  getBookmarkCount();
  
  // Check connection immediately and then every 3 seconds
  checkWebAppConnection();
  setInterval(checkWebAppConnection, 3000);
  
  console.log('✅ Popup initialized successfully');
});