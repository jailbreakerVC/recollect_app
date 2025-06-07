import { supabase } from '../lib/supabase';
import { DatabaseBookmark } from '../types';
import { Logger } from '../utils/logger';
import { ValidationUtils } from '../utils/validation';

export class BookmarkService {
  private static async setUserContext(userId: string): Promise<void> {
    if (!ValidationUtils.validateUserId(userId)) {
      throw new Error('Invalid user ID');
    }

    Logger.debug('BookmarkService', `Setting user context for: ${userId}`);
    
    try {
      const { error } = await supabase.rpc('set_app_user_context', {
        user_id: userId
      });

      if (error) {
        Logger.warn('BookmarkService', 'User context function not available (RLS disabled)', error);
      } else {
        Logger.debug('BookmarkService', 'User context set successfully');
      }
    } catch (err) {
      Logger.warn('BookmarkService', 'User context RPC not available (RLS disabled)', err);
    }
  }

  static async debugUserContext(): Promise<any> {
    try {
      const { data, error } = await supabase.rpc('debug_user_context');
      
      if (error) {
        Logger.warn('BookmarkService', 'Debug context error', error);
        
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
      
      Logger.debug('BookmarkService', 'User context debug', data);
      return data;
    } catch (err) {
      Logger.warn('BookmarkService', 'Debug context failed', err);
      return { 
        error: 'Debug function call failed',
        rls_disabled: true,
        details: err instanceof Error ? err.message : 'Unknown error'
      };
    }
  }

  static async getBookmarks(userId: string): Promise<DatabaseBookmark[]> {
    if (!ValidationUtils.validateUserId(userId)) {
      throw new Error('Invalid user ID');
    }

    Logger.info('BookmarkService', `Fetching bookmarks for user: ${userId}`);
    
    await this.setUserContext(userId);

    const { data, error } = await supabase
      .from('bookmarks')
      .select('*')
      .eq('user_id', userId)
      .order('date_added', { ascending: false });

    if (error) {
      Logger.error('BookmarkService', 'Failed to fetch bookmarks', error);
      throw new Error(`Failed to fetch bookmarks: ${error.message}`);
    }

    const validBookmarks = (data || []).filter(ValidationUtils.isValidDatabaseBookmark);
    
    Logger.info('BookmarkService', `Fetched ${validBookmarks.length} valid bookmarks for user ${userId}`);
    return validBookmarks;
  }

  static async addBookmark(
    userId: string,
    title: string,
    url: string,
    folder?: string,
    chromeBookmarkId?: string
  ): Promise<DatabaseBookmark> {
    if (!ValidationUtils.validateUserId(userId)) {
      throw new Error('Invalid user ID');
    }

    if (!ValidationUtils.isValidBookmarkTitle(title) || !ValidationUtils.isValidUrl(url)) {
      throw new Error('Invalid bookmark data');
    }

    Logger.info('BookmarkService', 'Adding bookmark', { userId, title, url, folder, chromeBookmarkId });
    
    const bookmarkData = ValidationUtils.sanitizeBookmarkData({
      user_id: userId,
      title,
      url,
      folder,
      chrome_bookmark_id: chromeBookmarkId,
      date_added: new Date().toISOString(),
    });

    const { data, error } = await supabase
      .from('bookmarks')
      .insert(bookmarkData)
      .select()
      .single();

    if (error) {
      Logger.error('BookmarkService', 'Failed to add bookmark', {
        error,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      
      throw new Error(`Failed to add bookmark: ${error.message}`);
    }

    Logger.info('BookmarkService', `Bookmark added successfully: ${data.id}`);
    return data;
  }

  static async updateBookmark(
    bookmarkId: string,
    userId: string,
    updates: Partial<DatabaseBookmark>
  ): Promise<DatabaseBookmark> {
    if (!ValidationUtils.validateUserId(userId)) {
      throw new Error('Invalid user ID');
    }

    Logger.info('BookmarkService', 'Updating bookmark', { bookmarkId, updates });

    const sanitizedUpdates = ValidationUtils.sanitizeBookmarkData(updates);

    const { data, error } = await supabase
      .from('bookmarks')
      .update(sanitizedUpdates)
      .eq('id', bookmarkId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      Logger.error('BookmarkService', 'Failed to update bookmark', error);
      throw new Error(`Failed to update bookmark: ${error.message}`);
    }

    Logger.info('BookmarkService', 'Bookmark updated successfully');
    return data;
  }

  static async removeBookmark(bookmarkId: string, userId: string): Promise<void> {
    if (!ValidationUtils.validateUserId(userId)) {
      throw new Error('Invalid user ID');
    }

    Logger.info('BookmarkService', `Removing bookmark: ${bookmarkId}`);

    const { error } = await supabase
      .from('bookmarks')
      .delete()
      .eq('id', bookmarkId)
      .eq('user_id', userId);

    if (error) {
      Logger.error('BookmarkService', 'Failed to remove bookmark', error);
      throw new Error(`Failed to remove bookmark: ${error.message}`);
    }

    Logger.info('BookmarkService', 'Bookmark removed successfully');
  }

  static async getBookmarkByChromeId(
    chromeBookmarkId: string,
    userId: string
  ): Promise<DatabaseBookmark | null> {
    if (!ValidationUtils.validateUserId(userId)) {
      throw new Error('Invalid user ID');
    }

    Logger.debug('BookmarkService', `Looking for bookmark with Chrome ID: ${chromeBookmarkId} for user: ${userId}`);

    const { data, error } = await supabase
      .from('bookmarks')
      .select('*')
      .eq('chrome_bookmark_id', chromeBookmarkId)
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      Logger.error('BookmarkService', 'Failed to fetch bookmark by Chrome ID', error);
      throw new Error(`Failed to fetch bookmark: ${error.message}`);
    }

    Logger.debug('BookmarkService', `Bookmark by Chrome ID result: ${data ? 'Found' : 'Not found'}`);
    return data || null;
  }

  static async bulkInsertBookmarks(
    userId: string,
    bookmarks: Partial<DatabaseBookmark>[]
  ): Promise<DatabaseBookmark[]> {
    if (!ValidationUtils.validateUserId(userId)) {
      throw new Error('Invalid user ID');
    }

    if (bookmarks.length === 0) {
      Logger.info('BookmarkService', 'No bookmarks to insert');
      return [];
    }

    Logger.info('BookmarkService', `Bulk inserting ${bookmarks.length} bookmarks for user: ${userId}`);
    
    const sanitizedBookmarks = bookmarks.map(bookmark => 
      ValidationUtils.sanitizeBookmarkData({
        ...bookmark,
        user_id: userId
      })
    );

    Logger.debug('BookmarkService', 'Sample bookmarks to insert', sanitizedBookmarks.slice(0, 3));

    const { data, error } = await supabase
      .from('bookmarks')
      .insert(sanitizedBookmarks)
      .select();

    if (error) {
      Logger.error('BookmarkService', 'Failed to bulk insert bookmarks', {
        error,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      
      throw new Error(`Failed to bulk insert bookmarks: ${error.message}`);
    }

    Logger.info('BookmarkService', `Successfully inserted ${data?.length || 0} bookmarks`);
    return data || [];
  }

  static async removeBookmarksByChromeIds(
    chromeBookmarkIds: string[],
    userId: string
  ): Promise<void> {
    if (!ValidationUtils.validateUserId(userId)) {
      throw new Error('Invalid user ID');
    }

    if (chromeBookmarkIds.length === 0) {
      Logger.info('BookmarkService', 'No bookmarks to remove');
      return;
    }

    Logger.info('BookmarkService', `Removing ${chromeBookmarkIds.length} bookmarks by Chrome IDs for user: ${userId}`);
    Logger.debug('BookmarkService', 'Chrome IDs to remove', chromeBookmarkIds);

    const { error } = await supabase
      .from('bookmarks')
      .delete()
      .in('chrome_bookmark_id', chromeBookmarkIds)
      .eq('user_id', userId);

    if (error) {
      Logger.error('BookmarkService', 'Failed to remove bookmarks', error);
      throw new Error(`Failed to remove bookmarks: ${error.message}`);
    }

    Logger.info('BookmarkService', 'Bookmarks removed successfully');
  }

  static async testConnection(userId: string): Promise<{ success: boolean; message: string; debug?: any }> {
    try {
      Logger.info('BookmarkService', `Testing database connection for user: ${userId}`);
      
      // Test basic Supabase connection
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
      
      Logger.info('BookmarkService', 'Database ping successful');
      
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
      
      const debug = await this.debugUserContext();
      
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

  static async getAllBookmarksCount(): Promise<number> {
    try {
      const { count, error } = await supabase
        .from('bookmarks')
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        Logger.error('BookmarkService', 'Failed to get bookmarks count', error);
        return 0;
      }
      
      return count || 0;
    } catch (err) {
      Logger.error('BookmarkService', 'Error getting bookmarks count', err);
      return 0;
    }
  }
}