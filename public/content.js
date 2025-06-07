// Chrome Extension Content Script
// This script runs in the context of the web page and facilitates communication

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

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'notifyWebApp') {
    // Notify the web app of bookmark changes
    window.postMessage({
      source: 'bookmark-manager-extension',
      event: request.event,
      data: request.data
    }, window.location.origin);
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
    })();
  `;
  
  // Inject into page context
  (document.head || document.documentElement).appendChild(script);
  script.remove();
}

// Inject the flag when content script loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectExtensionFlag);
} else {
  injectExtensionFlag();
}