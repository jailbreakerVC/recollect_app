// Chrome Extension Content Script - Enhanced for Context Search
class ContentScriptManager {
  constructor() {
    this.isInitialized = false;
    this.messageQueue = [];
    this.port = null;
    this.responseListeners = new Map();
    
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
    
    // Filter out non-bookmark manager messages
    if (!this.isBookmarkManagerMessage(event.data)) return;
    
    if (event.data.source === 'bookmark-manager-webapp') {
      // Handle search responses
      if (event.data.action === 'searchResults') {
        chrome.runtime.sendMessage({
          action: 'searchResponse',
          data: event.data
        }).catch(() => {
          // Background script not ready for search response
        });
      } else {
        this.forwardToBackground(event.data);
      }
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
      case 'forwardToWebApp':
        return this.handleForwardToWebApp(request, sendResponse);
      case 'setupResponseListener':
        return this.handleSetupResponseListener(request, sendResponse);
      case 'testConnection':
        return this.handleConnectionTest(request, sendResponse);
      case 'ping':
        sendResponse({ success: true, message: 'pong' });
        return false;
      default:
        sendResponse({ success: true });
        return false;
    }
  }

  // Handle forwarding messages to web app
  handleForwardToWebApp(request, sendResponse) {
    // Forward the message to the web app
    window.postMessage({
      source: 'bookmark-manager-extension',
      ...request.payload
    }, window.location.origin);
    
    sendResponse({ success: true });
    return false;
  }

  // Handle setting up response listeners
  handleSetupResponseListener(request, sendResponse) {
    // Set up a listener for search responses from the web app
    const responseHandler = (event) => {
      if (event.data.source === 'bookmark-manager-webapp' && 
          (event.data.action === 'searchResults' || event.data.requestId)) {
        
        // Forward the response to background script
        chrome.runtime.sendMessage({
          action: 'searchResponse',
          data: event.data
        }).catch(() => {
          // Background script might not be listening
        });
      }
    };
    
    window.addEventListener('message', responseHandler);
    
    // Store the handler for cleanup
    const listenerId = `listener_${Date.now()}`;
    this.responseListeners.set(listenerId, responseHandler);
    
    // Clean up after 30 seconds
    setTimeout(() => {
      window.removeEventListener('message', responseHandler);
      this.responseListeners.delete(listenerId);
    }, 30000);
    
    sendResponse({ success: true, listenerId });
    return false;
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
          detail: { 
            timestamp: Date.now(),
            features: ['contextSearch', 'pageAnalysis', 'contextMenu']
          }
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
      // Could not connect to background script
    }
  }
}

// Initialize content script
new ContentScriptManager();