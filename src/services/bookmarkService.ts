import { supabase, DatabaseBookmark } from '../lib/supabase';

export class BookmarkService {
  /**
   * Fetch all bookmarks for a user
   */
  static async getBookmarks(userId: string): Promise<DatabaseBookmark[]> {
    const { data, error } = await supabase
      .from('bookmarks')
      .select('*')
      .eq('user_id', userId)
      .order('date_added', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch bookmarks: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Add a new bookmark
   */
  static async addBookmark(
    userId: string,
    title: string,
    url: string,
    folder?: string,
    chromeBookmarkId?: string
  ): Promise<DatabaseBookmark> {
    const bookmarkData = {
      user_id: userId,
      title,
      url,
      folder,
      chrome_bookmark_id: chromeBookmarkId,
      date_added: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('bookmarks')
      .insert(bookmarkData)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to add bookmark: ${error.message}`);
    }

    return data;
  }

  /**
   * Update an existing bookmark
   */
  static async updateBookmark(
    bookmarkId: string,
    userId: string,
    updates: Partial<DatabaseBookmark>
  ): Promise<DatabaseBookmark> {
    const { data, error } = await supabase
      .from('bookmarks')
      .update(updates)
      .eq('id', bookmarkId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update bookmark: ${error.message}`);
    }

    return data;
  }

  /**
   * Remove a bookmark
   */
  static async removeBookmark(bookmarkId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('bookmarks')
      .delete()
      .eq('id', bookmarkId)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to remove bookmark: ${error.message}`);
    }
  }

  /**
   * Get bookmark by Chrome bookmark ID
   */
  static async getBookmarkByChromeId(
    chromeBookmarkId: string,
    userId: string
  ): Promise<DatabaseBookmark | null> {
    const { data, error } = await supabase
      .from('bookmarks')
      .select('*')
      .eq('chrome_bookmark_id', chromeBookmarkId)
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to fetch bookmark: ${error.message}`);
    }

    return data || null;
  }

  /**
   * Bulk insert bookmarks (for sync operations)
   */
  static async bulkInsertBookmarks(bookmarks: Partial<DatabaseBookmark>[]): Promise<DatabaseBookmark[]> {
    if (bookmarks.length === 0) return [];

    const { data, error } = await supabase
      .from('bookmarks')
      .insert(bookmarks)
      .select();

    if (error) {
      throw new Error(`Failed to bulk insert bookmarks: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Remove bookmarks by Chrome bookmark IDs (for sync cleanup)
   */
  static async removeBookmarksByChromeIds(
    chromeBookmarkIds: string[],
    userId: string
  ): Promise<void> {
    if (chromeBookmarkIds.length === 0) return;

    const { error } = await supabase
      .from('bookmarks')
      .delete()
      .eq('user_id', userId)
      .in('chrome_bookmark_id', chromeBookmarkIds);

    if (error) {
      throw new Error(`Failed to remove bookmarks: ${error.message}`);
    }
  }
}