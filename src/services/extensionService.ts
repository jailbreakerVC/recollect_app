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
      
      const handleResponse = (event: MessageEvent) => {
        if (
          event.data.source === 'bookmark-manager-extension' &&
          event.data.requestId === requestId
        ) {
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
    const handleMessage = (event: MessageEvent) => {
      if (event.data.source === 'bookmark-manager-extension') {
        const { event: eventType } = event.data;
        
        if (['bookmarkCreated', 'bookmarkRemoved', 'bookmarkChanged', 'syncRequested'].includes(eventType)) {
          onBookmarkChange(eventType);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    
    // Return cleanup function
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }

  /**
   * Set up extension availability detection
   */
  static setupAvailabilityDetection(onAvailabilityChange: (available: boolean) => void): () => void {
    const checkAvailability = () => {
      onAvailabilityChange(this.isExtensionAvailable());
    };

    const handleExtensionReady = () => {
      onAvailabilityChange(true);
    };

    // Check immediately
    checkAvailability();

    // Listen for extension ready event
    window.addEventListener('bookmarkExtensionReady', handleExtensionReady);

    // Return cleanup function
    return () => {
      window.removeEventListener('bookmarkExtensionReady', handleExtensionReady);
    };
  }
}