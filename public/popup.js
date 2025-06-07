// Chrome Extension Popup Script
document.addEventListener('DOMContentLoaded', () => {
  const statusEl = document.getElementById('status');
  const openWebAppBtn = document.getElementById('openWebApp');
  const syncBookmarksBtn = document.getElementById('syncBookmarks');
  
  // Check if web app is open
  chrome.tabs.query({ url: ['http://localhost:*/*', 'https://your-domain.com/*'] }, (tabs) => {
    if (tabs.length > 0) {
      statusEl.textContent = 'Connected to Web App';
      statusEl.className = 'status connected';
    } else {
      statusEl.textContent = 'Web App Not Open';
      statusEl.className = 'status disconnected';
    }
  });
  
  openWebAppBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: 'http://localhost:5173' });
    window.close();
  });
  
  syncBookmarksBtn.addEventListener('click', () => {
    chrome.bookmarks.getTree((bookmarkTree) => {
      const count = countBookmarks(bookmarkTree);
      statusEl.textContent = `Found ${count} bookmarks`;
      statusEl.className = 'status connected';
      
      // If web app is open, trigger sync
      chrome.tabs.query({ url: ['http://localhost:*/*', 'https://your-domain.com/*'] }, (tabs) => {
        if (tabs.length > 0) {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: 'notifyWebApp',
            event: 'syncRequested',
            data: { count }
          });
        }
      });
    });
  });
});

function countBookmarks(bookmarkTree) {
  let count = 0;
  function traverse(nodes) {
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