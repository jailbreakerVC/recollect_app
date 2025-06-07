// Chrome Extension Content Script
// This script runs in the context of the web page and facilitates communication

console.log('🔌 Bookmark Manager content script loaded');

let isWebAppReady = false;
let messageQueue = [];

// Listen for messages from the web page
window.addEventListener('message', (event) => {
  // Only accept messages from the same origin
  if (event.origin !== window.location.origin) return;
  
  console.log('📨 Content script received message from web page:', event.data);
  
  if (event.data.source === 'bookmark-manager-webapp') {
    // Forward the message to the background script
    console.log('📤 Forwarding message to background script:', event.data.payload);
    
    chrome.runtime.sendMessage(event.data.payload, (response) => {
      if (chrome.runtime.lastError) {
        console.error('❌ Background script error:', chrome.runtime.lastError);
        // Send error response back to web page
        window.postMessage({
          source: 'bookmark-manager-extension',
          requestId: event.data.requestId,
          response: {
            success: false,
            error: chrome.runtime.lastError.message
          }
        }, window.location.origin);
      } else {
        console.log('✅ Background script response:', response);
        // Send response back to web page
        window.postMessage({
          source: 'bookmark-manager-extension',
          requestId: event.data.requestId,
          response
        }, window.location.origin);
      }
    });
  }
});

// Listen for messages from background script and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('📨 Content script received message from extension:', request);
  
  if (request.action === 'notifyWebApp') {
    // Notify the web app of bookmark changes or sync requests
    const message = {
      source: 'bookmark-manager-extension',
      event: request.event,
      data: request.data
    };
    
    console.log('📤 Notifying web app:', message);
    
    // If it's a sync request, also notify popup when sync completes
    if (request.event === 'syncRequested') {
      // Listen for sync completion from web app
      const syncCompleteListener = (event) => {
        if (event.data.source === 'bookmark-manager-webapp' && 
            event.data.type === 'syncComplete') {
          console.log('✅ Sync complete notification received');
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
  
  // Handle connection test from popup
  if (request.action === 'testConnection') {
    console.log('🔍 Connection test requested from popup');
    
    // Test if web app can receive messages
    const testMessage = {
      source: 'bookmark-manager-extension',
      event: 'connectionTest',
      data: { timestamp: Date.now() }
    };
    
    // Send test message to web app
    window.postMessage(testMessage, window.location.origin);
    
    // Wait for response from web app
    let responseReceived = false;
    const responseListener = (event) => {
      if (event.data.source === 'bookmark-manager-webapp' && 
          event.data.type === 'connectionTestResponse') {
        responseReceived = true;
        window.removeEventListener('message', responseListener);
        console.log('✅ Web app responded to connection test');
        sendResponse({ success: true, responsive: true });
      }
    };
    
    window.addEventListener('message', responseListener);
    
    // Timeout after 2 seconds
    setTimeout(() => {
      if (!responseReceived) {
        window.removeEventListener('message', responseListener);
        console.log('⚠️ Web app did not respond to connection test');
        sendResponse({ success: true, responsive: false });
      }
    }, 2000);
    
    return true; // Keep message channel open for async response
  }
  
  // Handle other messages synchronously
  sendResponse({ success: true });
});

// Create a function to inject extension availability flag
function injectExtensionFlag() {
  console.log('🚀 Injecting extension availability flag');
  
  // Create a custom event to signal extension is ready
  const script = document.createElement('script');
  script.textContent = `
    (function() {
      console.log('📱 Extension availability flag injected');
      window.bookmarkExtensionAvailable = true;
      
      // Dispatch ready event
      window.dispatchEvent(new CustomEvent('bookmarkExtensionReady', {
        detail: { timestamp: Date.now() }
      }));
      
      // Set up communication bridge for sync completion
      window.notifyExtensionSyncComplete = function(data) {
        console.log('📤 Notifying extension of sync completion:', data);
        window.postMessage({
          source: 'bookmark-manager-webapp',
          type: 'syncComplete',
          data: data
        }, window.location.origin);
      };
      
      // Set up connection test response handler
      window.addEventListener('message', function(event) {
        if (event.data.source === 'bookmark-manager-extension' && 
            event.data.event === 'connectionTest') {
          console.log('🔍 Received connection test from extension');
          // Respond to connection test
          window.postMessage({
            source: 'bookmark-manager-webapp',
            type: 'connectionTestResponse',
            data: { timestamp: Date.now(), responsive: true }
          }, window.location.origin);
        }
      });
      
      console.log('✅ Extension communication bridge ready');
    })();
  `;
  
  // Inject into page context
  (document.head || document.documentElement).appendChild(script);
  script.remove();
  
  isWebAppReady = true;
  console.log('✅ Extension flag injected successfully');
  
  // Process any queued messages
  while (messageQueue.length > 0) {
    const message = messageQueue.shift();
    window.postMessage(message, window.location.origin);
  }
}

// Inject the flag as early as possible
if (document.readyState === 'loading') {
  // Document is still loading, wait for DOM
  document.addEventListener('DOMContentLoaded', injectExtensionFlag);
} else {
  // Document already loaded, inject immediately
  injectExtensionFlag();
}

// Also inject on document start for faster detection
if (document.documentElement) {
  injectExtensionFlag();
}

// Keep connection alive with background script
const port = chrome.runtime.connect({ name: 'content-script' });
port.onDisconnect.addListener(() => {
  console.log('🔌 Content script disconnected from background');
});

console.log('✅ Bookmark Manager content script initialized');