export interface ExtensionBookmark {
  id: string;
  title: string;
  url: string;
  dateAdded: string;
  folder?: string;
  parentId?: string;
}

export class ExtensionService {
  private static requestId = 0;

  /**
   * Check if Chrome extension is available
   */
  static isExtensionAvailable(): boolean {
    return !!(window as any).bookmarkExtensionAvailable;
  }

  /**
   * Send message to Chrome extension
   */
  private static sendMessage(payload: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.isExtensionAvailable()) {
        reject(new Error('Chrome extension not available'));
        return;
      }

      const requestId = `req_${++this.requestId}_${Date.now()}`;
      
      console.log('📤 Sending message to extension:', { requestId, payload });
      
      const handleResponse = (event: MessageEvent) => {
        if (
          event.data.source === 'bookmark-manager-extension' &&
          event.data.requestId === requestId
        ) {
          console.log('📨 Extension response received:', event.data);
          window.removeEventListener('message', handleResponse);
          
          if (event.data.response.success) {
            resolve(event.data.response);
          } else {
            reject(new Error(event.data.response.error || 'Extension request failed'));
          }
        }
      };

      window.addEventListener('message', handleResponse);

      // Send message
      window.postMessage({
        source: 'bookmark-manager-webapp',
        requestId,
        payload
      }, window.location.origin);

      // Timeout after 5 seconds
      setTimeout(() => {
        window.removeEventListener('message', handleResponse);
        reject(new Error('Extension request timeout'));
      }, 5000);
    });
  }

  /**
   * Get all bookmarks from Chrome extension
   */
  static async getBookmarks(): Promise<ExtensionBookmark[]> {
    const response = await this.sendMessage({ action: 'getBookmarks' });
    return response.bookmarks || [];
  }

  /**
   * Add bookmark to Chrome
   */
  static async addBookmark(title: string, url: string, parentId?: string): Promise<void> {
    await this.sendMessage({
      action: 'addBookmark',
      title,
      url,
      parentId
    });
  }

  /**
   * Remove bookmark from Chrome
   */
  static async removeBookmark(chromeBookmarkId: string): Promise<void> {
    await this.sendMessage({
      action: 'removeBookmark',
      id: chromeBookmarkId
    });
  }

  /**
   * Set up extension event listeners
   */
  static setupEventListeners(onBookmarkChange: (event?: string) => void): () => void {
    console.log('👂 Setting up extension event listeners');
    
    const handleMessage = (event: MessageEvent) => {
      // Filter out React DevTools and other non-bookmark messages
      if (event.data.source && (
        event.data.source.includes('react-devtools') ||
        event.data.source.includes('devtools') ||
        event.data.source === 'react-devtools-content-script' ||
        event.data.source === 'react-devtools-bridge'
      )) {
        return; // Ignore React DevTools messages
      }
      
      if (event.data.source === 'bookmark-manager-extension') {
        console.log('📨 Extension event received:', event.data);
        
        const { event: eventType } = event.data;
        
        if (['bookmarkCreated', 'bookmarkRemoved', 'bookmarkChanged', 'syncRequested'].includes(eventType)) {
          console.log('🔄 Triggering bookmark change handler for:', eventType);
          onBookmarkChange(eventType);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    
    // Return cleanup function
    return () => {
      console.log('🧹 Cleaning up extension event listeners');
      window.removeEventListener('message', handleMessage);
    };
  }

  /**
   * Set up extension availability detection
   */
  static setupAvailabilityDetection(onAvailabilityChange: (available: boolean) => void): () => void {
    console.log('🔍 Setting up extension availability detection');
    
    const checkAvailability = () => {
      const available = this.isExtensionAvailable();
      console.log('📱 Extension availability check:', available);
      onAvailabilityChange(available);
    };

    const handleExtensionReady = (event: CustomEvent) => {
      console.log('✅ Extension ready event received:', event.detail);
      onAvailabilityChange(true);
    };

    // Check immediately
    checkAvailability();

    // Listen for extension ready event
    window.addEventListener('bookmarkExtensionReady', handleExtensionReady as EventListener);

    // Also check periodically in case we missed the initial event
    const intervalId = setInterval(checkAvailability, 2000); // Check every 2 seconds

    // Return cleanup function
    return () => {
      console.log('🧹 Cleaning up extension availability detection');
      window.removeEventListener('bookmarkExtensionReady', handleExtensionReady as EventListener);
      clearInterval(intervalId);
    };
  }
}