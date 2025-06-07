// Chrome Extension Background Script (Service Worker)

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Bookmark Manager Extension installed:', details.reason);
  
  if (details.reason === 'install') {
    // Open welcome page on first install
    chrome.tabs.create({
      url: 'http://localhost:5173'
    });
  }
});

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request);
  
  // Handle bookmark operations
  if (request.action === 'getBookmarks') {
    handleGetBookmarks(sendResponse);
    return true; // Keep message channel open for async response
  }
  
  if (request.action === 'addBookmark') {
    handleAddBookmark(request, sendResponse);
    return true;
  }
  
  if (request.action === 'removeBookmark') {
    handleRemoveBookmark(request, sendResponse);
    return true;
  }
  
  // Handle sync completion messages from content script
  if (request.action === 'syncComplete') {
    console.log('Sync completion received in background:', request.data);
    // Forward to popup if it's open
    chrome.runtime.sendMessage(request).catch(() => {
      // Popup might not be open, that's okay
      console.log('Popup not open to receive sync completion');
    });
    sendResponse({ success: true });
    return;
  }
  
  // Handle other actions synchronously
  sendResponse({ success: false, error: 'Unknown action' });
});

// Get all bookmarks
function handleGetBookmarks(sendResponse) {
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
      
      const bookmarks = extractBookmarks(bookmarkTree);
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
}

// Add a bookmark
function handleAddBookmark(request, sendResponse) {
  try {
    const { title, url, parentId } = request;
    
    if (!title || !url) {
      sendResponse({ 
        success: false, 
        error: 'Title and URL are required' 
      });
      return;
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
      
      // Notify web app of the change
      notifyWebApp('bookmarkCreated', bookmark);
    });
  } catch (error) {
    console.error('Error in handleAddBookmark:', error);
    sendResponse({ 
      success: false, 
      error: error.message 
    });
  }
}

// Remove a bookmark
function handleRemoveBookmark(request, sendResponse) {
  try {
    const { id } = request;
    
    if (!id) {
      sendResponse({ 
        success: false, 
        error: 'Bookmark ID is required' 
      });
      return;
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
      
      // Notify web app of the change
      notifyWebApp('bookmarkRemoved', { id });
    });
  } catch (error) {
    console.error('Error in handleRemoveBookmark:', error);
    sendResponse({ 
      success: false, 
      error: error.message 
    });
  }
}

// Extract bookmarks from Chrome's bookmark tree
function extractBookmarks(bookmarkTree, folder = '') {
  let bookmarks = [];
  
  function traverse(nodes, currentFolder) {
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
  }
  
  traverse(bookmarkTree, folder);
  return bookmarks;
}

// Listen for bookmark changes and notify web app
chrome.bookmarks.onCreated.addListener((id, bookmark) => {
  console.log('Bookmark created:', id, bookmark);
  notifyWebApp('bookmarkCreated', bookmark);
});

chrome.bookmarks.onRemoved.addListener((id, removeInfo) => {
  console.log('Bookmark removed:', id, removeInfo);
  notifyWebApp('bookmarkRemoved', { id, removeInfo });
});

chrome.bookmarks.onChanged.addListener((id, changeInfo) => {
  console.log('Bookmark changed:', id, changeInfo);
  notifyWebApp('bookmarkChanged', { id, changeInfo });
});

chrome.bookmarks.onMoved.addListener((id, moveInfo) => {
  console.log('Bookmark moved:', id, moveInfo);
  notifyWebApp('bookmarkMoved', { id, moveInfo });
});

// Notify web app of bookmark changes
async function notifyWebApp(event, data) {
  // Find tabs with the web app open
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
          
          // Wait a moment for script to initialize
          await new Promise(resolve => setTimeout(resolve, 500));
          
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

// Handle extension startup
chrome.runtime.onStartup.addListener(() => {
  console.log('Bookmark Manager Extension started');
});

// Keep service worker alive
chrome.runtime.onConnect.addListener((port) => {
  console.log('Content script connected');
});