import { BookmarkService } from './bookmarkService';
import { ExtensionService, ExtensionBookmark } from './extensionService';
import { DatabaseBookmark } from '../lib/supabase';

export interface SyncResult {
  inserted: number;
  updated: number;
  removed: number;
  total: number;
  hasChanges: boolean;
}

export class SyncService {
  private static lastSyncHash: string | null = null;
  
  /**
   * Generate a hash of bookmark data to detect changes
   */
  private static generateBookmarkHash(bookmarks: ExtensionBookmark[]): string {
    const sortedBookmarks = bookmarks
      .map(b => `${b.id}:${b.title}:${b.url}:${b.dateAdded}`)
      .sort()
      .join('|');
    
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < sortedBookmarks.length; i++) {
      const char = sortedBookmarks.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return hash.toString(36);
  }
  
  /**
   * Check if sync is needed by comparing bookmark hashes
   */
  static async checkSyncNeeded(userId: string): Promise<{ needed: boolean; reason: string }> {
    if (!ExtensionService.isExtensionAvailable()) {
      return { needed: false, reason: 'Extension not available' };
    }
    
    try {
      const extensionBookmarks = await ExtensionService.getBookmarks();
      const currentHash = this.generateBookmarkHash(extensionBookmarks);
      
      if (this.lastSyncHash === null) {
        return { needed: true, reason: 'First sync' };
      }
      
      if (this.lastSyncHash !== currentHash) {
        return { needed: true, reason: 'Bookmarks changed' };
      }
      
      return { needed: false, reason: 'Already up to date' };
    } catch (error) {
      return { needed: true, reason: 'Error checking - forcing sync' };
    }
  }
  
  /**
   * Sync Chrome bookmarks with database with enhanced debugging
   */
  static async syncWithExtension(
    userId: string, 
    onProgress?: (status: string) => void
  ): Promise<SyncResult> {
    if (!ExtensionService.isExtensionAvailable()) {
      throw new Error('Chrome extension not available');
    }

    onProgress?.('Testing database connection...');
    
    // Test database connection first
    const connectionTest = await BookmarkService.testConnection(userId);
    if (!connectionTest.success) {
      console.error('❌ Database connection test failed:', connectionTest);
      throw new Error(`Database connection failed: ${connectionTest.message}`);
    }

    onProgress?.('Fetching bookmarks from Chrome...');
    
    // Get bookmarks from extension
    let extensionBookmarks: ExtensionBookmark[];
    
    try {
      extensionBookmarks = await ExtensionService.getBookmarks();
    } catch (error) {
      console.error('❌ Failed to fetch extension bookmarks:', error);
      throw new Error(`Failed to fetch Chrome bookmarks: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    onProgress?.('Fetching bookmarks from database...');
    
    // Get bookmarks from database
    let databaseBookmarks: DatabaseBookmark[];
    
    try {
      databaseBookmarks = await BookmarkService.getBookmarks(userId);
    } catch (error) {
      console.error('❌ Failed to fetch database bookmarks:', error);
      throw new Error(`Failed to fetch database bookmarks: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    onProgress?.('Analyzing differences...');

    // Create maps for efficient lookup
    const dbBookmarkMap = new Map(
      databaseBookmarks
        .filter(b => b.chrome_bookmark_id)
        .map(b => [b.chrome_bookmark_id!, b])
    );

    const extensionBookmarkMap = new Map(
      extensionBookmarks.map(b => [b.id, b])
    );

    // Find bookmarks to insert and update
    const bookmarksToInsert: Partial<DatabaseBookmark>[] = [];
    const bookmarksToUpdate: { id: string; updates: Partial<DatabaseBookmark> }[] = [];

    for (const extBookmark of extensionBookmarks) {
      const existingBookmark = dbBookmarkMap.get(extBookmark.id);

      if (existingBookmark) {
        // Check if update is needed
        if (this.needsUpdate(existingBookmark, extBookmark)) {
          bookmarksToUpdate.push({
            id: existingBookmark.id,
            updates: {
              title: extBookmark.title,
              url: extBookmark.url,
              folder: extBookmark.folder,
              parent_id: extBookmark.parentId,
            }
          });
        }
      } else {
        // New bookmark to insert
        bookmarksToInsert.push({
          user_id: userId,
          chrome_bookmark_id: extBookmark.id,
          title: extBookmark.title,
          url: extBookmark.url,
          folder: extBookmark.folder,
          parent_id: extBookmark.parentId,
          date_added: extBookmark.dateAdded,
        });
      }
    }

    // Find bookmarks to remove (exist in DB but not in Chrome)
    const extensionBookmarkIds = new Set(extensionBookmarks.map(b => b.id));
    const bookmarksToRemove = databaseBookmarks
      .filter(b => b.chrome_bookmark_id && !extensionBookmarkIds.has(b.chrome_bookmark_id))
      .map(b => b.chrome_bookmark_id!);

    // If no changes needed, return early
    if (bookmarksToInsert.length === 0 && bookmarksToUpdate.length === 0 && bookmarksToRemove.length === 0) {
      onProgress?.('No changes needed - already in sync');
      
      return {
        inserted: 0,
        updated: 0,
        removed: 0,
        total: extensionBookmarks.length,
        hasChanges: false
      };
    }

    // Execute operations
    let insertedCount = 0;
    let updatedCount = 0;
    let removedCount = 0;

    try {
      // Insert new bookmarks
      if (bookmarksToInsert.length > 0) {
        onProgress?.(`Adding ${bookmarksToInsert.length} new bookmarks...`);
        
        const inserted = await BookmarkService.bulkInsertBookmarks(userId, bookmarksToInsert);
        insertedCount = inserted.length;
      }

      // Update existing bookmarks
      if (bookmarksToUpdate.length > 0) {
        onProgress?.(`Updating ${bookmarksToUpdate.length} bookmarks...`);
        
        for (const { id, updates } of bookmarksToUpdate) {
          try {
            await BookmarkService.updateBookmark(id, userId, updates);
            updatedCount++;
          } catch (error) {
            console.error(`Failed to update bookmark ${id}:`, error);
            // Continue with other updates
          }
        }
      }

      // Remove deleted bookmarks
      if (bookmarksToRemove.length > 0) {
        onProgress?.(`Removing ${bookmarksToRemove.length} deleted bookmarks...`);
        
        await BookmarkService.removeBookmarksByChromeIds(bookmarksToRemove, userId);
        removedCount = bookmarksToRemove.length;
      }
    } catch (error) {
      console.error('❌ Sync operation failed:', error);
      throw new Error(`Sync operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Update sync hash
    this.lastSyncHash = this.generateBookmarkHash(extensionBookmarks);
    
    onProgress?.('Sync completed successfully');

    const result: SyncResult = {
      inserted: insertedCount,
      updated: updatedCount,
      removed: removedCount,
      total: extensionBookmarks.length,
      hasChanges: insertedCount > 0 || updatedCount > 0 || removedCount > 0
    };

    return result;
  }

  /**
   * Check if a database bookmark needs to be updated based on extension data
   */
  private static needsUpdate(dbBookmark: DatabaseBookmark, extBookmark: ExtensionBookmark): boolean {
    return (
      dbBookmark.title !== extBookmark.title ||
      dbBookmark.url !== extBookmark.url ||
      dbBookmark.folder !== extBookmark.folder ||
      dbBookmark.parent_id !== extBookmark.parentId
    );
  }

  /**
   * Add bookmark to both database and Chrome (if available)
   */
  static async addBookmarkEverywhere(
    userId: string,
    title: string,
    url: string,
    folder?: string
  ): Promise<DatabaseBookmark> {
    // Add to database first
    const bookmark = await BookmarkService.addBookmark(userId, title, url, folder);

    // Try to add to Chrome extension if available
    if (ExtensionService.isExtensionAvailable()) {
      try {
        await ExtensionService.addBookmark(title, url);
        // Invalidate sync hash since we added a bookmark
        this.lastSyncHash = null;
      } catch (error) {
        console.warn('⚠️ Failed to add bookmark to Chrome:', error);
        // Don't throw - database operation succeeded
      }
    }

    return bookmark;
  }

  /**
   * Remove bookmark from both database and Chrome (if available)
   */
  static async removeBookmarkEverywhere(
    bookmarkId: string,
    userId: string,
    chromeBookmarkId?: string
  ): Promise<void> {
    // Remove from database first
    await BookmarkService.removeBookmark(bookmarkId, userId);

    // Try to remove from Chrome extension if available and has Chrome ID
    if (ExtensionService.isExtensionAvailable() && chromeBookmarkId) {
      try {
        await ExtensionService.removeBookmark(chromeBookmarkId);
        // Invalidate sync hash since we removed a bookmark
        this.lastSyncHash = null;
      } catch (error) {
        console.warn('⚠️ Failed to remove bookmark from Chrome:', error);
        // Don't throw - database operation succeeded
      }
    }
  }
}