import { supabase, DatabaseBookmark } from '../lib/supabase';

export class BookmarkService {
  /**
   * Set user context for RLS policies with improved error handling
   */
  private static async setUserContext(userId: string): Promise<void> {
    console.log('🔐 Setting user context for:', userId);
    
    try {
      // Use our new improved user context function
      const { error } = await supabase.rpc('set_app_user_context', {
        user_id: userId
      });

      if (error) {
        console.warn('Failed to set user context via RPC:', error.message);
        
        // Fallback: try the old method
        try {
          await supabase.rpc('set_user_context', { user_id: userId });
          console.log('✅ User context set via fallback method');
        } catch (fallbackError) {
          console.warn('Fallback user context also failed:', fallbackError);
        }
      } else {
        console.log('✅ User context set successfully');
      }
    } catch (err) {
      console.warn('User context RPC not available:', err);
      
      // Last resort: try direct config setting
      try {
        await supabase.rpc('set_config', {
          setting_name: 'app.current_user_id',
          setting_value: userId,
          is_local: true
        });
        console.log('✅ User context set via direct config');
      } catch (configError) {
        console.warn('All user context methods failed:', configError);
      }
    }
  }

  /**
   * Debug user context - helpful for troubleshooting
   */
  static async debugUserContext(): Promise<any> {
    try {
      const { data, error } = await supabase.rpc('debug_user_context');
      
      if (error) {
        console.error('Debug context error:', error);
        return { error: error.message };
      }
      
      console.log('🔍 User context debug:', data);
      return data;
    } catch (err) {
      console.error('Debug context failed:', err);
      return { error: 'Debug function not available' };
    }
  }

  /**
   * Fetch all bookmarks for a user with enhanced debugging
   */
  static async getBookmarks(userId: string): Promise<DatabaseBookmark[]> {
    console.log('📚 Fetching bookmarks for user:', userId);
    
    // Set user context for RLS
    await this.setUserContext(userId);
    
    // Debug context in development
    if (process.env.NODE_ENV === 'development') {
      await this.debugUserContext();
    }

    const { data, error } = await supabase
      .from('bookmarks')
      .select('*')
      .order('date_added', { ascending: false });

    if (error) {
      console.error('❌ Failed to fetch bookmarks:', error);
      throw new Error(`Failed to fetch bookmarks: ${error.message}`);
    }

    console.log(`✅ Fetched ${data?.length || 0} bookmarks`);
    return data || [];
  }

  /**
   * Add a new bookmark with enhanced error handling
   */
  static async addBookmark(
    userId: string,
    title: string,
    url: string,
    folder?: string,
    chromeBookmarkId?: string
  ): Promise<DatabaseBookmark> {
    console.log('➕ Adding bookmark:', { title, url, folder, chromeBookmarkId });
    
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
      console.error('❌ Failed to add bookmark:', error);
      
      // Debug context on error
      if (process.env.NODE_ENV === 'development') {
        await this.debugUserContext();
      }
      
      throw new Error(`Failed to add bookmark: ${error.message}`);
    }

    console.log('✅ Bookmark added successfully:', data.id);
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
    console.log('📝 Updating bookmark:', bookmarkId, updates);
    
    // Set user context for RLS
    await this.setUserContext(userId);

    const { data, error } = await supabase
      .from('bookmarks')
      .update(updates)
      .eq('id', bookmarkId)
      .select()
      .single();

    if (error) {
      console.error('❌ Failed to update bookmark:', error);
      throw new Error(`Failed to update bookmark: ${error.message}`);
    }

    console.log('✅ Bookmark updated successfully');
    return data;
  }

  /**
   * Remove a bookmark
   */
  static async removeBookmark(bookmarkId: string, userId: string): Promise<void> {
    console.log('🗑️ Removing bookmark:', bookmarkId);
    
    // Set user context for RLS
    await this.setUserContext(userId);

    const { error } = await supabase
      .from('bookmarks')
      .delete()
      .eq('id', bookmarkId);

    if (error) {
      console.error('❌ Failed to remove bookmark:', error);
      throw new Error(`Failed to remove bookmark: ${error.message}`);
    }

    console.log('✅ Bookmark removed successfully');
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
   * Bulk insert bookmarks (for sync operations) with enhanced logging
   */
  static async bulkInsertBookmarks(
    userId: string,
    bookmarks: Partial<DatabaseBookmark>[]
  ): Promise<DatabaseBookmark[]> {
    if (bookmarks.length === 0) {
      console.log('📦 No bookmarks to insert');
      return [];
    }

    console.log(`📦 Bulk inserting ${bookmarks.length} bookmarks`);
    
    // Set user context for RLS
    await this.setUserContext(userId);

    // Debug context before bulk insert
    if (process.env.NODE_ENV === 'development') {
      await this.debugUserContext();
    }

    const { data, error } = await supabase
      .from('bookmarks')
      .insert(bookmarks)
      .select();

    if (error) {
      console.error('❌ Failed to bulk insert bookmarks:', error);
      
      // Debug context on error
      if (process.env.NODE_ENV === 'development') {
        await this.debugUserContext();
      }
      
      throw new Error(`Failed to bulk insert bookmarks: ${error.message}`);
    }

    console.log(`✅ Successfully inserted ${data?.length || 0} bookmarks`);
    return data || [];
  }

  /**
   * Remove bookmarks by Chrome bookmark IDs (for sync cleanup)
   */
  static async removeBookmarksByChromeIds(
    chromeBookmarkIds: string[],
    userId: string
  ): Promise<void> {
    if (chromeBookmarkIds.length === 0) {
      console.log('🗑️ No bookmarks to remove');
      return;
    }

    console.log(`🗑️ Removing ${chromeBookmarkIds.length} bookmarks by Chrome IDs`);
    
    // Set user context for RLS
    await this.setUserContext(userId);

    const { error } = await supabase
      .from('bookmarks')
      .delete()
      .in('chrome_bookmark_id', chromeBookmarkIds);

    if (error) {
      console.error('❌ Failed to remove bookmarks:', error);
      throw new Error(`Failed to remove bookmarks: ${error.message}`);
    }

    console.log('✅ Bookmarks removed successfully');
  }
}