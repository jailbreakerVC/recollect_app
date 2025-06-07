import { useState, useEffect, useCallback } from 'react';

interface ExtensionBookmark {
  id: string;
  title: string;
  url: string;
  dateAdded: string;
  folder?: string;
  parentId?: string;
}

interface UseExtensionBookmarksReturn {
  bookmarks: ExtensionBookmark[];
  loading: boolean;
  error: string | null;
  extensionAvailable: boolean;
  refreshBookmarks: () => Promise<void>;
  addBookmark: (title: string, url: string, parentId?: string) => Promise<void>;
  removeBookmark: (id: string) => Promise<void>;
}

export const useExtensionBookmarks = (): UseExtensionBookmarksReturn => {
  const [bookmarks, setBookmarks] = useState<ExtensionBookmark[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extensionAvailable, setExtensionAvailable] = useState(false);

  // Check if extension is available
  useEffect(() => {
    const checkExtension = () => {
      setExtensionAvailable(!!(window as any).bookmarkExtensionAvailable);
    };

    // Check immediately
    checkExtension();

    // Listen for extension ready event
    const handleExtensionReady = () => {
      setExtensionAvailable(true);
    };

    window.addEventListener('bookmarkExtensionReady', handleExtensionReady);

    return () => {
      window.removeEventListener('bookmarkExtensionReady', handleExtensionReady);
    };
  }, []);

  // Listen for messages from extension
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.source === 'bookmark-manager-extension') {
        if (event.data.event === 'bookmarkCreated') {
          // Refresh bookmarks when a new one is added
          refreshBookmarks();
        } else if (event.data.event === 'bookmarkRemoved') {
          // Remove bookmark from state
          setBookmarks(prev => prev.filter(b => b.id !== event.data.data.id));
        } else if (event.data.event === 'syncRequested') {
          // Extension requested sync
          refreshBookmarks();
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const sendMessageToExtension = useCallback((payload: any): Promise<any> => {
    return new Promise((resolve, reject) => {
      if (!extensionAvailable) {
        reject(new Error('Extension not available'));
        return;
      }

      const requestId = Math.random().toString(36).substr(2, 9);
      
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

      // Send message to extension
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
  }, [extensionAvailable]);

  const refreshBookmarks = useCallback(async () => {
    if (!extensionAvailable) {
      setError('Chrome extension not available');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await sendMessageToExtension({ action: 'getBookmarks' });
      setBookmarks(response.bookmarks || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bookmarks');
    } finally {
      setLoading(false);
    }
  }, [extensionAvailable, sendMessageToExtension]);

  const addBookmark = useCallback(async (title: string, url: string, parentId?: string) => {
    try {
      await sendMessageToExtension({
        action: 'addBookmark',
        title,
        url,
        parentId
      });
      await refreshBookmarks();
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to add bookmark');
    }
  }, [sendMessageToExtension, refreshBookmarks]);

  const removeBookmark = useCallback(async (id: string) => {
    try {
      await sendMessageToExtension({
        action: 'removeBookmark',
        id
      });
      setBookmarks(prev => prev.filter(b => b.id !== id));
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to remove bookmark');
    }
  }, [sendMessageToExtension]);

  // Load bookmarks when extension becomes available
  useEffect(() => {
    if (extensionAvailable) {
      refreshBookmarks();
    }
  }, [extensionAvailable, refreshBookmarks]);

  return {
    bookmarks,
    loading,
    error,
    extensionAvailable,
    refreshBookmarks,
    addBookmark,
    removeBookmark
  };
};