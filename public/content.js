// Chrome Extension Content Script - Robust Message Handling
class ContentScriptManager {
  constructor() {
    this.isInitialized = false;
    this.messageQueue = [];
    this.port = null;
    this.responseListeners = new Map();
    this.contextValid = true;
    this.globalMessageHandler = null;
    
    this.init();
  }

  init() {
    console.log('🔌 Content script initializing...');
    
    this.setupContextValidation();
    this.setupMessageHandlers();
    this.injectExtensionFlag();
    this.connectToBackground();
    
    this.isInitialized = true;
    console.log('✅ Content script initialized successfully');
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

    // Test immediately and then every 10 seconds
    testContext();
    setInterval(testContext, 10000);

    // Listen for extension unload/reload
    if (chrome.runtime && chrome.runtime.onConnect) {
      chrome.runtime.onConnect.addListener(() => {
        this.contextValid = true;
      });
    }
  }

  handleContextInvalidation() {
    console.warn('⚠️ Extension context invalidated');
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

    console.log('📨 Content script received message from web page:', event.data);

    if (event.data.source === 'bookmark-manager-webapp') {
      // Handle search responses - THIS IS THE CRITICAL FIX
      if (event.data.action === 'searchResults') {
        console.log('📤 Forwarding search response to background script');
        this.forwardSearchResponseToBackground(event.data);
      } else if (event.data.requestId && event.data.payload) {
        console.log('📤 Forwarding request to background script');
        this.forwardToBackground(event.data);
      }
    }
  }

  forwardSearchResponseToBackground(data) {
    if (!this.isContextValid()) {
      console.error('❌ Cannot forward search response - extension context invalid');
      return;
    }

    try {
      console.log('📤 Forwarding search response to background:', data);
      
      // Forward the search response directly to background script
      chrome.runtime.sendMessage({
        action: 'searchResponse',
        data: data
      }).then(() => {
        console.log('✅ Search response forwarded successfully');
      }).catch((error) => {
        console.error('❌ Failed to forward search response:', error);
      });
    } catch (error) {
      console.error('❌ Error forwarding search response:', error);
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

    console.log('📤 Forwarding message to background script:', data.payload);

    try {
      chrome.runtime.sendMessage(data.payload, (response) => {
        if (chrome.runtime.lastError) {
          console.error('❌ Background script error:', chrome.runtime.lastError);
          this.sendResponseToWebPage(data.requestId, {
            success: false,
            error: chrome.runtime.lastError.message
          });
        } else {
          console.log('✅ Background script response:', response);
          this.sendResponseToWebPage(data.requestId, response);
        }
      });
    } catch (error) {
      console.error('❌ Error forwarding to background:', error);
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
      console.error('❌ Failed to send response to web page:', error);
    }
  }

  handleExtensionMessage(request, sender, sendResponse) {
    if (!this.isContextValid()) {
      sendResponse({ success: false, error: 'Extension context invalidated' });
      return false;
    }

    console.log('📨 Content script received message from extension:', request);

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
    console.log('📤 Forwarding message to web app:', request.payload);
    
    // Forward the message to the web app
    window.postMessage({
      source: 'bookmark-manager-extension',
      ...request.payload
    }, window.location.origin);
    
    sendResponse({ success: true });
    return false;
  }

  handleSetupResponseListener(request, sendResponse) {
    console.log('🔗 Setting up response listener for search results');
    
    // Set up a listener for search responses from the web app
    const responseHandler = (event) => {
      if (event.data.source === 'bookmark-manager-webapp' && 
          (event.data.action === 'searchResults' || event.data.requestId)) {
        
        console.log('📨 Received search response from web app:', event.data);
        
        // Forward the response to background script
        if (this.isContextValid()) {
          try {
            chrome.runtime.sendMessage({
              action: 'searchResponse',
              data: event.data
            }).catch(() => {
              // Background script might not be listening
              console.log('Background script not listening for search response');
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
    
    console.log('📤 Notifying web app:', message);
    
    // Handle sync completion tracking
    if (request.event === 'syncRequested') {
      this.setupSyncCompletionListener();
    }
    
    window.postMessage(message, window.location.origin);
    sendResponse({ success: true });
    return false;
  }

  handleConnectionTest(request, sendResponse) {
    console.log('🔍 Connection test requested');
    
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
    
    return true; // Keep message channel open
  }

  setupSyncCompletionListener() {
    const syncCompleteListener = (event) => {
      if (event.data.source === 'bookmark-manager-webapp' && 
          event.data.type === 'syncComplete') {
        console.log('✅ Sync complete notification received');
        
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
    // Set the global flag to indicate extension is available
    window.bookmarkExtensionAvailable = true;
    
    // Also dispatch an event to notify the web app
    window.dispatchEvent(new CustomEvent('extensionAvailabilityChanged', {
      detail: { available: true }
    }));
    
    console.log('✅ Extension flag injected and availability event dispatched');
  }

  injectExtensionFlagIntoWebApp() {
    console.log('🚀 Injecting extension availability flag');
    
    const script = document.createElement('script');
    script.textContent = `
      (function() {
        console.log('📱 Extension availability flag injected');
        window.bookmarkExtensionAvailable = true;
        
        // Dispatch ready event
        window.dispatchEvent(new CustomEvent('bookmarkExtensionReady', {
          detail: { 
            timestamp: Date.now(),
            features: ['contextSearch', 'pageAnalysis', 'contextMenu']
          }
        }));
        
        // Dispatch availability change event
        window.dispatchEvent(new CustomEvent('extensionAvailabilityChanged', {
          detail: { available: true }
        }));
        
        // Dispatch the event again after a short delay to catch any race conditions
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('extensionAvailabilityChanged', {
            detail: { available: true }
          }));
        }, 500);
        
        // Set up sync completion bridge
        window.notifyExtensionSyncComplete = function(data) {
          console.log('📤 Notifying extension of sync completion:', data);
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
            console.log('🔍 Received connection test from extension');
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
    
    (document.head || document.documentElement).appendChild(script);
    script.remove();
    
    console.log('✅ Extension flag injected successfully');
  }

  connectToBackground() {
    if (!this.isContextValid()) return;

    try {
      this.port = chrome.runtime.connect({ name: 'content-script' });
      this.port.onDisconnect.addListener(() => {
        console.log('🔌 Content script disconnected from background');
        this.port = null;
        // Check if disconnect was due to context invalidation
        if (!this.isContextValid()) {
          this.handleContextInvalidation();
        }
      });
      console.log('🔌 Connected to background script');
    } catch (error) {
      console.log('⚠️ Could not connect to background script:', error.message);
      this.handleContextInvalidation();
    }
  }
}

// Initialize content script
new ContentScriptManager();