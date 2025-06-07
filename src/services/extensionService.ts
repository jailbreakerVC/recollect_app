import { DatabaseBookmark } from '../lib/supabase';

export interface ExtensionBookmark {
  id: string;
  title: string;
  url: string;
  dateAdded: string;
  folder?: string;
  parentId?: string;
}

export interface ExtensionMessage {
  source: string;
  type: string;
  requestId?: string;
  payload?: any;
  data?: any;
  event?: string;
}

export class ExtensionService {
  private static requestId = 0;
  private static messageHandlers = new Map<string, (event: MessageEvent) => void>();
  private static isInitialized = false;
  private static globalMessageHandler: ((event: MessageEvent) => void) | null = null;
  private static availabilityCheckInterval: NodeJS.Timeout | null = null;

  /**
   * Initialize the extension service
   */
  static initialize(): void {
    if (this.isInitialized) return;
    
    console.log('🚀 Initializing ExtensionService');
    
    // Set up global message listener
    this.globalMessageHandler = this.handleGlobalMessage.bind(this);
    window.addEventListener('message', this.globalMessageHandler);
    
    // Set up extension availability flag
    this.setupExtensionFlag();
    
    // Start availability monitoring
    this.startAvailabilityMonitoring();
    
    this.isInitialized = true;
    console.log('✅ ExtensionService initialized');
  }

  /**
   * Clean up the extension service
   */
  static cleanup(): void {
    if (!this.isInitialized) return;
    
    console.log('🧹 Cleaning up ExtensionService');
    
    if (this.globalMessageHandler) {
      window.removeEventListener('message', this.globalMessageHandler);
      this.globalMessageHandler = null;
    }
    
    if (this.availabilityCheckInterval) {
      clearInterval(this.availabilityCheckInterval);
      this.availabilityCheckInterval = null;
    }
    
    this.messageHandlers.clear();
    
    // Clean up global functions
    delete (window as any).notifyExtensionSyncComplete;
    
    this.isInitialized = false;
    console.log('✅ ExtensionService cleaned up');
  }

  /**
   * Start monitoring extension availability
   */
  private static startAvailabilityMonitoring(): void {
    // Check immediately
    this.checkExtensionAvailability();
    
    // Check every 2 seconds
    this.availabilityCheckInterval = setInterval(() => {
      this.checkExtensionAvailability();
    }, 2000);
  }

  /**
   * Check if extension is available and update flag
   */
  private static checkExtensionAvailability(): void {
    const wasAvailable = (window as any).bookmarkExtensionAvailable;
    
    // Check multiple indicators
    const hasExtensionFlag = !!(window as any).bookmarkExtensionAvailable;
    const hasContentScript = this.testContentScriptPresence();
    
    const isAvailable = hasExtensionFlag || hasContentScript;
    
    if (isAvailable !== wasAvailable) {
      console.log('📱 Extension availability changed:', isAvailable);
      (window as any).bookmarkExtensionAvailable = isAvailable;
      
      // Dispatch availability change event
      window.dispatchEvent(new CustomEvent('extensionAvailabilityChanged', {
        detail: { available: isAvailable }
      }));
    }
  }

  /**
   * Test if content script is present by trying to communicate
   */
  private static testContentScriptPresence(): boolean {
    try {
      // Try to send a test message and see if we get a response quickly
      let responseReceived = false;
      
      const testHandler = (event: MessageEvent) => {
        if (event.data.source === 'bookmark-manager-extension' && 
            event.data.event === 'connectionTest') {
          responseReceived = true;
          window.removeEventListener('message', testHandler);
        }
      };
      
      window.addEventListener('message', testHandler);
      
      // Send test message
      window.postMessage({
        source: 'bookmark-manager-webapp',
        type: 'extensionTest',
        timestamp: Date.now()
      }, window.location.origin);
      
      // Clean up after a short time
      setTimeout(() => {
        window.removeEventListener('message', testHandler);
      }, 500);
      
      return responseReceived;
    } catch (error) {
      return false;
    }
  }

  /**
   * Global message handler that routes messages to appropriate handlers
   */
  private static handleGlobalMessage(event: MessageEvent): void {
    // Filter out non-bookmark manager messages
    if (!this.isBookmarkManagerMessage(event.data)) {
      return;
    }

    console.log('📨 ExtensionService received message:', event.data);

    // Route to specific handlers
    this.messageHandlers.forEach(handler => {
      try {
        handler(event);
      } catch (error) {
        console.error('❌ Message handler error:', error);
      }
    });
  }

  /**
   * Check if a message is from the bookmark manager system
   */
  private static isBookmarkManagerMessage(data: any): boolean {
    if (!data || !data.source) return false;
    
    // Filter out React DevTools and other non-bookmark messages
    const ignoredSources = [
      'react-devtools',
      'devtools',
      'react-devtools-content-script',
      'react-devtools-bridge'
    ];
    
    return !ignoredSources.some(ignored => data.source.includes(ignored)) &&
           (data.source === 'bookmark-manager-extension' || 
            data.source === 'bookmark-manager-webapp');
  }

  /**
   * Set up extension availability flag and global functions
   */
  private static setupExtensionFlag(): void {
    console.log('🔧 Setting up extension communication bridge...');
    
    // Set up sync completion notification function
    (window as any).notifyExtensionSyncComplete = function(data: any) {
      console.log('📤 Notifying extension of sync completion:', data);
      window.postMessage({
        source: 'bookmark-manager-webapp',
        type: 'syncComplete',
        data: data
      }, window.location.origin);
    };

    // Set up connection test response
    this.addMessageHandler('connectionTest', (event) => {
      if (event.data.source === 'bookmark-manager-extension' && 
          event.data.event === 'connectionTest') {
        console.log('🔍 Responding to connection test from extension');
        window.postMessage({
          source: 'bookmark-manager-webapp',
          type: 'connectionTestResponse',
          data: { timestamp: Date.now(), responsive: true }
        }, window.location.origin);
      }
    });

    // Listen for extension ready events
    window.addEventListener('bookmarkExtensionReady', (event: any) => {
      console.log('✅ Extension ready event received:', event.detail);
      (window as any).bookmarkExtensionAvailable = true;
    });

    console.log('✅ Extension communication bridge ready');
  }

  /**
   * Add a message handler
   */
  static addMessageHandler(id: string, handler: (event: MessageEvent) => void): void {
    this.messageHandlers.set(id, handler);
  }

  /**
   * Remove a message handler
   */
  static removeMessageHandler(id: string): void {
    this.messageHandlers.delete(id);
  }

  /**
   * Check if Chrome extension is available with enhanced detection
   */
  static isExtensionAvailable(): boolean {
    const hasFlag = !!(window as any).bookmarkExtensionAvailable;
    
    console.log('🔍 Extension availability check:', {
      hasFlag,
      windowObject: typeof window !== 'undefined',
      extensionFlag: (window as any).bookmarkExtensionAvailable
    });
    
    return hasFlag;
  }

  /**
   * Force check extension availability
   */
  static async forceCheckAvailability(): Promise<boolean> {
    console.log('🔍 Force checking extension availability...');
    
    return new Promise((resolve) => {
      let responseReceived = false;
      
      const testHandler = (event: MessageEvent) => {
        if (event.data.source === 'bookmark-manager-extension') {
          responseReceived = true;
          (window as any).bookmarkExtensionAvailable = true;
          window.removeEventListener('message', testHandler);
          console.log('✅ Extension responded to availability check');
          resolve(true);
        }
      };
      
      window.addEventListener('message', testHandler);
      
      // Send test message
      window.postMessage({
        source: 'bookmark-manager-webapp',
        type: 'availabilityCheck',
        timestamp: Date.now()
      }, window.location.origin);
      
      // Timeout after 2 seconds
      setTimeout(() => {
        window.removeEventListener('message', testHandler);
        if (!responseReceived) {
          console.log('⚠️ Extension did not respond to availability check');
          (window as any).bookmarkExtensionAvailable = false;
          resolve(false);
        }
      }, 2000);
    });
  }

  /**
   * Send message to Chrome extension with improved timeout and retry logic
   */
  private static sendMessage(payload: any, timeout = 10000): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.isExtensionAvailable()) {
        reject(new Error('Chrome extension not available'));
        return;
      }

      const requestId = `req_${++this.requestId}_${Date.now()}`;
      
      console.log('📤 Sending message to extension:', { requestId, payload });
      
      let responseReceived = false;
      let timeoutId: NodeJS.Timeout;
      
      const handleResponse = (event: MessageEvent) => {
        if (event.data.source === 'bookmark-manager-extension' &&
            event.data.requestId === requestId) {
          
          responseReceived = true;
          clearTimeout(timeoutId);
          this.removeMessageHandler(`response_${requestId}`);
          
          console.log('📨 Extension response received:', event.data);
          
          if (event.data.response?.success) {
            resolve(event.data.response);
          } else {
            reject(new Error(event.data.response?.error || 'Extension request failed'));
          }
        }
      };

      // Add response handler
      this.addMessageHandler(`response_${requestId}`, handleResponse);

      // Send message
      try {
        window.postMessage({
          source: 'bookmark-manager-webapp',
          requestId,
          payload
        }, window.location.origin);
        
        console.log('📤 Message posted to window');
      } catch (error) {
        this.removeMessageHandler(`response_${requestId}`);
        reject(new Error(`Failed to send message: ${error}`));
        return;
      }

      // Timeout handling with longer timeout for bookmark operations
      timeoutId = setTimeout(() => {
        if (!responseReceived) {
          this.removeMessageHandler(`response_${requestId}`);
          console.error('⏰ Extension request timeout for:', payload.action);
          reject(new Error(`Extension request timeout (${timeout}ms) for action: ${payload.action}`));
        }
      }, timeout);
    });
  }

  /**
   * Get all bookmarks from Chrome extension with retry logic
   */
  static async getBookmarks(): Promise<ExtensionBookmark[]> {
    console.log('📚 Requesting bookmarks from Chrome extension...');
    
    try {
      const response = await this.sendMessage({ action: 'getBookmarks' }, 15000); // 15 second timeout
      const bookmarks = response.bookmarks || [];
      
      console.log(`✅ Received ${bookmarks.length} bookmarks from extension`);
      
      // Validate bookmark structure
      const validBookmarks = bookmarks.filter((bookmark: any) => {
        const isValid = bookmark && 
                       typeof bookmark.id === 'string' && 
                       typeof bookmark.title === 'string' && 
                       typeof bookmark.url === 'string';
        
        if (!isValid) {
          console.warn('⚠️ Invalid bookmark structure:', bookmark);
        }
        
        return isValid;
      });
      
      if (validBookmarks.length !== bookmarks.length) {
        console.warn(`⚠️ Filtered out ${bookmarks.length - validBookmarks.length} invalid bookmarks`);
      }
      
      return validBookmarks;
    } catch (error) {
      console.error('❌ Failed to get bookmarks from extension:', error);
      throw new Error(`Failed to get Chrome bookmarks: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Add bookmark to Chrome
   */
  static async addBookmark(title: string, url: string, parentId?: string): Promise<void> {
    console.log('➕ Adding bookmark to Chrome:', { title, url, parentId });
    
    try {
      await this.sendMessage({
        action: 'addBookmark',
        title,
        url,
        parentId
      }, 10000);
      
      console.log('✅ Bookmark added to Chrome successfully');
    } catch (error) {
      console.error('❌ Failed to add bookmark to Chrome:', error);
      throw error;
    }
  }

  /**
   * Remove bookmark from Chrome
   */
  static async removeBookmark(chromeBookmarkId: string): Promise<void> {
    console.log('🗑️ Removing bookmark from Chrome:', chromeBookmarkId);
    
    try {
      await this.sendMessage({
        action: 'removeBookmark',
        id: chromeBookmarkId
      }, 10000);
      
      console.log('✅ Bookmark removed from Chrome successfully');
    } catch (error) {
      console.error('❌ Failed to remove bookmark from Chrome:', error);
      throw error;
    }
  }

  /**
   * Set up extension event listeners for bookmark changes
   */
  static setupEventListeners(onBookmarkChange: (event?: string) => void): () => void {
    console.log('👂 Setting up extension event listeners');
    
    const handlerId = `bookmarkEvents_${Date.now()}`;
    
    const handleBookmarkEvent = (event: MessageEvent) => {
      if (event.data.source === 'bookmark-manager-extension') {
        const { event: eventType } = event.data;
        
        if (['bookmarkCreated', 'bookmarkRemoved', 'bookmarkChanged', 'syncRequested'].includes(eventType)) {
          console.log('🔄 Triggering bookmark change handler for:', eventType);
          onBookmarkChange(eventType);
        }
      }
    };

    this.addMessageHandler(handlerId, handleBookmarkEvent);
    
    // Return cleanup function
    return () => {
      console.log('🧹 Cleaning up extension event listeners');
      this.removeMessageHandler(handlerId);
    };
  }

  /**
   * Set up extension availability detection with improved reliability
   */
  static setupAvailabilityDetection(onAvailabilityChange: (available: boolean) => void): () => void {
    console.log('🔍 Setting up extension availability detection');
    
    let lastAvailability = false;
    let intervalId: NodeJS.Timeout;
    
    const checkAvailability = async () => {
      // Force check availability
      const available = await this.forceCheckAvailability();
      
      if (available !== lastAvailability) {
        console.log('📱 Extension availability changed:', available);
        lastAvailability = available;
        onAvailabilityChange(available);
      }
    };

    const handleExtensionReady = (event: CustomEvent) => {
      console.log('✅ Extension ready event received:', event.detail);
      (window as any).bookmarkExtensionAvailable = true;
      onAvailabilityChange(true);
    };

    const handleAvailabilityChange = (event: CustomEvent) => {
      console.log('📱 Extension availability change event:', event.detail);
      onAvailabilityChange(event.detail.available);
    };

    // Initialize the service if not already done
    if (!this.isInitialized) {
      this.initialize();
    }

    // Check immediately
    checkAvailability();

    // Listen for extension ready event
    window.addEventListener('bookmarkExtensionReady', handleExtensionReady as EventListener);
    window.addEventListener('extensionAvailabilityChanged', handleAvailabilityChange as EventListener);

    // Check periodically with force check
    intervalId = setInterval(checkAvailability, 5000);

    // Return cleanup function
    return () => {
      console.log('🧹 Cleaning up extension availability detection');
      window.removeEventListener('bookmarkExtensionReady', handleExtensionReady as EventListener);
      window.removeEventListener('extensionAvailabilityChanged', handleAvailabilityChange as EventListener);
      clearInterval(intervalId);
    };
  }

  /**
   * Test extension connection
   */
  static async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      console.log('🧪 Testing extension connection...');
      
      // First check if extension flag is set
      if (!(window as any).bookmarkExtensionAvailable) {
        console.log('🔍 Extension flag not set, trying force check...');
        const available = await this.forceCheckAvailability();
        
        if (!available) {
          return {
            success: false,
            message: 'Extension not available - no response to availability check'
          };
        }
      }
      
      // Try to get a small number of bookmarks as a connection test
      const bookmarks = await this.getBookmarks();
      
      return {
        success: true,
        message: `Extension connected successfully. Found ${bookmarks.length} bookmarks.`
      };
      
    } catch (error) {
      return {
        success: false,
        message: `Extension connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}

// Auto-initialize when module loads
if (typeof window !== 'undefined') {
  ExtensionService.initialize();
}