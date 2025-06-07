import { BookmarkService } from './bookmarkService';
import { extensionService } from './extensionService';
import { ExtensionBookmark, DatabaseBookmark, SyncResult } from '../types';
import { Logger } from '../utils/logger';
import { ValidationUtils } from '../utils/validation';
import { APP_CONFIG } from '../constants';

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
    if (!ValidationUtils.validateUserId(userId)) {
      throw new Error('Invalid user ID');
    }

    Logger.info('SyncService', `Starting sync for user: ${userId}`);
    
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

    onProgress?.('Analyzing differences...');

    const analysis = this.analyzeBookmarkDifferences(extensionBookmarks, databaseBookmarks);
    
    Logger.info('SyncService', 'Sync analysis', analysis);

    // If no changes needed, return early
    if (analysis.toInsert.length === 0 && analysis.toUpdate.length === 0 && analysis.toRemove.length === 0) {
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

    // Execute sync operations
    const result = await this.executeSyncOperations(
      userId,
      analysis,
      extensionBookmarks.length,
      onProgress
    );

    // Update sync hash
    this.lastSyncHash = this.generateBookmarkHash(extensionBookmarks);
    
    onProgress?.('Sync completed successfully');

    Logger.info('SyncService', 'Sync completed', result);
    return result;
  }

  private static analyzeBookmarkDifferences(
    extensionBookmarks: ExtensionBookmark[],
    databaseBookmarks: DatabaseBookmark[]
  ) {
    const dbBookmarkMap = new Map(
      databaseBookmarks
        .filter(b => b.chrome_bookmark_id)
        .map(b => [b.chrome_bookmark_id!, b])
    );

    const extensionBookmarkMap = new Map(
      extensionBookmarks.map(b => [b.id, b])
    );

    Logger.info('SyncService', 'Analysis', {
      extensionBookmarks: extensionBookmarks.length,
      databaseBookmarks: databaseBookmarks.length,
      dbBookmarksWithChromeId: dbBookmarkMap.size,
      extensionBookmarksMapped: extensionBookmarkMap.size
    });

    const toInsert: Partial<DatabaseBookmark>[] = [];
    const toUpdate: { id: string; updates: Partial<DatabaseBookmark> }[] = [];

    for (const extBookmark of extensionBookmarks) {
      const existingBookmark = dbBookmarkMap.get(extBookmark.id);

      if (existingBookmark) {
        if (this.needsUpdate(existingBookmark, extBookmark)) {
          Logger.debug('SyncService', `Bookmark needs update: ${extBookmark.title}`);
          toUpdate.push({
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
        Logger.debug('SyncService', `New bookmark to insert: ${extBookmark.title}`);
        toInsert.push({
          chrome_bookmark_id: extBookmark.id,
          title: extBookmark.title,
          url: extBookmark.url,
          folder: extBookmark.folder,
          parent_id: extBookmark.parentId,
          date_added: extBookmark.dateAdded,
        });
      }
    }

    const extensionBookmarkIds = new Set(extensionBookmarks.map(b => b.id));
    const toRemove = databaseBookmarks
      .filter(b => b.chrome_bookmark_id && !extensionBookmarkIds.has(b.chrome_bookmark_id))
      .map(b => b.chrome_bookmark_id!);

    Logger.info('SyncService', 'Operations planned', {
      insert: toInsert.length,
      update: toUpdate.length,
      remove: toRemove.length
    });

    return { toInsert, toUpdate, toRemove };
  }

  private static async executeSyncOperations(
    userId: string,
    analysis: { toInsert: Partial<DatabaseBookmark>[]; toUpdate: any[]; toRemove: string[] },
    totalBookmarks: number,
    onProgress?: (status: string) => void
  ): Promise<SyncResult> {
    let insertedCount = 0;
    let updatedCount = 0;
    let removedCount = 0;

    try {
      // Insert new bookmarks
      if (analysis.toInsert.length > 0) {
        onProgress?.(`Adding ${analysis.toInsert.length} new bookmarks...`);
        Logger.info('SyncService', `Inserting bookmarks: ${analysis.toInsert.length}`);
        Logger.debug('SyncService', 'Sample bookmarks to insert', analysis.toInsert.slice(0, 2));
        
        const inserted = await BookmarkService.bulkInsertBookmarks(userId, analysis.toInsert);
        insertedCount = inserted.length;
        Logger.info('SyncService', `Successfully inserted ${insertedCount} bookmarks`);
      }

      // Update existing bookmarks
      if (analysis.toUpdate.length > 0) {
        onProgress?.(`Updating ${analysis.toUpdate.length} bookmarks...`);
        Logger.info('SyncService', `Updating bookmarks: ${analysis.toUpdate.length}`);
        
        for (const { id, updates } of analysis.toUpdate) {
          try {
            await BookmarkService.updateBookmark(id, userId, updates);
            updatedCount++;
          } catch (error) {
            Logger.error('SyncService', `Failed to update bookmark ${id}`, error);
          }
        }
        Logger.info('SyncService', `Successfully updated ${updatedCount} bookmarks`);
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
    if (!ValidationUtils.validateUserId(userId)) {
      throw new Error('Invalid user ID');
    }

    if (!ValidationUtils.isValidBookmarkTitle(title) || !ValidationUtils.isValidUrl(url)) {
      throw new Error('Invalid bookmark data');
    }

    Logger.info('SyncService', 'Adding bookmark everywhere', { userId, title, url, folder });
    
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
    if (!ValidationUtils.validateUserId(userId)) {
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