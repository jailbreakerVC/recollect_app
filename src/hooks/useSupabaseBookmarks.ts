import { useState, useEffect, useCallback } from 'react';
import { supabase, DatabaseBookmark, setAuthContext } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface ExtensionBookmark {
  id: string;
  title: string;
  url: string;
  dateAdded: string;
  folder?: string;
  parentId?: string;
}

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

  console.log('🔄 useSupabaseBookmarks hook initialized:', {
    user: user ? { id: user.id, name: user.name } : null,
    bookmarksCount: bookmarks.length,
    loading: loading,
    error: error,
    extensionAvailable: extensionAvailable
  });

  // Check if extension is available
  useEffect(() => {
    console.log('🔍 Checking Chrome extension availability...');
    
    const checkExtension = () => {
      const available = !!(window as any).bookmarkExtensionAvailable;
      console.log('📱 Extension availability check:', {
        available: available,
        windowProperty: (window as any).bookmarkExtensionAvailable,
        timestamp: new Date().toISOString()
      });
      setExtensionAvailable(available);
    };

    checkExtension();

    const handleExtensionReady = () => {
      console.log('✅ Chrome extension ready event received');
      setExtensionAvailable(true);
    };

    window.addEventListener('bookmarkExtensionReady', handleExtensionReady);
    return () => {
      console.log('🧹 Cleaning up extension event listener');
      window.removeEventListener('bookmarkExtensionReady', handleExtensionReady);
    };
  }, []);

  // Set auth context when user changes
  useEffect(() => {
    if (user?.id) {
      console.log('👤 User changed, setting auth context:', {
        userId: user.id,
        userName: user.name,
        userEmail: user.email
      });
      
      setAuthContext(user.id).then(({ data, error }) => {
        if (error) {
          console.error('❌ Failed to set auth context:', error);
        } else {
          console.log('✅ Auth context set for user:', user.id);
        }
      });
    } else {
      console.log('👤 No user, skipping auth context setup');
    }
  }, [user?.id]);

  // Load bookmarks from Supabase
  const loadBookmarks = useCallback(async () => {
    if (!user) {
      console.log('👤 No user, skipping bookmark load');
      return;
    }

    console.log('📚 Starting bookmark load for user:', user.id);
    setLoading(true);
    setError(null);

    try {
      console.log('🔑 Setting auth context before query...');
      const authResult = await setAuthContext(user.id);
      
      if (authResult.error) {
        console.warn('⚠️ Auth context setup had issues, continuing anyway:', authResult.error);
      }
      
      console.log('📊 Executing Supabase query:', {
        table: 'bookmarks',
        filter: `user_id = ${user.id}`,
        orderBy: 'date_added DESC'
      });
      
      const queryStart = performance.now();
      const { data, error: supabaseError, count } = await supabase
        .from('bookmarks')
        .select('*', { count: 'exact' })
        .eq('user_id', user.id)
        .order('date_added', { ascending: false });
      
      const queryEnd = performance.now();
      
      console.log('📊 Supabase query completed:', {
        duration: `${(queryEnd - queryStart).toFixed(2)}ms`,
        success: !supabaseError,
        dataLength: data?.length || 0,
        count: count,
        error: supabaseError
      });

      if (supabaseError) {
        console.error('❌ Supabase query error:', {
          error: supabaseError,
          message: supabaseError.message,
          details: supabaseError.details,
          hint: supabaseError.hint,
          code: supabaseError.code,
          userId: user.id
        });
        throw supabaseError;
      }
      
      console.log('✅ Bookmarks loaded successfully:', {
        count: data?.length || 0,
        bookmarks: data?.map(b => ({ id: b.id, title: b.title, url: b.url })) || [],
        timestamp: new Date().toISOString()
      });
      
      setBookmarks(data || []);
    } catch (err) {
      console.error('❌ Error in loadBookmarks:', {
        error: err,
        message: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : undefined,
        userId: user.id
      });
      
      setError(err instanceof Error ? err.message : 'Failed to load bookmarks');
    } finally {
      setLoading(false);
      console.log('📚 Bookmark load completed');
    }
  }, [user]);

  // Load bookmarks when user changes
  useEffect(() => {
    if (user) {
      console.log('👤 User available, triggering bookmark load');
      loadBookmarks();
    } else {
      console.log('👤 No user, clearing bookmarks');
      setBookmarks([]);
    }
  }, [loadBookmarks, user]);

  const sendMessageToExtension = useCallback((payload: any): Promise<any> => {
    console.log('📤 Sending message to extension:', {
      payload: payload,
      extensionAvailable: extensionAvailable,
      timestamp: new Date().toISOString()
    });
    
    return new Promise((resolve, reject) => {
      if (!extensionAvailable) {
        console.error('❌ Extension not available for message');
        reject(new Error('Extension not available'));
        return;
      }

      const requestId = Math.random().toString(36).substr(2, 9);
      console.log('📤 Generated request ID:', requestId);
      
      const handleResponse = (event: MessageEvent) => {
        if (
          event.data.source === 'bookmark-manager-extension' &&
          event.data.requestId === requestId
        ) {
          console.log('📨 Extension response received:', {
            requestId: requestId,
            response: event.data.response,
            timestamp: new Date().toISOString()
          });
          
          window.removeEventListener('message', handleResponse);
          
          if (event.data.response.success) {
            console.log('✅ Extension request successful');
            resolve(event.data.response);
          } else {
            console.error('❌ Extension request failed:', event.data.response);
            reject(new Error(event.data.response.error || 'Extension request failed'));
          }
        }
      };

      window.addEventListener('message', handleResponse);

      console.log('📤 Posting message to window');
      window.postMessage({
        source: 'bookmark-manager-webapp',
        requestId,
        payload
      }, window.location.origin);

      setTimeout(() => {
        console.error('⏰ Extension request timeout for ID:', requestId);
        window.removeEventListener('message', handleResponse);
        reject(new Error('Extension request timeout'));
      }, 5000);
    });
  }, [extensionAvailable]);

  const syncWithExtension = useCallback(async () => {
    if (!extensionAvailable || !user) {
      console.log('⏭️ Skipping extension sync:', {
        extensionAvailable: extensionAvailable,
        user: !!user
      });
      return;
    }

    console.log('🔄 Starting sync with Chrome extension...');
    setLoading(true);
    setError(null);

    try {
      console.log('🔑 Setting auth context before sync...');
      await setAuthContext(user.id);
      
      console.log('📤 Requesting bookmarks from Chrome extension...');
      const response = await sendMessageToExtension({ action: 'getBookmarks' });
      const extensionBookmarks: ExtensionBookmark[] = response.bookmarks || [];
      
      console.log('📚 Chrome bookmarks received:', {
        count: extensionBookmarks.length,
        bookmarks: extensionBookmarks.map(b => ({ id: b.id, title: b.title, url: b.url }))
      });

      console.log('📊 Fetching existing bookmarks from database...');
      const { data: existingBookmarks, error: fetchError } = await supabase
        .from('bookmarks')
        .select('*')
        .eq('user_id', user.id);

      if (fetchError) {
        console.error('❌ Error fetching existing bookmarks:', fetchError);
        throw fetchError;
      }

      console.log('📊 Existing bookmarks in database:', {
        count: existingBookmarks?.length || 0,
        bookmarks: existingBookmarks?.map(b => ({ id: b.id, chrome_id: b.chrome_bookmark_id, title: b.title })) || []
      });

      const existingMap = new Map(
        (existingBookmarks || []).map(b => [b.chrome_bookmark_id, b])
      );

      // Prepare bookmarks to insert/update
      const bookmarksToInsert: Partial<DatabaseBookmark>[] = [];
      const bookmarksToUpdate: { id: string; updates: Partial<DatabaseBookmark> }[] = [];

      console.log('🔍 Analyzing bookmark differences...');
      
      for (const extBookmark of extensionBookmarks) {
        const existing = existingMap.get(extBookmark.id);
        
        const bookmarkData: Partial<DatabaseBookmark> = {
          user_id: user.id,
          chrome_bookmark_id: extBookmark.id,
          title: extBookmark.title,
          url: extBookmark.url,
          folder: extBookmark.folder,
          parent_id: extBookmark.parentId,
          date_added: extBookmark.dateAdded,
        };

        if (existing) {
          // Update existing bookmark if data has changed
          if (
            existing.title !== extBookmark.title ||
            existing.url !== extBookmark.url ||
            existing.folder !== extBookmark.folder
          ) {
            console.log('📝 Bookmark needs update:', {
              id: existing.id,
              chrome_id: extBookmark.id,
              changes: {
                title: existing.title !== extBookmark.title ? { old: existing.title, new: extBookmark.title } : null,
                url: existing.url !== extBookmark.url ? { old: existing.url, new: extBookmark.url } : null,
                folder: existing.folder !== extBookmark.folder ? { old: existing.folder, new: extBookmark.folder } : null
              }
            });
            
            bookmarksToUpdate.push({
              id: existing.id,
              updates: {
                title: extBookmark.title,
                url: extBookmark.url,
                folder: extBookmark.folder,
                parent_id: extBookmark.parentId,
              }
            });
          }
        } else {
          console.log('➕ New bookmark to insert:', {
            chrome_id: extBookmark.id,
            title: extBookmark.title,
            url: extBookmark.url
          });
          bookmarksToInsert.push(bookmarkData);
        }
      }

      // Insert new bookmarks
      if (bookmarksToInsert.length > 0) {
        console.log(`➕ Inserting ${bookmarksToInsert.length} new bookmarks...`);
        
        const { data: insertedData, error: insertError } = await supabase
          .from('bookmarks')
          .insert(bookmarksToInsert)
          .select();

        if (insertError) {
          console.error('❌ Insert error:', {
            error: insertError,
            bookmarksToInsert: bookmarksToInsert
          });
          throw insertError;
        }
        
        console.log('✅ Bookmarks inserted successfully:', {
          count: insertedData?.length || 0,
          inserted: insertedData?.map(b => ({ id: b.id, title: b.title })) || []
        });
      }

      // Update existing bookmarks
      for (const { id, updates } of bookmarksToUpdate) {
        console.log(`📝 Updating bookmark ${id}:`, updates);
        
        const { error: updateError } = await supabase
          .from('bookmarks')
          .update(updates)
          .eq('id', id);

        if (updateError) {
          console.error('❌ Update error:', {
            error: updateError,
            bookmarkId: id,
            updates: updates
          });
          throw updateError;
        }
      }

      if (bookmarksToUpdate.length > 0) {
        console.log(`✅ Updated ${bookmarksToUpdate.length} existing bookmarks`);
      }

      // Remove bookmarks that no longer exist in Chrome
      const extensionBookmarkIds = new Set(extensionBookmarks.map(b => b.id));
      const bookmarksToDelete = (existingBookmarks || [])
        .filter(b => b.chrome_bookmark_id && !extensionBookmarkIds.has(b.chrome_bookmark_id))
        .map(b => b.id);

      if (bookmarksToDelete.length > 0) {
        console.log(`🗑️ Deleting ${bookmarksToDelete.length} bookmarks that no longer exist in Chrome:`, bookmarksToDelete);
        
        const { error: deleteError } = await supabase
          .from('bookmarks')
          .delete()
          .in('id', bookmarksToDelete);

        if (deleteError) {
          console.error('❌ Delete error:', {
            error: deleteError,
            bookmarksToDelete: bookmarksToDelete
          });
          throw deleteError;
        }
        
        console.log('✅ Bookmarks deleted successfully');
      }

      // Reload bookmarks
      console.log('🔄 Reloading bookmarks after sync...');
      await loadBookmarks();
      console.log('✅ Sync completed successfully');
      
    } catch (err) {
      console.error('❌ Sync error:', {
        error: err,
        message: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : undefined
      });
      setError(err instanceof Error ? err.message : 'Failed to sync bookmarks');
    } finally {
      setLoading(false);
      console.log('🔄 Sync process completed');
    }
  }, [extensionAvailable, user, sendMessageToExtension, loadBookmarks]);

  const addBookmark = useCallback(async (title: string, url: string, folder?: string) => {
    if (!user) {
      console.error('❌ Cannot add bookmark: no user');
      return;
    }

    console.log('➕ Adding bookmark:', {
      title: title,
      url: url,
      folder: folder,
      userId: user.id
    });

    try {
      console.log('🔑 Setting auth context before add...');
      await setAuthContext(user.id);
      
      const bookmarkData = {
        user_id: user.id,
        title,
        url,
        folder,
        date_added: new Date().toISOString(),
      };
      
      console.log('📊 Inserting bookmark into database:', bookmarkData);
      
      const { data, error } = await supabase
        .from('bookmarks')
        .insert(bookmarkData)
        .select()
        .single();

      if (error) {
        console.error('❌ Database insert error:', {
          error: error,
          bookmarkData: bookmarkData
        });
        throw error;
      }
      
      console.log('✅ Bookmark added to database:', data);

      // Also add to Chrome if extension is available
      if (extensionAvailable) {
        try {
          console.log('📤 Adding bookmark to Chrome extension...');
          await sendMessageToExtension({
            action: 'addBookmark',
            title,
            url,
          });
          console.log('✅ Bookmark also added to Chrome');
        } catch (extError) {
          console.warn('⚠️ Failed to add bookmark to Chrome:', extError);
        }
      }

      // Reload bookmarks to show the new one
      await loadBookmarks();
    } catch (err) {
      console.error('❌ Add bookmark error:', {
        error: err,
        message: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : undefined,
        title: title,
        url: url,
        folder: folder
      });
      throw new Error(err instanceof Error ? err.message : 'Failed to add bookmark');
    }
  }, [user, extensionAvailable, sendMessageToExtension, loadBookmarks]);

  const removeBookmark = useCallback(async (id: string) => {
    if (!user) {
      console.error('❌ Cannot remove bookmark: no user');
      return;
    }

    console.log('🗑️ Removing bookmark:', {
      bookmarkId: id,
      userId: user.id
    });

    try {
      console.log('🔑 Setting auth context before remove...');
      await setAuthContext(user.id);
      
      console.log('📊 Fetching bookmark details before removal...');
      const { data: bookmark, error: fetchError } = await supabase
        .from('bookmarks')
        .select('chrome_bookmark_id')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (fetchError) {
        console.error('❌ Error fetching bookmark for removal:', fetchError);
        throw fetchError;
      }
      
      console.log('📊 Bookmark details:', bookmark);

      console.log('🗑️ Removing bookmark from database...');
      const { error } = await supabase
        .from('bookmarks')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) {
        console.error('❌ Database delete error:', {
          error: error,
          bookmarkId: id,
          userId: user.id
        });
        throw error;
      }
      
      console.log('✅ Bookmark removed from database');

      // Also remove from Chrome if extension is available and bookmark has chrome_bookmark_id
      if (extensionAvailable && bookmark?.chrome_bookmark_id) {
        try {
          console.log('📤 Removing bookmark from Chrome extension:', bookmark.chrome_bookmark_id);
          await sendMessageToExtension({
            action: 'removeBookmark',
            id: bookmark.chrome_bookmark_id,
          });
          console.log('✅ Bookmark also removed from Chrome');
        } catch (extError) {
          console.warn('⚠️ Failed to remove bookmark from Chrome:', extError);
        }
      }

      // Reload bookmarks to reflect the removal
      await loadBookmarks();
    } catch (err) {
      console.error('❌ Remove bookmark error:', {
        error: err,
        message: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : undefined,
        bookmarkId: id
      });
      throw new Error(err instanceof Error ? err.message : 'Failed to remove bookmark');
    }
  }, [user, extensionAvailable, sendMessageToExtension, loadBookmarks]);

  const updateBookmark = useCallback(async (id: string, updates: Partial<DatabaseBookmark>) => {
    if (!user) {
      console.error('❌ Cannot update bookmark: no user');
      return;
    }

    console.log('📝 Updating bookmark:', {
      bookmarkId: id,
      updates: updates,
      userId: user.id
    });

    try {
      console.log('🔑 Setting auth context before update...');
      await setAuthContext(user.id);
      
      console.log('📊 Executing update query...');
      const { data, error } = await supabase
        .from('bookmarks')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) {
        console.error('❌ Database update error:', {
          error: error,
          bookmarkId: id,
          updates: updates,
          userId: user.id
        });
        throw error;
      }
      
      console.log('✅ Bookmark updated successfully:', data);

      // Reload bookmarks to reflect the update
      await loadBookmarks();
    } catch (err) {
      console.error('❌ Update bookmark error:', {
        error: err,
        message: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : undefined,
        bookmarkId: id,
        updates: updates
      });
      throw new Error(err instanceof Error ? err.message : 'Failed to update bookmark');
    }
  }, [user, loadBookmarks]);

  // Manual refresh function
  const refreshBookmarks = useCallback(async () => {
    console.log('🔄 Manual refresh requested');
    setError(null);
    await loadBookmarks();
  }, [loadBookmarks]);

  console.log('📊 useSupabaseBookmarks hook state:', {
    bookmarksCount: bookmarks.length,
    loading: loading,
    error: error,
    extensionAvailable: extensionAvailable,
    user: user ? { id: user.id, name: user.name } : null,
    timestamp: new Date().toISOString()
  });

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