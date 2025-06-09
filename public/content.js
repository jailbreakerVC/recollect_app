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
    console.log('🔌 Content script initializing with context search support...');
    
    this.setupMessageHandlers();
    this.injectExtensionFlag();
    this.connectToBackground();
    
    this.isInitialized = true;
    console.log('✅ Content script initialized successfully');
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
    
    console.log('📨 Content script received message from web page:', event.data);
    
    if (event.data.source === 'bookmark-manager-webapp') {
      // Handle search responses
      if (event.data.action === 'searchResults') {
        console.log('📤 Forwarding search response to background script');
        chrome.runtime.sendMessage({
          action: 'searchResponse',
          data: event.data
        }).catch(() => {
          console.log('Background script not ready for search response');
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
    console.log('📤 Forwarding message to background script:', data.payload);
    
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
      default:
        sendResponse({ success: true });
        return false;
    }
  }

  // Handle forwarding messages to web app
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

  // Handle setting up response listeners
  handleSetupResponseListener(request, sendResponse) {
    console.log('🔗 Setting up response listener for search results');
    
    // Set up a listener for search responses from the web app
    const responseHandler = (event) => {
      if (event.data.source === 'bookmark-manager-webapp' && 
          (event.data.action === 'searchResults' || event.data.requestId)) {
        
        console.log('📨 Received search response from web app:', event.data);
        
        // Forward the response to background script
        chrome.runtime.sendMessage({
          action: 'searchResponse',
          data: event.data
        }).catch(() => {
          // Background script might not be listening
          console.log('Background script not listening for search response');
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
    
    console.log('📤 Notifying web app:', message);
    
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

  // Set up sync completion listener
  setupSyncCompletionListener() {
    const syncCompleteListener = (event) => {
      if (event.data.source === 'bookmark-manager-webapp' && 
          event.data.type === 'syncComplete') {
        console.log('✅ Sync complete notification received');
        
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
    console.log('🚀 Injecting extension availability flag with context search support');
    
    const script = document.createElement('script');
    script.textContent = `
      (function() {
        console.log('📱 Extension availability flag injected with context search');
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
        
        console.log('✅ Extension communication bridge ready with context search support');
      })();
    `;
    
    (document.head || document.documentElement).appendChild(script);
    script.remove();
    
    console.log('✅ Extension flag injected successfully');
  }

  // Connect to background script
  connectToBackground() {
    try {
      this.port = chrome.runtime.connect({ name: 'content-script' });
      this.port.onDisconnect.addListener(() => {
        console.log('🔌 Content script disconnected from background');
        this.port = null;
      });
      console.log('🔌 Connected to background script');
    } catch (error) {
      console.log('⚠️ Could not connect to background script:', error.message);
    }
  }
}

// Initialize content script
new ContentScriptManager();