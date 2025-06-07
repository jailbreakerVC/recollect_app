// Chrome Extension Content Script
// This script runs in the context of the web page and facilitates communication

let messageQueue = [];
let isWebAppReady = false;

// Listen for messages from the web page
window.addEventListener('message', (event) => {
  // Only accept messages from the same origin
  if (event.origin !== window.location.origin) return;
  
  if (event.data.source === 'bookmark-manager-webapp') {
    // Forward the message to the background script
    chrome.runtime.sendMessage(event.data.payload, (response) => {
      // Send response back to web page
      window.postMessage({
        source: 'bookmark-manager-extension',
        requestId: event.data.requestId,
        response
      }, window.location.origin);
    });
  }
});

// Listen for messages from background script and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'notifyWebApp') {
    // Notify the web app of bookmark changes or sync requests
    const message = {
      source: 'bookmark-manager-extension',
      event: request.event,
      data: request.data
    };
    
    // If it's a sync request, also notify popup when sync completes
    if (request.event === 'syncRequested') {
      // Listen for sync completion from web app
      const syncCompleteListener = (event) => {
        if (event.data.source === 'bookmark-manager-webapp' && 
            event.data.type === 'syncComplete') {
          // Notify popup that sync is complete
          chrome.runtime.sendMessage({
            action: 'syncComplete',
            data: event.data.data
          });
          
          window.removeEventListener('message', syncCompleteListener);
        }
      };
      
      window.addEventListener('message', syncCompleteListener);
      
      // Remove listener after 15 seconds to prevent memory leaks
      setTimeout(() => {
        window.removeEventListener('message', syncCompleteListener);
      }, 15000);
    }
    
    window.postMessage(message, window.location.origin);
    sendResponse({ success: true });
  }
  
  // Handle connection test
  if (request.event === 'connectionTest') {
    sendResponse({ success: true, timestamp: Date.now() });
  }
});

// Create a function to inject extension availability flag
function injectExtensionFlag() {
  // Create a custom event to signal extension is ready
  const script = document.createElement('script');
  script.textContent = `
    (function() {
      window.bookmarkExtensionAvailable = true;
      window.dispatchEvent(new CustomEvent('bookmarkExtensionReady', {
        detail: { timestamp: Date.now() }
      }));
      
      // Set up communication bridge for sync completion
      window.notifyExtensionSyncComplete = function(data) {
        window.postMessage({
          source: 'bookmark-manager-webapp',
          type: 'syncComplete',
          data: data
        }, window.location.origin);
      };
    })();
  `;
  
  // Inject into page context
  (document.head || document.documentElement).appendChild(script);
  script.remove();
  
  isWebAppReady = true;
  
  // Process any queued messages
  while (messageQueue.length > 0) {
    const message = messageQueue.shift();
    window.postMessage(message, window.location.origin);
  }
}

// Inject the flag when content script loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectExtensionFlag);
} else {
  injectExtensionFlag();
}

// Keep connection alive
chrome.runtime.connect({ name: 'content-script' });