import { Logger } from '../utils/logger';
import { APP_CONFIG, EXTENSION_MESSAGES, IGNORED_MESSAGE_SOURCES } from '../constants';

// Define types for Chrome extension
interface ChromeRuntime {
  id?: string;
  lastError?: any;
  sendMessage(message: any, callback?: (response: any) => void): void;
  onMessage?: {
    addListener(callback: (message: any, sender: any, sendResponse: (response?: any) => void) => boolean): void;
  };
  onConnect?: {
    addListener(callback: (port: any) => void): void;
  };
}

declare global {
  interface Window {
    chrome?: {
      runtime?: ChromeRuntime;
    };
  }
}

// Define validation functions directly to avoid import issues
const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

const isValidBookmarkTitle = (title: string): boolean => {
  return typeof title === 'string' && title.trim().length > 0;
};

const isValidExtensionBookmark = (bookmark: any): bookmark is ExtensionBookmark => {
  return (
    bookmark &&
    typeof bookmark.id === 'string' &&
    typeof bookmark.title === 'string' &&
    typeof bookmark.url === 'string' &&
    typeof bookmark.dateAdded === 'string' &&
    isValidUrl(bookmark.url) &&
    isValidBookmarkTitle(bookmark.title)
  );
};

export class ExtensionService {
  private static instance: ExtensionService | null = null;
  private messageHandlers = new Map<string, (event: MessageEvent) => void>();
  private isInitialized = false;
  private globalMessageHandler: ((event: MessageEvent) => void) | null = null;
  private availabilityCheckInterval: NodeJS.Timeout | null = null;
  private lastAvailabilityCheck = 0;
  private lastConnectionTest: number | null = null;

  private constructor() {}

  static getInstance(): ExtensionService {
    if (!this.instance) {
      this.instance = new ExtensionService();
    }
    return this.instance;
  }

  initialize(): void {
    if (this.isInitialized) return;
    
    Logger.info('ExtensionService', 'Initializing extension service');
    
    this.setupGlobalMessageHandler();
    this.setupExtensionBridge();
    this.startAvailabilityMonitoring();
    
    this.isInitialized = true;
    Logger.info('ExtensionService', 'Extension service initialized successfully');
  }

  cleanup(): void {
    if (!this.isInitialized) return;
    
    Logger.info('ExtensionService', 'Cleaning up extension service');
    
    if (this.globalMessageHandler) {
      window.removeEventListener('message', this.globalMessageHandler);
      this.globalMessageHandler = null;
    }
    
    if (this.availabilityCheckInterval) {
      clearInterval(this.availabilityCheckInterval);
      this.availabilityCheckInterval = null;
    }
    
    this.messageHandlers.clear();
    delete (window as any).notifyExtensionSyncComplete;
    
    this.isInitialized = false;
    Logger.info('ExtensionService', 'Extension service cleaned up');
  }

  private setupGlobalMessageHandler(): void {
    this.globalMessageHandler = this.handleGlobalMessage.bind(this);
    window.addEventListener('message', this.globalMessageHandler);
  }

  private handleGlobalMessage(event: MessageEvent): void {
    if (!this.isBookmarkManagerMessage(event.data)) return;

    Logger.debug('ExtensionService', 'Received message', event.data);

    this.messageHandlers.forEach(handler => {
      try {
        handler(event);
      } catch (error) {
        Logger.error('ExtensionService', 'Message handler error', error);
      }
    });
  }

  private isBookmarkManagerMessage(data: any): boolean {
    if (!data?.source) return false;
    
    return !IGNORED_MESSAGE_SOURCES.some(ignored => 
      data.source.includes(ignored)
    ) && (
      data.source === EXTENSION_MESSAGES.SOURCES.EXTENSION || 
      data.source === EXTENSION_MESSAGES.SOURCES.WEBAPP
    );
  }

  private setupExtensionBridge(): void {
    Logger.debug('ExtensionService', 'Setting up extension communication bridge');
    
    // Set up sync completion notification
    (window as any).notifyExtensionSyncComplete = (data: any) => {
      Logger.info('ExtensionService', 'Notifying extension of sync completion', data);
      window.postMessage({
        source: EXTENSION_MESSAGES.SOURCES.WEBAPP,
        type: EXTENSION_MESSAGES.TYPES.SYNC_COMPLETE,
        data
      }, window.location.origin);
    };

    // Set up connection test response
    this.addMessageHandler('connectionTest', (event) => {
      if (event.data.source === EXTENSION_MESSAGES.SOURCES.EXTENSION && 
          event.data.event === EXTENSION_MESSAGES.TYPES.CONNECTION_TEST) {
        Logger.debug('ExtensionService', 'Responding to connection test');
        window.postMessage({
          source: EXTENSION_MESSAGES.SOURCES.WEBAPP,
          type: 'connectionTestResponse',
          data: { timestamp: Date.now(), responsive: true }
        }, window.location.origin);
      }
    });

    // Listen for extension ready events
    window.addEventListener(EXTENSION_MESSAGES.TYPES.EXTENSION_READY, (event: any) => {
      Logger.info('ExtensionService', 'Extension ready event received', event.detail);
      (window as any).bookmarkExtensionAvailable = true;
    });

    // Check if extension flag is already set
    if ((window as any).bookmarkExtensionAvailable) {
      Logger.info('ExtensionService', 'Extension flag already set');
    }
  }

  private startAvailabilityMonitoring(): void {
    // Initial check
    this.checkExtensionAvailability();
    
    // Periodic checks every 5 seconds (less frequent to avoid spam)
    this.availabilityCheckInterval = setInterval(() => {
      this.checkExtensionAvailability();
    }, 5000);
  }

  private checkExtensionAvailability(): void {
    const now = Date.now();
    
    // Throttle availability checks to avoid spam
    if (now - this.lastAvailabilityCheck < 2000) {
      return;
    }
    
    this.lastAvailabilityCheck = now;
    
    const wasAvailable = (window as any).bookmarkExtensionAvailable;
    const isAvailable = this.testExtensionPresence();
    
    if (isAvailable !== wasAvailable) {
      Logger.info('ExtensionService', `Extension availability changed: ${isAvailable}`);
      (window as any).bookmarkExtensionAvailable = isAvailable;
      
      window.dispatchEvent(new CustomEvent('extensionAvailabilityChanged', {
        detail: { available: isAvailable }
      }));
    }
  }

  private async testExtensionPresence(): Promise<boolean> {
    // Check multiple indicators of extension presence
    const hasFlag = !!(window as any).bookmarkExtensionAvailable;
    const hasExtensionContext = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id;
    
    // If we're in an extension context, the extension is definitely available
    if (hasExtensionContext) {
      return true;
    }
    
    // If we have the flag but haven't tested yet, do a connection test
    if (hasFlag && !this.lastConnectionTest) {
      try {
        // Send a test message to verify connection
        const response = await this.sendMessageToExtension({
          action: 'connectionTest',
          timestamp: Date.now()
        });
        
        if (response && response.success) {
          this.lastConnectionTest = Date.now();
          return true;
        }
      } catch (error) {
        Logger.error('ExtensionService', 'Connection test failed', error);
      }
    }
    
    // Otherwise, rely on the flag set by the content script
    return hasFlag;
  }

  private async sendMessageToExtension(message: any): Promise<any> {
    return new Promise((resolve) => {
      const requestId = Date.now().toString();
      
      // Add message handler
      const handlerId = this.addMessageHandler('connectionTestResponse', (event) => {
        if (event.data?.requestId === requestId) {
          resolve(event.data);
          this.removeMessageHandler(handlerId);
        }
      });
      
      // Send message to extension
      window.postMessage({
        source: 'bookmark-manager-webapp',
        action: 'connectionTest',
        requestId,
        timestamp: Date.now()
      }, window.location.origin);
      
      // Timeout after 2 seconds
      setTimeout(() => {
        this.removeMessageHandler(handlerId);
        resolve(null);
      }, 2000);
    });
  }

  addMessageHandler(id: string, handler: (event: MessageEvent) => void): string {
    const handlerId = Date.now().toString();
    this.messageHandlers.set(handlerId, handler);
    return handlerId;
  }

  removeMessageHandler(handlerId: string): void {
    this.messageHandlers.delete(handlerId);
  }

  isExtensionAvailable(): boolean {
    const hasFlag = !!(window as any).bookmarkExtensionAvailable;
    const hasExtensionContext = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id;
    
    const available = hasFlag || hasExtensionContext;
    
    Logger.debug('ExtensionService', `Extension availability check: ${available}`, {
      hasFlag,
      hasExtensionContext,
      windowFlag: (window as any).bookmarkExtensionAvailable
    });
    
    return available;
  }

  async forceCheckAvailability(): Promise<boolean> {
    Logger.debug('ExtensionService', 'Force checking extension availability');
    
    // If we're in an extension context, return true immediately
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
      (window as any).bookmarkExtensionAvailable = true;
      return true;
    }
    
    return new Promise((resolve) => {
      let responseReceived = false;
      
      const testHandler = (event: MessageEvent) => {
        if (event.data.source === EXTENSION_MESSAGES.SOURCES.EXTENSION) {
          responseReceived = true;
          (window as any).bookmarkExtensionAvailable = true;
          window.removeEventListener('message', testHandler);
          Logger.info('ExtensionService', 'Extension responded to availability check');
          resolve(true);
        }
      };
      
      window.addEventListener('message', testHandler);
      
      // Send availability check message
      window.postMessage({
        source: EXTENSION_MESSAGES.SOURCES.WEBAPP,
        type: EXTENSION_MESSAGES.TYPES.AVAILABILITY_CHECK,
        timestamp: Date.now()
      }, window.location.origin);
      
      // Timeout after 3 seconds
      setTimeout(() => {
        window.removeEventListener('message', testHandler);
        if (!responseReceived) {
          Logger.warn('ExtensionService', 'Extension did not respond to availability check');
          (window as any).bookmarkExtensionAvailable = false;
          resolve(false);
        }
      }, 3000);
    });
  }

  private async sendMessage(payload: any, timeout = APP_CONFIG.MESSAGE_TIMEOUT): Promise<any> {
    if (!this.isExtensionAvailable()) {
      throw new Error('Chrome extension not available');
    }

    return new Promise((resolve, reject) => {
      const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      let responseReceived = false;
      let timeoutId: NodeJS.Timeout;
      
      const handleResponse = (event: MessageEvent) => {
        if (event.data.source === EXTENSION_MESSAGES.SOURCES.EXTENSION &&
            event.data.requestId === requestId) {
          
          responseReceived = true;
          clearTimeout(timeoutId);
          this.removeMessageHandler(`response_${requestId}`);
          
          Logger.debug('ExtensionService', 'Extension response received', event.data);
          
          if (event.data.response?.success) {
            resolve(event.data.response);
          } else {
            reject(new Error(event.data.response?.error || 'Extension request failed'));
          }
        }
      };

      this.addMessageHandler(`response_${requestId}`, handleResponse);

      try {
        window.postMessage({
          source: EXTENSION_MESSAGES.SOURCES.WEBAPP,
          requestId,
          payload
        }, window.location.origin);
        
        Logger.debug('ExtensionService', 'Message sent to extension', { requestId, payload });
      } catch (error) {
        this.removeMessageHandler(`response_${requestId}`);
        reject(new Error(`Failed to send message: ${error}`));
        return;
      }

      timeoutId = setTimeout(() => {
        if (!responseReceived) {
          this.removeMessageHandler(`response_${requestId}`);
          Logger.error('ExtensionService', `Request timeout for action: ${payload.action}`);
          reject(new Error(`Extension request timeout (${timeout}ms) for action: ${payload.action}`));
        }
      }, timeout);
    });
  }

  async getBookmarks(): Promise<ExtensionBookmark[]> {
    Logger.info('ExtensionService', 'Requesting bookmarks from Chrome extension');
    
    try {
      const response = await this.sendMessage({ 
        action: EXTENSION_MESSAGES.ACTIONS.GET_BOOKMARKS 
      }, APP_CONFIG.SYNC_TIMEOUT);
      
      const bookmarks = response.bookmarks || [];
      Logger.info('ExtensionService', `Received ${bookmarks.length} bookmarks from extension`);
      
      const validBookmarks = bookmarks.filter(isValidExtensionBookmark);
      
      if (validBookmarks.length !== bookmarks.length) {
        Logger.warn('ExtensionService', `Filtered out ${bookmarks.length - validBookmarks.length} invalid bookmarks`);
      }
      
      return validBookmarks;
    } catch (error) {
      Logger.error('ExtensionService', 'Failed to get bookmarks from extension', error);
      throw new Error(`Failed to get Chrome bookmarks: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async addBookmark(title: string, url: string, parentId?: string): Promise<void> {
    Logger.info('ExtensionService', 'Adding bookmark to Chrome', { title, url, parentId });
    
    if (!isValidBookmarkTitle(title) || !isValidUrl(url)) {
      throw new Error('Invalid bookmark data');
    }
    
    try {
      await this.sendMessage({
        action: EXTENSION_MESSAGES.ACTIONS.ADD_BOOKMARK,
        title,
        url,
        parentId
      });
      
      Logger.info('ExtensionService', 'Bookmark added to Chrome successfully');
    } catch (error) {
      Logger.error('ExtensionService', 'Failed to add bookmark to Chrome', error);
      throw error;
    }
  }

  async removeBookmark(chromeBookmarkId: string): Promise<void> {
    Logger.info('ExtensionService', 'Removing bookmark from Chrome', { chromeBookmarkId });
    
    try {
      await this.sendMessage({
        action: EXTENSION_MESSAGES.ACTIONS.REMOVE_BOOKMARK,
        id: chromeBookmarkId
      });
      
      Logger.info('ExtensionService', 'Bookmark removed from Chrome successfully');
    } catch (error) {
      Logger.error('ExtensionService', 'Failed to remove bookmark from Chrome', error);
      throw error;
    }
  }

  setupEventListeners(onBookmarkChange: (event?: string) => void): () => void {
    Logger.info('ExtensionService', 'Setting up extension event listeners');
    
    const handlerId = `bookmarkEvents_${Date.now()}`;
    
    const handleBookmarkEvent = (event: MessageEvent) => {
      if (event.data.source === EXTENSION_MESSAGES.SOURCES.EXTENSION) {
        const { event: eventType } = event.data;
        
        if (['bookmarkCreated', 'bookmarkRemoved', 'bookmarkChanged', 'syncRequested'].includes(eventType)) {
          Logger.info('ExtensionService', `Bookmark event received: ${eventType}`);
          onBookmarkChange(eventType);
        }
      }
    };

    this.addMessageHandler(handlerId, handleBookmarkEvent);
    
    return () => {
      Logger.info('ExtensionService', 'Cleaning up extension event listeners');
      this.removeMessageHandler(handlerId);
    };
  }

  setupAvailabilityDetection(onAvailabilityChange: (available: boolean) => void): () => void {
    Logger.info('ExtensionService', 'Setting up extension availability detection');
    
    let lastAvailability = false;
    let intervalId: NodeJS.Timeout;
    
    const checkAvailability = async () => {
      const available = this.isExtensionAvailable();
      
      if (available !== lastAvailability) {
        Logger.info('ExtensionService', `Extension availability changed: ${available}`);
        lastAvailability = available;
        onAvailabilityChange(available);
      }
    };

    const handleExtensionReady = (event: CustomEvent) => {
      Logger.info('ExtensionService', 'Extension ready event received', event.detail);
      (window as any).bookmarkExtensionAvailable = true;
      onAvailabilityChange(true);
    };

    const handleAvailabilityChange = (event: CustomEvent) => {
      Logger.info('ExtensionService', 'Extension availability change event', event.detail);
      onAvailabilityChange(event.detail.available);
    };

    if (!this.isInitialized) {
      this.initialize();
    }

    // Initial check
    checkAvailability();

    window.addEventListener(EXTENSION_MESSAGES.TYPES.EXTENSION_READY, handleExtensionReady as EventListener);
    window.addEventListener('extensionAvailabilityChanged', handleAvailabilityChange as EventListener);

    // Check every 5 seconds instead of 3 seconds to reduce spam
    intervalId = setInterval(checkAvailability, 5000);

    return () => {
      Logger.info('ExtensionService', 'Cleaning up extension availability detection');
      window.removeEventListener(EXTENSION_MESSAGES.TYPES.EXTENSION_READY, handleExtensionReady as EventListener);
      window.removeEventListener('extensionAvailabilityChanged', handleAvailabilityChange as EventListener);
      clearInterval(intervalId);
    };
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      Logger.info('ExtensionService', 'Testing extension connection');
      
      // First check if extension is available
      const available = this.isExtensionAvailable();
      
      if (!available) {
        Logger.debug('ExtensionService', 'Extension not available, trying force check');
        const forceCheckResult = await this.forceCheckAvailability();
        
        if (!forceCheckResult) {
          return {
            success: false,
            message: 'Extension not available - no response to availability check'
          };
        }
      }
      
      // Try to get bookmarks to test the connection
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

// Export singleton instance
export const extensionService = ExtensionService.getInstance();

// Auto-initialize when module loads
if (typeof window !== 'undefined') {
  // Wait for DOM to be ready before initializing
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      extensionService.initialize();
    });
  } else {
    extensionService.initialize();
  }
}