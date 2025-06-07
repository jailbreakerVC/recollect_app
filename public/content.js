// Chrome Extension Content Script - Clean version without excessive logging
class ContentScriptManager {
  constructor() {
    this.isInitialized = false;
    this.messageQueue = [];
    this.port = null;
    
    this.init();
  }

  // Initialize content script
  init() {
    this.setupMessageHandlers();
    this.injectExtensionFlag();
    this.connectToBackground();
    
    this.isInitialized = true;
  }

  // Set up message handlers
  setupMessageHandlers() {
    // Listen for messages from web page
    window.addEventListener('message', (event) => this.handleWebPageMessage(event));
    
    // Listen for messages from extension
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      return this.handleExtensionMessage(request, sender, sendResponse);
    });
  }

  // Handle messages from web page
  handleWebPageMessage(event) {
    // Only accept messages from same origin
    if (event.origin !== window.location.origin) return;
    
    // Filter out non-bookmark manager messages and test messages
    if (!this.isBookmarkManagerMessage(event.data)) return;
    
    // Ignore test messages to reduce noise
    if (event.data.type === 'extensionTest' || event.data.type === 'availabilityCheck') {
      // Respond to availability checks silently
      if (event.data.type === 'availabilityCheck') {
        window.postMessage({
          source: 'bookmark-manager-extension',
          type: 'availabilityResponse',
          available: true,
          timestamp: Date.now()
        }, window.location.origin);
      }
      return;
    }
    
    if (event.data.source === 'bookmark-manager-webapp') {
      this.forwardToBackground(event.data);
    }
  }

  // Check if message is from bookmark manager
  isBookmarkManagerMessage(data) {
    if (!data || !data.source) return false;
    
    // Filter out React DevTools and other messages
    const ignoredSources = [
      'react-devtools',
      'devtools',
      'react-devtools-content-script',
      'react-devtools-bridge'
    ];
    
    return !ignoredSources.some(ignored => data.source.includes(ignored));
  }

  // Forward message to background script
  forwardToBackground(data) {
    chrome.runtime.sendMessage(data.payload, (response) => {
      if (chrome.runtime.lastError) {
        console.error('❌ Background script error:', chrome.runtime.lastError);
        this.sendResponseToWebPage(data.requestId, {
          success: false,
          error: chrome.runtime.lastError.message
        });
      } else {
        this.sendResponseToWebPage(data.requestId, response);
      }
    });
  }

  // Send response back to web page
  sendResponseToWebPage(requestId, response) {
    window.postMessage({
      source: 'bookmark-manager-extension',
      requestId: requestId,
      response: response
    }, window.location.origin);
  }

  // Handle messages from extension
  handleExtensionMessage(request, sender, sendResponse) {
    switch (request.action) {
      case 'notifyWebApp':
        return this.handleNotifyWebApp(request, sendResponse);
      case 'testConnection':
        return this.handleConnectionTest(request, sendResponse);
      default:
        sendResponse({ success: true });
        return false;
    }
  }

  // Handle web app notification
  handleNotifyWebApp(request, sendResponse) {
    const message = {
      source: 'bookmark-manager-extension',
      event: request.event,
      data: request.data
    };
    
    // Handle sync completion tracking
    if (request.event === 'syncRequested') {
      this.setupSyncCompletionListener();
    }
    
    window.postMessage(message, window.location.origin);
    sendResponse({ success: true });
    return false;
  }

  // Handle connection test
  handleConnectionTest(request, sendResponse) {
    // Test if web app can receive messages
    const testMessage = {
      source: 'bookmark-manager-extension',
      event: 'connectionTest',
      data: { timestamp: Date.now() }
    };
    
    // Send test message
    window.postMessage(testMessage, window.location.origin);
    
    // Wait for response
    let responseReceived = false;
    const responseListener = (event) => {
      if (event.data.source === 'bookmark-manager-webapp' && 
          event.data.type === 'connectionTestResponse') {
        responseReceived = true;
        window.removeEventListener('message', responseListener);
        sendResponse({ success: true, responsive: true });
      }
    };
    
    window.addEventListener('message', responseListener);
    
    // Timeout after 2 seconds
    setTimeout(() => {
      if (!responseReceived) {
        window.removeEventListener('message', responseListener);
        sendResponse({ success: true, responsive: false });
      }
    }, 2000);
    
    return true; // Keep message channel open
  }

  // Set up sync completion listener
  setupSyncCompletionListener() {
    const syncCompleteListener = (event) => {
      if (event.data.source === 'bookmark-manager-webapp' && 
          event.data.type === 'syncComplete') {
        
        // Notify background script
        chrome.runtime.sendMessage({
          action: 'syncComplete',
          data: event.data.data
        });
        
        window.removeEventListener('message', syncCompleteListener);
      }
    };
    
    window.addEventListener('message', syncCompleteListener);
    
    // Clean up after 30 seconds
    setTimeout(() => {
      window.removeEventListener('message', syncCompleteListener);
    }, 30000);
  }

  // Inject extension availability flag
  injectExtensionFlag() {
    const script = document.createElement('script');
    script.textContent = `
      (function() {
        window.bookmarkExtensionAvailable = true;
        
        // Dispatch ready event
        window.dispatchEvent(new CustomEvent('bookmarkExtensionReady', {
          detail: { timestamp: Date.now() }
        }));
        
        // Set up sync completion bridge
        window.notifyExtensionSyncComplete = function(data) {
          window.postMessage({
            source: 'bookmark-manager-webapp',
            type: 'syncComplete',
            data: data
          }, window.location.origin);
        };
        
        // Set up connection test response
        window.addEventListener('message', function(event) {
          if (event.data.source === 'bookmark-manager-extension' && 
              event.data.event === 'connectionTest') {
            window.postMessage({
              source: 'bookmark-manager-webapp',
              type: 'connectionTestResponse',
              data: { timestamp: Date.now(), responsive: true }
            }, window.location.origin);
          }
        });
        
        // Handle availability checks silently
        window.addEventListener('message', function(event) {
          if (event.data.source === 'bookmark-manager-webapp' && 
              event.data.type === 'availabilityCheck') {
            window.postMessage({
              source: 'bookmark-manager-extension',
              type: 'availabilityResponse',
              available: true,
              timestamp: Date.now()
            }, window.location.origin);
          }
        });
      })();
    `;
    
    (document.head || document.documentElement).appendChild(script);
    script.remove();
  }

  // Connect to background script
  connectToBackground() {
    try {
      this.port = chrome.runtime.connect({ name: 'content-script' });
      this.port.onDisconnect.addListener(() => {
        this.port = null;
      });
    } catch (error) {
      // Silent fail
    }
  }
}

// Initialize content script
new ContentScriptManager();