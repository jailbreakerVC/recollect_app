import { useState, useEffect, useCallback } from 'react';
import { supabase, DatabaseBookmark } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface ExtensionBookmark {
  id: string;
  title: string;
  url: string;
  dateAdded: string;
  folder?: string;
  parentId?: string;
}

interface UseSupabaseBookmarksReturn {
  bookmarks: DatabaseBookmark[];
  loading: boolean;
  error: string | null;
  extensionAvailable: boolean;
  connectionStatus: string;
  syncWithExtension: () => Promise<void>;
  addBookmark: (title: string, url: string, folder?: string) => Promise<void>;
  removeBookmark: (id: string) => Promise<void>;
  updateBookmark: (id: string, updates: Partial<DatabaseBookmark>) => Promise<void>;
}

export const useSupabaseBookmarks = (): UseSupabaseBookmarksReturn => {
  const { user } = useAuth();
  const [bookmarks, setBookmarks] = useState<DatabaseBookmark[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extensionAvailable, setExtensionAvailable] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');

  // Check if extension is available
  useEffect(() => {
    const checkExtension = () => {
      setExtensionAvailable(!!(window as any).bookmarkExtensionAvailable);
    };

    checkExtension();

    const handleExtensionReady = () => {
      setExtensionAvailable(true);
    };

    window.addEventListener('bookmarkExtensionReady', handleExtensionReady);
    return () => window.removeEventListener('bookmarkExtensionReady', handleExtensionReady);
  }, []);

  // Load bookmarks from Supabase
  const loadBookmarks = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const { data, error: supabaseError } = await supabase
        .from('bookmarks')
        .select('*')
        .eq('user_id', user.id)
        .order('date_added', { ascending: false });

      if (supabaseError) throw supabaseError;
      setBookmarks(data || []);
    } catch (err) {
      console.error('Error loading bookmarks:', err);
      setError(err instanceof Error ? err.message : 'Failed to load bookmarks');
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Load bookmarks when user changes
  useEffect(() => {
    loadBookmarks();
  }, [loadBookmarks]);

  // Set up real-time subscription with enhanced error handling
  useEffect(() => {
    if (!user) return;

    console.log('Setting up Supabase real-time subscription for user:', user.id);
    setConnectionStatus('connecting');

    const channel = supabase.channel(`bookmarks_${user.id}`, {
      config: {
        broadcast: { self: true },
        presence: { key: user.id }
      }
    });

    const subscription = channel
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookmarks',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('Real-time bookmark change detected:', payload);
          loadBookmarks();
        }
      )
      .subscribe((status, err) => {
        console.log('Subscription status:', status);
        setConnectionStatus(status);
        
        if (err) {
          console.error('Subscription error:', err);
          setError(`Real-time connection error: ${err.message}`);
        }
        
        if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed to real-time updates');
          setError(null);
        } else if (status === 'CHANNEL_ERROR') {
          console.error('Channel error occurred');
          setError('Real-time connection failed. Updates may be delayed.');
        } else if (status === 'TIMED_OUT') {
          console.error('Subscription timed out');
          setError('Real-time connection timed out. Retrying...');
        } else if (status === 'CLOSED') {
          console.log('Subscription closed');
          setConnectionStatus('disconnected');
        }
      });

    return () => {
      console.log('Cleaning up subscription');
      subscription.unsubscribe();
      setConnectionStatus('disconnected');
    };
  }, [user, loadBookmarks]);

  // Listen for extension bookmark changes
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.source === 'bookmark-manager-extension') {
        if (event.data.event === 'bookmarkCreated' || 
            event.data.event === 'bookmarkRemoved' || 
            event.data.event === 'bookmarkChanged') {
          console.log('Extension bookmark change detected:', event.data.event);
          syncWithExtension();
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

      window.postMessage({
        source: 'bookmark-manager-webapp',
        requestId,
        payload
      }, window.location.origin);

      setTimeout(() => {
        window.removeEventListener('message', handleResponse);
        reject(new Error('Extension request timeout'));
      }, 5000);
    });
  }, [extensionAvailable]);

  const syncWithExtension = useCallback(async () => {
    if (!extensionAvailable || !user) return;

    setLoading(true);
    setError(null);

    try {
      console.log('Starting sync with Chrome extension...');
      
      // Get bookmarks from Chrome extension
      const response = await sendMessageToExtension({ action: 'getBookmarks' });
      const extensionBookmarks: ExtensionBookmark[] = response.bookmarks || [];
      
      console.log(`Found ${extensionBookmarks.length} bookmarks in Chrome`);

      // Get existing bookmarks from database
      const { data: existingBookmarks } = await supabase
        .from('bookmarks')
        .select('*')
        .eq('user_id', user.id);

      const existingMap = new Map(
        (existingBookmarks || []).map(b => [b.chrome_bookmark_id, b])
      );

      // Prepare bookmarks to insert/update
      const bookmarksToUpsert: Partial<DatabaseBookmark>[] = [];

      for (const extBookmark of extensionBookmarks) {
        const existing = existingMap.get(extBookmark.id);
        
        const bookmarkData: Partial<DatabaseBookmark> = {
          user_id: user.id,
          chrome_bookmark_id: extBookmark.id,
          title: extBookmark.title,
          url: extBookmark.url,
          folder: extBookmark.folder,
          parent_id: extBookmark.parentId,
          date_added: extBookmark.dateAdded,
        };

        if (existing) {
          // Update existing bookmark if data has changed
          if (
            existing.title !== extBookmark.title ||
            existing.url !== extBookmark.url ||
            existing.folder !== extBookmark.folder
          ) {
            bookmarkData.id = existing.id;
            bookmarksToUpsert.push(bookmarkData);
          }
        } else {
          // New bookmark
          bookmarksToUpsert.push(bookmarkData);
        }
      }

      // Batch upsert bookmarks
      if (bookmarksToUpsert.length > 0) {
        console.log(`Upserting ${bookmarksToUpsert.length} bookmarks`);
        const { error: upsertError } = await supabase
          .from('bookmarks')
          .upsert(bookmarksToUpsert, { 
            onConflict: 'chrome_bookmark_id',
            ignoreDuplicates: false 
          });

        if (upsertError) throw upsertError;
      }

      // Remove bookmarks that no longer exist in Chrome
      const extensionBookmarkIds = new Set(extensionBookmarks.map(b => b.id));
      const bookmarksToDelete = (existingBookmarks || [])
        .filter(b => b.chrome_bookmark_id && !extensionBookmarkIds.has(b.chrome_bookmark_id))
        .map(b => b.id);

      if (bookmarksToDelete.length > 0) {
        console.log(`Deleting ${bookmarksToDelete.length} bookmarks that no longer exist in Chrome`);
        const { error: deleteError } = await supabase
          .from('bookmarks')
          .delete()
          .in('id', bookmarksToDelete);

        if (deleteError) throw deleteError;
      }

      // Reload bookmarks
      await loadBookmarks();
      console.log('Sync completed successfully');
      
    } catch (err) {
      console.error('Sync error:', err);
      setError(err instanceof Error ? err.message : 'Failed to sync bookmarks');
    } finally {
      setLoading(false);
    }
  }, [extensionAvailable, user, sendMessageToExtension, loadBookmarks]);

  const addBookmark = useCallback(async (title: string, url: string, folder?: string) => {
    if (!user) return;

    try {
      console.log('Adding bookmark:', { title, url, folder });
      
      const { error } = await supabase
        .from('bookmarks')
        .insert({
          user_id: user.id,
          title,
          url,
          folder,
          date_added: new Date().toISOString(),
        });

      if (error) throw error;

      // Also add to Chrome if extension is available
      if (extensionAvailable) {
        try {
          await sendMessageToExtension({
            action: 'addBookmark',
            title,
            url,
          });
          console.log('Bookmark also added to Chrome');
        } catch (extError) {
          console.warn('Failed to add bookmark to Chrome:', extError);
        }
      }
    } catch (err) {
      console.error('Add bookmark error:', err);
      throw new Error(err instanceof Error ? err.message : 'Failed to add bookmark');
    }
  }, [user, extensionAvailable, sendMessageToExtension]);

  const removeBookmark = useCallback(async (id: string) => {
    if (!user) return;

    try {
      console.log('Removing bookmark:', id);
      
      // Get bookmark details first
      const { data: bookmark } = await supabase
        .from('bookmarks')
        .select('chrome_bookmark_id')
        .eq('id', id)
        .single();

      // Remove from database
      const { error } = await supabase
        .from('bookmarks')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Also remove from Chrome if extension is available and bookmark has chrome_bookmark_id
      if (extensionAvailable && bookmark?.chrome_bookmark_id) {
        try {
          await sendMessageToExtension({
            action: 'removeBookmark',
            id: bookmark.chrome_bookmark_id,
          });
          console.log('Bookmark also removed from Chrome');
        } catch (extError) {
          console.warn('Failed to remove bookmark from Chrome:', extError);
        }
      }
    } catch (err) {
      console.error('Remove bookmark error:', err);
      throw new Error(err instanceof Error ? err.message : 'Failed to remove bookmark');
    }
  }, [user, extensionAvailable, sendMessageToExtension]);

  const updateBookmark = useCallback(async (id: string, updates: Partial<DatabaseBookmark>) => {
    if (!user) return;

    try {
      console.log('Updating bookmark:', id, updates);
      
      const { error } = await supabase
        .from('bookmarks')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
    } catch (err) {
      console.error('Update bookmark error:', err);
      throw new Error(err instanceof Error ? err.message : 'Failed to update bookmark');
    }
  }, [user]);

  // Auto-sync when extension becomes available
  useEffect(() => {
    if (extensionAvailable && user) {
      console.log('Extension became available, starting auto-sync');
      syncWithExtension();
    }
  }, [extensionAvailable, user, syncWithExtension]);

  return {
    bookmarks,
    loading,
    error,
    extensionAvailable,
    connectionStatus,
    syncWithExtension,
    addBookmark,
    removeBookmark,
    updateBookmark,
  };
};