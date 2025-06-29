import { BookmarkService } from './bookmarkService';
import { extensionService } from './extensionService';
import { ExtensionBookmark, DatabaseBookmark, SyncResult } from '../types';
import { Logger } from '../utils/logger';
import { APP_CONFIG } from '../constants';

// Define validation functions directly to avoid circular imports
const validateUserId = (userId: string): boolean => {
  return typeof userId === 'string' && userId.trim().length > 0;
};

const isValidBookmarkTitle = (title: string): boolean => {
  return typeof title === 'string' && title.trim().length > 0;
};

const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

export class SyncService {
  private static lastSyncHash: string | null = null;
  
  private static generateBookmarkHash(bookmarks: ExtensionBookmark[]): string {
    const sortedBookmarks = bookmarks
      .map(b => `${b.id}:${b.title}:${b.url}:${b.dateAdded}`)
      .sort()
      .join('|');
    
    let hash = 0;
    for (let i = 0; i < sortedBookmarks.length; i++) {
      const char = sortedBookmarks.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    return hash.toString(36);
  }
  
  static async checkSyncNeeded(userId: string): Promise<{ needed: boolean; reason: string }> {
    if (!extensionService.isExtensionAvailable()) {
      return { needed: false, reason: 'Extension not available' };
    }
    
    try {
      const extensionBookmarks = await extensionService.getBookmarks();
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
  
  static async syncWithExtension(
    userId: string, 
    onProgress?: (status: string) => void
  ): Promise<SyncResult> {
    if (!validateUserId(userId)) {
      throw new Error('Invalid user ID');
    }

    Logger.info('SyncService', `Starting sync with duplicate prevention for user: ${userId}`);
    
    if (!extensionService.isExtensionAvailable()) {
      throw new Error('Chrome extension not available');
    }

    onProgress?.('Testing database connection...');
    
    // Test database connection
    const connectionTest = await BookmarkService.testConnection(userId);
    if (!connectionTest.success) {
      Logger.error('SyncService', 'Database connection test failed', connectionTest);
      throw new Error(`Database connection failed: ${connectionTest.message}`);
    }
    
    Logger.info('SyncService', 'Database connection test passed');

    onProgress?.('Fetching bookmarks from Chrome...');
    
    // Get bookmarks from extension
    let extensionBookmarks: ExtensionBookmark[];
    
    try {
      extensionBookmarks = await extensionService.getBookmarks();
      Logger.info('SyncService', `Extension bookmarks fetched: ${extensionBookmarks.length}`);
      
      if (extensionBookmarks.length > 0) {
        Logger.debug('SyncService', 'Sample extension bookmarks', extensionBookmarks.slice(0, 3));
      }
    } catch (error) {
      Logger.error('SyncService', 'Failed to fetch extension bookmarks', error);
      throw new Error(`Failed to fetch Chrome bookmarks: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    onProgress?.('Fetching bookmarks from database...');
    
    // Get bookmarks from database
    let databaseBookmarks: DatabaseBookmark[];
    
    try {
      databaseBookmarks = await BookmarkService.getBookmarks(userId);
      Logger.info('SyncService', `Database bookmarks fetched: ${databaseBookmarks.length}`);
      
      if (databaseBookmarks.length > 0) {
        Logger.debug('SyncService', 'Sample database bookmarks', databaseBookmarks.slice(0, 3));
      }
    } catch (error) {
      Logger.error('SyncService', 'Failed to fetch database bookmarks', error);
      throw new Error(`Failed to fetch database bookmarks: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    onProgress?.('Analyzing differences with duplicate detection...');

    const analysis = this.analyzeBookmarkDifferencesWithDuplicateDetection(extensionBookmarks, databaseBookmarks);
    
    Logger.info('SyncService', 'Sync analysis with duplicate prevention', analysis);

    // If no changes needed, return early
    if (analysis.toUpsert.length === 0 && analysis.toRemove.length === 0) {
      Logger.info('SyncService', 'No changes needed - bookmarks are already in sync');
      onProgress?.('No changes needed - already in sync');
      
      return {
        inserted: 0,
        updated: 0,
        removed: 0,
        total: extensionBookmarks.length,
        hasChanges: false
      };
    }

    // Execute sync operations with duplicate prevention
    const result = await this.executeSyncOperationsWithDuplicateDetection(
      userId,
      analysis,
      extensionBookmarks.length,
      onProgress
    );

    // Update sync hash
    this.lastSyncHash = this.generateBookmarkHash(extensionBookmarks);
    
    onProgress?.('Sync completed successfully');

    Logger.info('SyncService', 'Sync completed with duplicate prevention', result);
    return result;
  }

  private static analyzeBookmarkDifferencesWithDuplicateDetection(
    extensionBookmarks: ExtensionBookmark[],
    databaseBookmarks: DatabaseBookmark[]
  ) {
    // Create maps for efficient lookup
    const dbBookmarkMap = new Map(
      databaseBookmarks
        .filter(b => b.chrome_bookmark_id)
        .map(b => [b.chrome_bookmark_id!, b])
    );

    // Create maps for title and URL based lookup to detect duplicates
    const dbTitleMap = new Map(
      databaseBookmarks.map(b => [b.title.toLowerCase().trim(), b])
    );

    const dbUrlMap = new Map(
      databaseBookmarks.map(b => [b.url.toLowerCase().trim(), b])
    );

    Logger.info('SyncService', 'Analysis with duplicate detection', {
      extensionBookmarks: extensionBookmarks.length,
      databaseBookmarks: databaseBookmarks.length,
      dbBookmarksWithChromeId: dbBookmarkMap.size,
      dbTitleMap: dbTitleMap.size,
      dbUrlMap: dbUrlMap.size
    });

    const toUpsert: Array<Partial<DatabaseBookmark> & { operation: 'insert' | 'update' }> = [];

    for (const extBookmark of extensionBookmarks) {
      // First check by Chrome ID (most specific)
      const existingByChrome = dbBookmarkMap.get(extBookmark.id);
      
      if (existingByChrome) {
        // Bookmark exists by Chrome ID, check if it needs updating
        if (this.needsUpdate(existingByChrome, extBookmark)) {
          Logger.debug('SyncService', `Bookmark needs update by Chrome ID: ${extBookmark.title}`);
          toUpsert.push({
            operation: 'update',
            chrome_bookmark_id: extBookmark.id,
            title: extBookmark.title,
            url: extBookmark.url,
            folder: extBookmark.folder,
            parent_id: extBookmark.parentId,
          });
        }
        continue;
      }

      // Check for duplicates by title or URL
      const existingByTitle = dbTitleMap.get(extBookmark.title.toLowerCase().trim());
      const existingByUrl = dbUrlMap.get(extBookmark.url.toLowerCase().trim());

      if (existingByTitle || existingByUrl) {
        // Found a duplicate, update the existing bookmark with Chrome ID
        const existingBookmark = existingByTitle || existingByUrl;
        Logger.debug('SyncService', `Found duplicate bookmark, will update: ${extBookmark.title}`);
        
        toUpsert.push({
          operation: 'update',
          chrome_bookmark_id: extBookmark.id,
          title: extBookmark.title,
          url: extBookmark.url,
          folder: extBookmark.folder,
          parent_id: extBookmark.parentId,
        });
      } else {
        // No duplicate found, insert new bookmark
        Logger.debug('SyncService', `New bookmark to insert: ${extBookmark.title}`);
        toUpsert.push({
          operation: 'insert',
          chrome_bookmark_id: extBookmark.id,
          title: extBookmark.title,
          url: extBookmark.url,
          folder: extBookmark.folder,
          parent_id: extBookmark.parentId,
          date_added: extBookmark.dateAdded,
        });
      }
    }

    // Find bookmarks to remove (exist in DB with Chrome ID but not in extension)
    const extensionBookmarkIds = new Set(extensionBookmarks.map(b => b.id));
    const toRemove = databaseBookmarks
      .filter(b => b.chrome_bookmark_id && !extensionBookmarkIds.has(b.chrome_bookmark_id))
      .map(b => b.chrome_bookmark_id!);

    Logger.info('SyncService', 'Operations planned with duplicate detection', {
      upsert: toUpsert.length,
      remove: toRemove.length,
      insertOperations: toUpsert.filter(op => op.operation === 'insert').length,
      updateOperations: toUpsert.filter(op => op.operation === 'update').length,
    });

    return { toUpsert, toRemove };
  }

  private static async executeSyncOperationsWithDuplicateDetection(
    userId: string,
    analysis: { toUpsert: Array<Partial<DatabaseBookmark> & { operation: 'insert' | 'update' }>; toRemove: string[] },
    totalBookmarks: number,
    onProgress?: (status: string) => void
  ): Promise<SyncResult> {
    let insertedCount = 0;
    let updatedCount = 0;
    let removedCount = 0;

    try {
      // Process upsert operations (both inserts and updates)
      if (analysis.toUpsert.length > 0) {
        onProgress?.(`Processing ${analysis.toUpsert.length} bookmark changes...`);
        Logger.info('SyncService', `Processing upsert operations: ${analysis.toUpsert.length}`);
        
        for (const bookmarkData of analysis.toUpsert) {
          try {
            const result = await BookmarkService.addBookmark(
              userId,
              bookmarkData.title!,
              bookmarkData.url!,
              bookmarkData.folder,
              bookmarkData.chrome_bookmark_id
            );
            
            // The addBookmark method now uses upsert, so we need to check what actually happened
            // For now, we'll count based on the operation type we determined
            if (bookmarkData.operation === 'insert') {
              insertedCount++;
            } else {
              updatedCount++;
            }
            
          } catch (error) {
            Logger.error('SyncService', `Failed to upsert bookmark ${bookmarkData.title}`, error);
            // Continue with other bookmarks even if one fails
          }
        }
        
        Logger.info('SyncService', `Successfully processed ${insertedCount + updatedCount} bookmark operations`);
      }

      // Remove deleted bookmarks
      if (analysis.toRemove.length > 0) {
        onProgress?.(`Removing ${analysis.toRemove.length} deleted bookmarks...`);
        Logger.info('SyncService', `Removing bookmarks: ${analysis.toRemove.length}`);
        Logger.debug('SyncService', 'Chrome IDs to remove', analysis.toRemove);
        
        await BookmarkService.removeBookmarksByChromeIds(analysis.toRemove, userId);
        removedCount = analysis.toRemove.length;
        Logger.info('SyncService', `Successfully removed ${removedCount} bookmarks`);
      }
    } catch (error) {
      Logger.error('SyncService', 'Sync operation failed', error);
      throw new Error(`Sync operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
      inserted: insertedCount,
      updated: updatedCount,
      removed: removedCount,
      total: totalBookmarks,
      hasChanges: insertedCount > 0 || updatedCount > 0 || removedCount > 0
    };
  }

  private static needsUpdate(dbBookmark: DatabaseBookmark, extBookmark: ExtensionBookmark): boolean {
    const needsUpdate = (
      dbBookmark.title !== extBookmark.title ||
      dbBookmark.url !== extBookmark.url ||
      dbBookmark.folder !== extBookmark.folder ||
      dbBookmark.parent_id !== extBookmark.parentId
    );
    
    if (needsUpdate) {
      Logger.debug('SyncService', 'Bookmark needs update', {
        id: extBookmark.id,
        title: { old: dbBookmark.title, new: extBookmark.title },
        url: { old: dbBookmark.url, new: extBookmark.url },
        folder: { old: dbBookmark.folder, new: extBookmark.folder },
        parentId: { old: dbBookmark.parent_id, new: extBookmark.parentId }
      });
    }
    
    return needsUpdate;
  }

  static async addBookmarkEverywhere(
    userId: string,
    title: string,
    url: string,
    folder?: string
  ): Promise<DatabaseBookmark> {
    if (!validateUserId(userId)) {
      throw new Error('Invalid user ID');
    }

    if (!isValidBookmarkTitle(title) || !isValidUrl(url)) {
      throw new Error('Invalid bookmark data');
    }

    Logger.info('SyncService', 'Adding bookmark everywhere with duplicate prevention', { userId, title, url, folder });
    
    // Check if bookmark already exists
    const existingCheck = await BookmarkService.checkBookmarkExists(userId, title, url);
    
    if (existingCheck.exists) {
      Logger.info('SyncService', 'Bookmark already exists, returning existing bookmark', {
        existingId: existingCheck.bookmarkId,
        existingTitle: existingCheck.existingTitle
      });
      
      // Return the existing bookmark
      const existingBookmarks = await BookmarkService.getBookmarks(userId);
      const existingBookmark = existingBookmarks.find(b => b.id === existingCheck.bookmarkId);
      
      if (existingBookmark) {
        return existingBookmark;
      }
    }
    
    const bookmark = await BookmarkService.addBookmark(userId, title, url, folder);

    if (extensionService.isExtensionAvailable()) {
      try {
        await extensionService.addBookmark(title, url);
        this.lastSyncHash = null;
        Logger.info('SyncService', 'Bookmark added to Chrome extension');
      } catch (error) {
        Logger.warn('SyncService', 'Failed to add bookmark to Chrome', error);
      }
    }

    return bookmark;
  }

  static async removeBookmarkEverywhere(
    bookmarkId: string,
    userId: string,
    chromeBookmarkId?: string
  ): Promise<void> {
    if (!validateUserId(userId)) {
      throw new Error('Invalid user ID');
    }

    Logger.info('SyncService', 'Removing bookmark everywhere', { bookmarkId, userId, chromeBookmarkId });
    
    await BookmarkService.removeBookmark(bookmarkId, userId);

    if (extensionService.isExtensionAvailable() && chromeBookmarkId) {
      try {
        await extensionService.removeBookmark(chromeBookmarkId);
        this.lastSyncHash = null;
        Logger.info('SyncService', 'Bookmark removed from Chrome extension');
      } catch (error) {
        Logger.warn('SyncService', 'Failed to remove bookmark from Chrome', error);
      }
    }
  }
}