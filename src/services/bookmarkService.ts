import { supabase, DatabaseBookmark } from '../lib/supabase';

export class BookmarkService {
  /**
   * Set user context for RLS policies
   */
  private static async setUserContext(userId: string): Promise<void> {
    // Use the custom RPC function we created in our migration
    try {
      const { error } = await supabase.rpc('set_user_context', {
        user_id: userId
      });

      if (error) {
        console.warn('Failed to set user context:', error.message);
      }
    } catch (err) {
      console.warn('User context function not available, using direct config:', err);
      // Fallback: try to set config directly (this might not work with RLS)
      try {
        await supabase.rpc('set_config', {
          setting_name: 'app.user_id',
          setting_value: userId,
          is_local: true
        });
      } catch (configError) {
        console.warn('Direct config also failed:', configError);
      }
    }
  }

  /**
   * Fetch all bookmarks for a user
   */
  static async getBookmarks(userId: string): Promise<DatabaseBookmark[]> {
    // Set user context for RLS
    await this.setUserContext(userId);

    const { data, error } = await supabase
      .from('bookmarks')
      .select('*')
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
    // Set user context for RLS
    await this.setUserContext(userId);

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
    // Set user context for RLS
    await this.setUserContext(userId);

    const { data, error } = await supabase
      .from('bookmarks')
      .update(updates)
      .eq('id', bookmarkId)
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
    // Set user context for RLS
    await this.setUserContext(userId);

    const { error } = await supabase
      .from('bookmarks')
      .delete()
      .eq('id', bookmarkId);

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
    // Set user context for RLS
    await this.setUserContext(userId);

    const { data, error } = await supabase
      .from('bookmarks')
      .select('*')
      .eq('chrome_bookmark_id', chromeBookmarkId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to fetch bookmark: ${error.message}`);
    }

    return data || null;
  }

  /**
   * Bulk insert bookmarks (for sync operations)
   */
  static async bulkInsertBookmarks(
    userId: string,
    bookmarks: Partial<DatabaseBookmark>[]
  ): Promise<DatabaseBookmark[]> {
    if (bookmarks.length === 0) return [];

    // Set user context for RLS
    await this.setUserContext(userId);

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

    // Set user context for RLS
    await this.setUserContext(userId);

    const { error } = await supabase
      .from('bookmarks')
      .delete()
      .in('chrome_bookmark_id', chromeBookmarkIds);

    if (error) {
      throw new Error(`Failed to remove bookmarks: ${error.message}`);
    }
  }
}