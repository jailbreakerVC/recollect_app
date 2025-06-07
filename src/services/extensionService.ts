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
  private static lastAvailabilityCheck = 0;

  /**
   * Initialize the extension service
   */
  static initialize(): void {
    if (this.isInitialized) return;
    
    // Set up global message listener
    this.globalMessageHandler = this.handleGlobalMessage.bind(this);
    window.addEventListener('message', this.globalMessageHandler);
    
    // Set up extension availability flag
    this.setupExtensionFlag();
    
    // Start availability monitoring (less frequent)
    this.startAvailabilityMonitoring();
    
    this.isInitialized = true;
  }

  /**
   * Clean up the extension service
   */
  static cleanup(): void {
    if (!this.isInitialized) return;
    
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
  }

  /**
   * Start monitoring extension availability (less frequent)
   */
  private static startAvailabilityMonitoring(): void {
    // Check immediately
    this.checkExtensionAvailability();
    
    // Check every 10 seconds instead of 2 seconds
    this.availabilityCheckInterval = setInterval(() => {
      this.checkExtensionAvailability();
    }, 10000);
  }

  /**
   * Check if extension is available (cached for 5 seconds)
   */
  private static checkExtensionAvailability(): void {
    const now = Date.now();
    
    // Only check every 5 seconds to reduce noise
    if (now - this.lastAvailabilityCheck < 5000) {
      return;
    }
    
    this.lastAvailabilityCheck = now;
    
    const wasAvailable = (window as any).bookmarkExtensionAvailable;
    
    // Check if extension flag is set
    const isAvailable = !!(window as any).bookmarkExtensionAvailable;
    
    if (isAvailable !== wasAvailable) {
      (window as any).bookmarkExtensionAvailable = isAvailable;
      
      // Dispatch availability change event
      window.dispatchEvent(new CustomEvent('extensionAvailabilityChanged', {
        detail: { available: isAvailable }
      }));
    }
  }

  /**
   * Global message handler that routes messages to appropriate handlers
   */
  private static handleGlobalMessage(event: MessageEvent): void {
    // Filter out non-bookmark manager messages and test messages
    if (!this.isBookmarkManagerMessage(event.data)) {
      return;
    }

    // Handle availability responses silently
    if (event.data.type === 'availabilityResponse') {
      (window as any).bookmarkExtensionAvailable = event.data.available;
      return;
    }

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
    // Set up sync completion notification function
    (window as any).notifyExtensionSyncComplete = function(data: any) {
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
        window.postMessage({
          source: 'bookmark-manager-webapp',
          type: 'connectionTestResponse',
          data: { timestamp: Date.now(), responsive: true }
        }, window.location.origin);
      }
    });

    // Listen for extension ready events
    window.addEventListener('bookmarkExtensionReady', (event: any) => {
      (window as any).bookmarkExtensionAvailable = true;
    });
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
   * Check if Chrome extension is available
   */
  static isExtensionAvailable(): boolean {
    return !!(window as any).bookmarkExtensionAvailable;
  }

  /**
   * Force check extension availability with silent communication
   */
  static async forceCheckAvailability(): Promise<boolean> {
    return new Promise((resolve) => {
      let responseReceived = false;
      
      const testHandler = (event: MessageEvent) => {
        if (event.data.source === 'bookmark-manager-extension' && 
            event.data.type === 'availabilityResponse') {
          responseReceived = true;
          (window as any).bookmarkExtensionAvailable = event.data.available;
          window.removeEventListener('message', testHandler);
          resolve(event.data.available);
        }
      };
      
      window.addEventListener('message', testHandler);
      
      // Send availability check (this will be handled silently by content script)
      window.postMessage({
        source: 'bookmark-manager-webapp',
        type: 'availabilityCheck',
        timestamp: Date.now()
      }, window.location.origin);
      
      // Timeout after 1 second
      setTimeout(() => {
        window.removeEventListener('message', testHandler);
        if (!responseReceived) {
          (window as any).bookmarkExtensionAvailable = false;
          resolve(false);
        }
      }, 1000);
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
      
      let responseReceived = false;
      let timeoutId: NodeJS.Timeout;
      
      const handleResponse = (event: MessageEvent) => {
        if (event.data.source === 'bookmark-manager-extension' &&
            event.data.requestId === requestId) {
          
          responseReceived = true;
          clearTimeout(timeoutId);
          this.removeMessageHandler(`response_${requestId}`);
          
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
      } catch (error) {
        this.removeMessageHandler(`response_${requestId}`);
        reject(new Error(`Failed to send message: ${error}`));
        return;
      }

      // Timeout handling with longer timeout for bookmark operations
      timeoutId = setTimeout(() => {
        if (!responseReceived) {
          this.removeMessageHandler(`response_${requestId}`);
          reject(new Error(`Extension request timeout (${timeout}ms) for action: ${payload.action}`));
        }
      }, timeout);
    });
  }

  /**
   * Get all bookmarks from Chrome extension with retry logic
   */
  static async getBookmarks(): Promise<ExtensionBookmark[]> {
    try {
      const response = await this.sendMessage({ action: 'getBookmarks' }, 15000); // 15 second timeout
      const bookmarks = response.bookmarks || [];
      
      // Validate bookmark structure
      const validBookmarks = bookmarks.filter((bookmark: any) => {
        const isValid = bookmark && 
                       typeof bookmark.id === 'string' && 
                       typeof bookmark.title === 'string' && 
                       typeof bookmark.url === 'string';
        
        return isValid;
      });
      
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
    try {
      await this.sendMessage({
        action: 'addBookmark',
        title,
        url,
        parentId
      }, 10000);
    } catch (error) {
      console.error('❌ Failed to add bookmark to Chrome:', error);
      throw error;
    }
  }

  /**
   * Remove bookmark from Chrome
   */
  static async removeBookmark(chromeBookmarkId: string): Promise<void> {
    try {
      await this.sendMessage({
        action: 'removeBookmark',
        id: chromeBookmarkId
      }, 10000);
    } catch (error) {
      console.error('❌ Failed to remove bookmark from Chrome:', error);
      throw error;
    }
  }

  /**
   * Set up extension event listeners for bookmark changes
   */
  static setupEventListeners(onBookmarkChange: (event?: string) => void): () => void {
    const handlerId = `bookmarkEvents_${Date.now()}`;
    
    const handleBookmarkEvent = (event: MessageEvent) => {
      if (event.data.source === 'bookmark-manager-extension') {
        const { event: eventType } = event.data;
        
        if (['bookmarkCreated', 'bookmarkRemoved', 'bookmarkChanged', 'syncRequested'].includes(eventType)) {
          onBookmarkChange(eventType);
        }
      }
    };

    this.addMessageHandler(handlerId, handleBookmarkEvent);
    
    // Return cleanup function
    return () => {
      this.removeMessageHandler(handlerId);
    };
  }

  /**
   * Set up extension availability detection with improved reliability
   */
  static setupAvailabilityDetection(onAvailabilityChange: (available: boolean) => void): () => void {
    let lastAvailability = false;
    let intervalId: NodeJS.Timeout;
    
    const checkAvailability = async () => {
      // Force check availability (now silent)
      const available = await this.forceCheckAvailability();
      
      if (available !== lastAvailability) {
        lastAvailability = available;
        onAvailabilityChange(available);
      }
    };

    const handleExtensionReady = (event: CustomEvent) => {
      (window as any).bookmarkExtensionAvailable = true;
      onAvailabilityChange(true);
    };

    const handleAvailabilityChange = (event: CustomEvent) => {
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

    // Check periodically with force check (less frequent)
    intervalId = setInterval(checkAvailability, 8000);

    // Return cleanup function
    return () => {
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
      // First check if extension flag is set
      if (!(window as any).bookmarkExtensionAvailable) {
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