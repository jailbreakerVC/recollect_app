import { BookmarkService } from './bookmarkService';
import { ExtensionService, ExtensionBookmark } from './extensionService';
import { DatabaseBookmark } from '../lib/supabase';

export class SyncService {
  /**
   * Sync Chrome bookmarks with database
   */
  static async syncWithExtension(userId: string): Promise<void> {
    if (!ExtensionService.isExtensionAvailable()) {
      throw new Error('Chrome extension not available');
    }

    // Get bookmarks from both sources
    const [extensionBookmarks, databaseBookmarks] = await Promise.all([
      ExtensionService.getBookmarks(),
      BookmarkService.getBookmarks(userId)
    ]);

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

    // Execute operations
    const operations = [];

    if (bookmarksToInsert.length > 0) {
      operations.push(BookmarkService.bulkInsertBookmarks(bookmarksToInsert));
    }

    if (bookmarksToUpdate.length > 0) {
      operations.push(
        ...bookmarksToUpdate.map(({ id, updates }) =>
          BookmarkService.updateBookmark(id, userId, updates)
        )
      );
    }

    if (bookmarksToRemove.length > 0) {
      operations.push(BookmarkService.removeBookmarksByChromeIds(bookmarksToRemove, userId));
    }

    await Promise.all(operations);
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
      } catch (error) {
        console.warn('Failed to add bookmark to Chrome:', error);
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
      } catch (error) {
        console.warn('Failed to remove bookmark from Chrome:', error);
        // Don't throw - database operation succeeded
      }
    }
  }
}