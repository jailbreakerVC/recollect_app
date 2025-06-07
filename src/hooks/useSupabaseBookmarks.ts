import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { DatabaseBookmark } from '../lib/supabase';
import { BookmarkService } from '../services/bookmarkService';
import { ExtensionService } from '../services/extensionService';
import { SyncService, SyncResult } from '../services/syncService';

interface UseSupabaseBookmarksReturn {
  bookmarks: DatabaseBookmark[];
  loading: boolean;
  error: string | null;
  extensionAvailable: boolean;
  syncWithExtension: () => Promise<void>;
  addBookmark: (title: string, url: string, folder?: string) => Promise<void>;
  removeBookmark: (id: string) => Promise<void>;
  updateBookmark: (id: string, updates: Partial<DatabaseBookmark>) => Promise<void>;
  refreshBookmarks: () => Promise<void>;
  syncStatus: string | null;
  lastSyncResult: SyncResult | null;
}

export const useSupabaseBookmarks = (): UseSupabaseBookmarksReturn => {
  const { user } = useAuth();
  const [bookmarks, setBookmarks] = useState<DatabaseBookmark[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extensionAvailable, setExtensionAvailable] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);

  // Load bookmarks from database
  const loadBookmarks = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const data = await BookmarkService.getBookmarks(user.id);
      setBookmarks(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load bookmarks';
      setError(message);
      console.error('Failed to load bookmarks:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Set up extension availability detection
  useEffect(() => {
    const cleanup = ExtensionService.setupAvailabilityDetection(setExtensionAvailable);
    return cleanup;
  }, []);

  // Set up extension event listeners
  useEffect(() => {
    if (!extensionAvailable) return;

    const cleanup = ExtensionService.setupEventListeners((event) => {
      if (event === 'syncRequested') {
        // Handle sync request from extension
        handleExtensionSyncRequest();
      } else {
        // Refresh bookmarks for other events
        loadBookmarks();
      }
    });

    return cleanup;
  }, [extensionAvailable, loadBookmarks]);

  // Handle sync request from extension
  const handleExtensionSyncRequest = useCallback(async () => {
    if (!user) return;

    try {
      setSyncStatus('Starting sync...');
      
      const result = await SyncService.syncWithExtension(user.id, (status) => {
        setSyncStatus(status);
      });
      
      setLastSyncResult(result);
      
      if (result.hasChanges) {
        await loadBookmarks(); // Refresh if there were changes
        setSyncStatus(`Synced: +${result.inserted} -${result.removed} ~${result.updated}`);
      } else {
        setSyncStatus('Already up to date');
      }
      
      // Notify extension that sync is complete
      if ((window as any).notifyExtensionSyncComplete) {
        (window as any).notifyExtensionSyncComplete({
          success: true,
          result: result
        });
      }
      
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sync failed';
      setError(message);
      setSyncStatus('Sync failed');
      
      // Notify extension of failure
      if ((window as any).notifyExtensionSyncComplete) {
        (window as any).notifyExtensionSyncComplete({
          success: false,
          error: message
        });
      }
    } finally {
      // Clear sync status after 3 seconds
      setTimeout(() => setSyncStatus(null), 3000);
    }
  }, [user, loadBookmarks]);

  // Load bookmarks when user changes
  useEffect(() => {
    if (user) {
      loadBookmarks();
    } else {
      setBookmarks([]);
      setError(null);
      setSyncStatus(null);
      setLastSyncResult(null);
    }
  }, [loadBookmarks, user]);

  // Sync with Chrome extension
  const syncWithExtension = useCallback(async () => {
    if (!user || !extensionAvailable) return;

    setLoading(true);
    setError(null);
    setSyncStatus('Checking for changes...');

    try {
      const result = await SyncService.syncWithExtension(user.id, (status) => {
        setSyncStatus(status);
      });
      
      setLastSyncResult(result);
      
      if (result.hasChanges) {
        await loadBookmarks(); // Refresh if there were changes
        setSyncStatus(`Synced: +${result.inserted} -${result.removed} ~${result.updated}`);
      } else {
        setSyncStatus('Already up to date');
      }
      
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sync with extension';
      setError(message);
      setSyncStatus('Sync failed');
      console.error('Sync failed:', err);
    } finally {
      setLoading(false);
      // Clear sync status after 3 seconds
      setTimeout(() => setSyncStatus(null), 3000);
    }
  }, [user, extensionAvailable, loadBookmarks]);

  // Add bookmark
  const addBookmark = useCallback(async (title: string, url: string, folder?: string) => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      await SyncService.addBookmarkEverywhere(user.id, title, url, folder);
      await loadBookmarks(); // Refresh after add
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add bookmark';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user, loadBookmarks]);

  // Remove bookmark
  const removeBookmark = useCallback(async (id: string) => {
    if (!user) return;

    // Find the bookmark to get Chrome ID
    const bookmark = bookmarks.find(b => b.id === id);
    if (!bookmark) {
      throw new Error('Bookmark not found');
    }

    setLoading(true);
    setError(null);

    try {
      await SyncService.removeBookmarkEverywhere(id, user.id, bookmark.chrome_bookmark_id);
      await loadBookmarks(); // Refresh after remove
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to remove bookmark';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user, bookmarks, loadBookmarks]);

  // Update bookmark
  const updateBookmark = useCallback(async (id: string, updates: Partial<DatabaseBookmark>) => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      await BookmarkService.updateBookmark(id, user.id, updates);
      await loadBookmarks(); // Refresh after update
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update bookmark';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user, loadBookmarks]);

  // Manual refresh
  const refreshBookmarks = useCallback(async () => {
    setError(null);
    await loadBookmarks();
  }, [loadBookmarks]);

  return {
    bookmarks,
    loading,
    error,
    extensionAvailable,
    syncWithExtension,
    addBookmark,
    removeBookmark,
    updateBookmark,
    refreshBookmarks,
    syncStatus,
    lastSyncResult,
  };
};