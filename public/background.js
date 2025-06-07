// Chrome Extension Background Script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getBookmarks') {
    chrome.bookmarks.getTree((bookmarkTree) => {
      const bookmarks = extractBookmarks(bookmarkTree);
      sendResponse({ success: true, bookmarks });
    });
    return true; // Keep message channel open for async response
  }
  
  if (request.action === 'addBookmark') {
    chrome.bookmarks.create({
      title: request.title,
      url: request.url,
      parentId: request.parentId
    }, (bookmark) => {
      sendResponse({ success: true, bookmark });
    });
    return true;
  }
  
  if (request.action === 'removeBookmark') {
    chrome.bookmarks.remove(request.id, () => {
      sendResponse({ success: true });
    });
    return true;
  }
});

function extractBookmarks(bookmarkTree, folder = '') {
  let bookmarks = [];
  
  function traverse(nodes, currentFolder) {
    for (const node of nodes) {
      if (node.url) {
        // This is a bookmark
        bookmarks.push({
          id: node.id,
          title: node.title,
          url: node.url,
          dateAdded: new Date(node.dateAdded).toISOString(),
          folder: currentFolder,
          parentId: node.parentId
        });
      } else if (node.children) {
        // This is a folder
        const folderName = currentFolder ? `${currentFolder}/${node.title}` : node.title;
        traverse(node.children, folderName);
      }
    }
  }
  
  traverse(bookmarkTree, folder);
  return bookmarks;
}

// Listen for bookmark changes and notify web app
chrome.bookmarks.onCreated.addListener((id, bookmark) => {
  notifyWebApp('bookmarkCreated', bookmark);
});

chrome.bookmarks.onRemoved.addListener((id, removeInfo) => {
  notifyWebApp('bookmarkRemoved', { id, removeInfo });
});

chrome.bookmarks.onChanged.addListener((id, changeInfo) => {
  notifyWebApp('bookmarkChanged', { id, changeInfo });
});

function notifyWebApp(event, data) {
  // Send message to content script to notify web app
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'notifyWebApp',
        event,
        data
      });
    }
  });
}