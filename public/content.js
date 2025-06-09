// Chrome Extension Content Script - Clean and Optimized
class ContentScriptManager {
  constructor() {
    this.isInitialized = false;
    this.messageQueue = [];
    this.port = null;
    this.responseListeners = new Map();
    this.contextValid = true;
    
    this.init();
  }

  init() {
    this.setupMessageHandlers();
    this.injectExtensionFlag();
    this.connectToBackground();
    this.setupContextValidation();
    
    this.isInitialized = true;
  }

  setupContextValidation() {
    // Test context validity periodically
    const testContext = () => {
      try {
        if (chrome.runtime && chrome.runtime.id) {
          this.contextValid = true;
        } else {
          this.contextValid = false;
        }
      } catch (error) {
        this.contextValid = false;
        this.handleContextInvalidation();
      }
    };

    // Test immediately and then every 5 seconds
    testContext();
    setInterval(testContext, 5000);

    // Listen for extension unload/reload
    if (chrome.runtime && chrome.runtime.onConnect) {
      chrome.runtime.onConnect.addListener(() => {
        this.contextValid = true;
      });
    }
  }

  handleContextInvalidation() {
    this.contextValid = false;
    this.messageQueue = [];
    this.responseListeners.clear();
    
    if (this.port) {
      try {
        this.port.disconnect();
      } catch (e) {
        // Port already disconnected
      }
      this.port = null;
    }

    // Remove all event listeners to prevent further errors
    if (this.globalMessageHandler) {
      window.removeEventListener('message', this.globalMessageHandler);
    }
  }

  isContextValid() {
    try {
      return this.contextValid && chrome.runtime && chrome.runtime.id;
    } catch (error) {
      this.contextValid = false;
      return false;
    }
  }

  setupMessageHandlers() {
    // Listen for messages from web page
    this.globalMessageHandler = this.handleWebPageMessage.bind(this);
    window.addEventListener('message', this.globalMessageHandler);
    
    // Listen for messages from extension (with context validation)
    if (this.isContextValid()) {
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        return this.handleExtensionMessage(request, sender, sendResponse);
      });
    }
  }

  handleWebPageMessage(event) {
    // Only accept messages from same origin
    if (event.origin !== window.location.origin) return;
    
    // Filter out non-bookmark manager messages
    if (!this.isBookmarkManagerMessage(event.data)) return;

    if (event.data.source === 'bookmark-manager-webapp') {
      // Handle search responses - THIS IS THE KEY FIX
      if (event.data.action === 'searchResults') {
        this.forwardSearchResponseToBackground(event.data);
      } else if (event.data.requestId && event.data.payload) {
        this.forwardToBackground(event.data);
      }
    }
  }

  forwardSearchResponseToBackground(data) {
    if (!this.isContextValid()) {
      return;
    }

    try {
      // Forward the search response directly to background script
      chrome.runtime.sendMessage({
        action: 'searchResponse',
        data: data
      }).catch(() => {
        // Background script not ready for search response
      });
    } catch (error) {
      this.handleContextInvalidation();
    }
  }

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

  forwardToBackground(data) {
    if (!this.isContextValid()) {
      // Context is invalid, send error response to web page
      this.sendResponseToWebPage(data.requestId, {
        success: false,
        error: 'Extension context invalidated - please reload the page'
      });
      return;
    }

    try {
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
    } catch (error) {
      this.handleContextInvalidation();
      this.sendResponseToWebPage(data.requestId, {
        success: false,
        error: 'Extension context invalidated - please reload the page'
      });
    }
  }

  sendResponseToWebPage(requestId, response) {
    try {
      window.postMessage({
        source: 'bookmark-manager-extension',
        requestId: requestId,
        response: response
      }, window.location.origin);
    } catch (error) {
      // Failed to send response to web page
    }
  }

  handleExtensionMessage(request, sender, sendResponse) {
    if (!this.isContextValid()) {
      sendResponse({ success: false, error: 'Extension context invalidated' });
      return false;
    }

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

  handleForwardToWebApp(request, sendResponse) {
    // Forward the message to the web app
    window.postMessage({
      source: 'bookmark-manager-extension',
      ...request.payload
    }, window.location.origin);
    
    sendResponse({ success: true });
    return false;
  }

  handleSetupResponseListener(request, sendResponse) {
    // Set up a listener for search responses from the web app
    const responseHandler = (event) => {
      if (event.data.source === 'bookmark-manager-webapp' && 
          (event.data.action === 'searchResults' || event.data.requestId)) {
        
        // Forward the response to background script
        if (this.isContextValid()) {
          try {
            chrome.runtime.sendMessage({
              action: 'searchResponse',
              data: event.data
            }).catch(() => {
              // Background script might not be listening
            });
          } catch (error) {
            this.handleContextInvalidation();
          }
        }
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

  setupSyncCompletionListener() {
    const syncCompleteListener = (event) => {
      if (event.data.source === 'bookmark-manager-webapp' && 
          event.data.type === 'syncComplete') {
        
        // Notify background script if context is valid
        if (this.isContextValid()) {
          try {
            chrome.runtime.sendMessage({
              action: 'syncComplete',
              data: event.data.data
            });
          } catch (error) {
            this.handleContextInvalidation();
          }
        }
        
        window.removeEventListener('message', syncCompleteListener);
      }
    };
    
    window.addEventListener('message', syncCompleteListener);
    
    // Clean up after 30 seconds
    setTimeout(() => {
      window.removeEventListener('message', syncCompleteListener);
    }, 30000);
  }

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

  connectToBackground() {
    if (!this.isContextValid()) return;

    try {
      this.port = chrome.runtime.connect({ name: 'content-script' });
      this.port.onDisconnect.addListener(() => {
        this.port = null;
        // Check if disconnect was due to context invalidation
        if (!this.isContextValid()) {
          this.handleContextInvalidation();
        }
      });
    } catch (error) {
      this.handleContextInvalidation();
    }
  }
}

// Initialize content script
new ContentScriptManager();