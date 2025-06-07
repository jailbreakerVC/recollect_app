import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { DatabaseBookmark, SyncResult, ExtensionStatus } from '../types';
import { BookmarkService } from '../services/bookmarkService';
import { extensionService } from '../services/extensionService';
import { SyncService } from '../services/syncService';
import { Logger } from '../utils/logger';

interface UseSupabaseBookmarksReturn {
  bookmarks: DatabaseBookmark[];
  loading: boolean;
  error: string | null;
  extensionAvailable: boolean;
  extensionStatus: ExtensionStatus;
  syncWithExtension: (onProgress?: (status: string) => void) => Promise<SyncResult>;
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
  const [extensionStatus, setExtensionStatus] = useState<ExtensionStatus>('checking');
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);

  const loadBookmarks = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const data = await BookmarkService.getBookmarks(user.id);
      setBookmarks(data);
      Logger.info('useSupabaseBookmarks', `Loaded ${data.length} bookmarks`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load bookmarks';
      setError(message);
      Logger.error('useSupabaseBookmarks', 'Failed to load bookmarks', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Set up extension availability detection
  useEffect(() => {
    const cleanup = extensionService.setupAvailabilityDetection((available) => {
      setExtensionAvailable(available);
      setExtensionStatus(available ? 'available' : 'unavailable');
    });
    
    return cleanup;
  }, []);

  // Set up extension event listeners
  useEffect(() => {
    if (!extensionAvailable) return;

    const cleanup = extensionService.setupEventListeners((event) => {
      Logger.info('useSupabaseBookmarks', `Extension event received: ${event}`);
      
      if (event === 'syncRequested') {
        handleExtensionSyncRequest();
      } else {
        loadBookmarks();
      }
    });

    return cleanup;
  }, [extensionAvailable, loadBookmarks]);

  const handleExtensionSyncRequest = useCallback(async () => {
    if (!user) return;

    try {
      setSyncStatus('Starting sync...');
      
      const result = await SyncService.syncWithExtension(user.id, (status) => {
        setSyncStatus(status);
      });
      
      setLastSyncResult(result);
      
      if (result.hasChanges) {
        await loadBookmarks();
        setSyncStatus(`Synced: +${result.inserted} -${result.removed} ~${result.updated}`);
      } else {
        setSyncStatus('Already up to date');
      }
      
      // Notify extension of completion
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
      
      if ((window as any).notifyExtensionSyncComplete) {
        (window as any).notifyExtensionSyncComplete({
          success: false,
          error: message
        });
      }
    } finally {
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

  const syncWithExtension = useCallback(async (onProgress?: (status: string) => void): Promise<SyncResult> => {
    if (!user || !extensionAvailable) {
      throw new Error('Extension not available or user not logged in');
    }

    setLoading(true);
    setError(null);
    setSyncStatus('Checking for changes...');
    onProgress?.('Checking for changes...');

    try {
      const result = await SyncService.syncWithExtension(user.id, (status) => {
        setSyncStatus(status);
        onProgress?.(status);
      });
      
      setLastSyncResult(result);
      
      if (result.hasChanges) {
        await loadBookmarks();
        const statusMessage = `Synced: +${result.inserted} -${result.removed} ~${result.updated}`;
        setSyncStatus(statusMessage);
        onProgress?.(statusMessage);
      } else {
        setSyncStatus('Already up to date');
        onProgress?.('Already up to date');
      }
      
      return result;
      
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sync with extension';
      setError(message);
      setSyncStatus('Sync failed');
      onProgress?.('Sync failed');
      Logger.error('useSupabaseBookmarks', 'Sync failed', err);
      throw err;
    } finally {
      setLoading(false);
      setTimeout(() => setSyncStatus(null), 3000);
    }
  }, [user, extensionAvailable, loadBookmarks]);

  const addBookmark = useCallback(async (title: string, url: string, folder?: string) => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      await SyncService.addBookmarkEverywhere(user.id, title, url, folder);
      await loadBookmarks();
      Logger.info('useSupabaseBookmarks', 'Bookmark added successfully');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add bookmark';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user, loadBookmarks]);

  const removeBookmark = useCallback(async (id: string) => {
    if (!user) return;

    const bookmark = bookmarks.find(b => b.id === id);
    if (!bookmark) {
      throw new Error('Bookmark not found');
    }

    setLoading(true);
    setError(null);

    try {
      await SyncService.removeBookmarkEverywhere(id, user.id, bookmark.chrome_bookmark_id);
      await loadBookmarks();
      Logger.info('useSupabaseBookmarks', 'Bookmark removed successfully');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to remove bookmark';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user, bookmarks, loadBookmarks]);

  const updateBookmark = useCallback(async (id: string, updates: Partial<DatabaseBookmark>) => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      await BookmarkService.updateBookmark(id, user.id, updates);
      await loadBookmarks();
      Logger.info('useSupabaseBookmarks', 'Bookmark updated successfully');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update bookmark';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user, loadBookmarks]);

  const refreshBookmarks = useCallback(async () => {
    setError(null);
    await loadBookmarks();
  }, [loadBookmarks]);

  return {
    bookmarks,
    loading,
    error,
    extensionAvailable,
    extensionStatus,
    syncWithExtension,
    addBookmark,
    removeBookmark,
    updateBookmark,
    refreshBookmarks,
    syncStatus,
    lastSyncResult,
  };
};