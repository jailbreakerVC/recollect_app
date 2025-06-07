import { supabase, DatabaseBookmark } from '../lib/supabase';

export class BookmarkService {
  /**
   * Set user context for RLS policies with improved error handling
   */
  private static async setUserContext(userId: string): Promise<void> {
    console.log('🔐 Setting user context for:', userId);
    
    // Since RLS is disabled, we don't need to set context, but we'll keep this for future use
    try {
      const { error } = await supabase.rpc('set_app_user_context', {
        user_id: userId
      });

      if (error) {
        console.warn('User context function not available (RLS disabled):', error.message);
      } else {
        console.log('✅ User context set successfully');
      }
    } catch (err) {
      console.warn('User context RPC not available (RLS disabled):', err);
    }
  }

  /**
   * Debug user context - helpful for troubleshooting
   */
  static async debugUserContext(): Promise<any> {
    try {
      const { data, error } = await supabase.rpc('debug_user_context');
      
      if (error) {
        console.warn('Debug context error:', error);
        
        // Return basic debug info if function doesn't exist
        return {
          error: 'Debug function not available',
          rls_disabled: true,
          fallback_info: {
            supabase_url: !!import.meta.env.VITE_SUPABASE_URL,
            supabase_key: !!import.meta.env.VITE_SUPABASE_ANON_KEY,
            timestamp: new Date().toISOString()
          }
        };
      }
      
      console.log('🔍 User context debug:', data);
      return data;
    } catch (err) {
      console.warn('Debug context failed:', err);
      return { 
        error: 'Debug function call failed',
        rls_disabled: true,
        details: err instanceof Error ? err.message : 'Unknown error'
      };
    }
  }

  /**
   * Fetch all bookmarks for a user with enhanced debugging
   */
  static async getBookmarks(userId: string): Promise<DatabaseBookmark[]> {
    console.log('📚 Fetching bookmarks for user:', userId);
    
    // Set user context (even though RLS is disabled, for future compatibility)
    await this.setUserContext(userId);

    // Since RLS is disabled, we need to filter by user_id manually
    const { data, error } = await supabase
      .from('bookmarks')
      .select('*')
      .eq('user_id', userId)
      .order('date_added', { ascending: false });

    if (error) {
      console.error('❌ Failed to fetch bookmarks:', error);
      throw new Error(`Failed to fetch bookmarks: ${error.message}`);
    }

    console.log(`✅ Fetched ${data?.length || 0} bookmarks for user ${userId}`);
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
    console.log('➕ Adding bookmark:', { userId, title, url, folder, chromeBookmarkId });
    
    const bookmarkData = {
      user_id: userId,
      title,
      url,
      folder,
      chrome_bookmark_id: chromeBookmarkId,
      date_added: new Date().toISOString(),
    };

    console.log('📝 Inserting bookmark data:', bookmarkData);

    const { data, error } = await supabase
      .from('bookmarks')
      .insert(bookmarkData)
      .select()
      .single();

    if (error) {
      console.error('❌ Failed to add bookmark:', error);
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      
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

    const { data, error } = await supabase
      .from('bookmarks')
      .update(updates)
      .eq('id', bookmarkId)
      .eq('user_id', userId) // Extra safety even with RLS disabled
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

    const { error } = await supabase
      .from('bookmarks')
      .delete()
      .eq('id', bookmarkId)
      .eq('user_id', userId); // Extra safety even with RLS disabled

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
    console.log('🔍 Looking for bookmark with Chrome ID:', chromeBookmarkId, 'for user:', userId);

    const { data, error } = await supabase
      .from('bookmarks')
      .select('*')
      .eq('chrome_bookmark_id', chromeBookmarkId)
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('❌ Failed to fetch bookmark by Chrome ID:', error);
      throw new Error(`Failed to fetch bookmark: ${error.message}`);
    }

    console.log('🔍 Bookmark by Chrome ID result:', data ? 'Found' : 'Not found');
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

    console.log(`📦 Bulk inserting ${bookmarks.length} bookmarks for user:`, userId);
    
    // Ensure all bookmarks have the correct user_id
    const bookmarksWithUserId = bookmarks.map(bookmark => ({
      ...bookmark,
      user_id: userId // Ensure user_id is set correctly
    }));

    // Log the first few bookmarks for debugging
    console.log('Sample bookmarks to insert:', bookmarksWithUserId.slice(0, 3));

    const { data, error } = await supabase
      .from('bookmarks')
      .insert(bookmarksWithUserId)
      .select();

    if (error) {
      console.error('❌ Failed to bulk insert bookmarks:', error);
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      
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

    console.log(`🗑️ Removing ${chromeBookmarkIds.length} bookmarks by Chrome IDs for user:`, userId);
    console.log('Chrome IDs to remove:', chromeBookmarkIds);

    const { error } = await supabase
      .from('bookmarks')
      .delete()
      .in('chrome_bookmark_id', chromeBookmarkIds)
      .eq('user_id', userId); // Extra safety even with RLS disabled

    if (error) {
      console.error('❌ Failed to remove bookmarks:', error);
      throw new Error(`Failed to remove bookmarks: ${error.message}`);
    }

    console.log('✅ Bookmarks removed successfully');
  }

  /**
   * Test database connection and user context
   */
  static async testConnection(userId: string): Promise<{ success: boolean; message: string; debug?: any }> {
    try {
      console.log('🧪 Testing database connection for user:', userId);
      
      // Test basic Supabase connection first
      const { error: pingError } = await supabase
        .from('bookmarks')
        .select('count', { count: 'exact', head: true })
        .limit(0);
      
      if (pingError) {
        return {
          success: false,
          message: `Database ping failed: ${pingError.message}`
        };
      }
      
      console.log('✅ Database ping successful');
      
      // Test user-specific query
      const { data, error } = await supabase
        .from('bookmarks')
        .select('count', { count: 'exact', head: true })
        .eq('user_id', userId);
      
      if (error) {
        return {
          success: false,
          message: `User query failed: ${error.message}`
        };
      }
      
      // Get debug info
      const debug = await this.debugUserContext();
      console.log('Connection test debug:', debug);
      
      return {
        success: true,
        message: `Database connection successful. Found bookmarks for user ${userId}`,
        debug
      };
      
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return {
        success: false,
        message: `Connection test failed: ${message}`
      };
    }
  }

  /**
   * Simple test to verify database is accessible
   */
  static async testBasicConnection(): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('bookmarks')
        .select('count', { count: 'exact', head: true })
        .limit(0);
      
      return !error;
    } catch {
      return false;
    }
  }

  /**
   * Get all bookmarks count for debugging
   */
  static async getAllBookmarksCount(): Promise<number> {
    try {
      const { count, error } = await supabase
        .from('bookmarks')
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        console.error('Failed to get bookmarks count:', error);
        return 0;
      }
      
      return count || 0;
    } catch (err) {
      console.error('Error getting bookmarks count:', err);
      return 0;
    }
  }

  /**
   * Get all bookmarks from database (for debugging)
   */
  static async getAllBookmarks(): Promise<DatabaseBookmark[]> {
    try {
      console.log('🔍 Fetching ALL bookmarks from database for debugging...');
      
      const { data, error } = await supabase
        .from('bookmarks')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Failed to fetch all bookmarks:', error);
        throw new Error(`Failed to fetch all bookmarks: ${error.message}`);
      }

      console.log(`✅ Fetched ${data?.length || 0} total bookmarks from database`);
      return data || [];
    } catch (err) {
      console.error('Error getting all bookmarks:', err);
      return [];
    }
  }
}