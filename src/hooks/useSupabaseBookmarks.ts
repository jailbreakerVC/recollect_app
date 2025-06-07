import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { DatabaseBookmark } from '../lib/supabase';
import { BookmarkService } from '../services/bookmarkService';
import { ExtensionService } from '../services/extensionService';
import { SyncService } from '../services/syncService';

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
}

export const useSupabaseBookmarks = (): UseSupabaseBookmarksReturn => {
  const { user } = useAuth();
  const [bookmarks, setBookmarks] = useState<DatabaseBookmark[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extensionAvailable, setExtensionAvailable] = useState(false);

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

    const cleanup = ExtensionService.setupEventListeners(() => {
      // Refresh bookmarks when extension events occur
      loadBookmarks();
    });

    return cleanup;
  }, [extensionAvailable, loadBookmarks]);

  // Load bookmarks when user changes
  useEffect(() => {
    if (user) {
      loadBookmarks();
    } else {
      setBookmarks([]);
      setError(null);
    }
  }, [loadBookmarks, user]);

  // Sync with Chrome extension
  const syncWithExtension = useCallback(async () => {
    if (!user || !extensionAvailable) return;

    setLoading(true);
    setError(null);

    try {
      await SyncService.syncWithExtension(user.id);
      await loadBookmarks(); // Refresh after sync
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sync with extension';
      setError(message);
      console.error('Sync failed:', err);
    } finally {
      setLoading(false);
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
  };
};