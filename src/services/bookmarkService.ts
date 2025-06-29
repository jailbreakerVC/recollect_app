import { supabase } from "../lib/supabase";
import { DatabaseBookmark } from "../types";
import { Logger } from "../utils/logger";
import { OpenAIService } from "./openaiService";

// Define validation functions directly to avoid circular imports
const validateUserId = (userId: string): boolean => {
  return typeof userId === "string" && userId.trim().length > 0;
};

const isValidBookmarkTitle = (title: string): boolean => {
  return typeof title === "string" && title.trim().length > 0;
};

const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

const isValidDatabaseBookmark = (
  bookmark: any,
): bookmark is DatabaseBookmark => {
  return (
    bookmark &&
    typeof bookmark.id === "string" &&
    typeof bookmark.user_id === "string" &&
    typeof bookmark.title === "string" &&
    typeof bookmark.url === "string" &&
    isValidUrl(bookmark.url) &&
    isValidBookmarkTitle(bookmark.title)
  );
};

const sanitizeBookmarkData = (
  bookmark: Partial<DatabaseBookmark>,
): Partial<DatabaseBookmark> => {
  return {
    ...bookmark,
    title: bookmark.title?.trim(),
    url: bookmark.url?.trim(),
    folder: bookmark.folder?.trim() || undefined,
  };
};

export class BookmarkService {
  private static async setUserContext(userId: string): Promise<void> {
    if (!validateUserId(userId)) {
      throw new Error("Invalid user ID");
    }

    Logger.debug("BookmarkService", `Setting user context for: ${userId}`);

    try {
      // Try the new function name first
      const { error } = await supabase.rpc("set_app_user_context", {
        user_id: userId,
      });

      if (error) {
        Logger.warn(
          "BookmarkService",
          "User context function not available (RLS disabled)",
          error,
        );
      } else {
        Logger.debug("BookmarkService", "User context set successfully");
      }
    } catch (err) {
      Logger.warn(
        "BookmarkService",
        "User context RPC not available (RLS disabled)",
        err,
      );
    }
  }

  static async debugUserContext(): Promise<any> {
    try {
      // Try the new function name first
      const { data, error } = await supabase.rpc("debug_user_context");

      if (error) {
        Logger.warn("BookmarkService", "Debug context error", error);

        return {
          error: "Debug function not available",
          rls_disabled: true,
          fallback_info: {
            supabase_url: !!import.meta.env.VITE_SUPABASE_URL,
            supabase_key: !!import.meta.env.VITE_SUPABASE_ANON_KEY,
            timestamp: new Date().toISOString(),
          },
        };
      }

      Logger.debug("BookmarkService", "User context debug", data);
      return data;
    } catch (err) {
      Logger.warn("BookmarkService", "Debug context failed", err);
      return {
        error: "Debug function call failed",
        rls_disabled: true,
        details: err instanceof Error ? err.message : "Unknown error",
      };
    }
  }

  static async getBookmarks(userId: string): Promise<DatabaseBookmark[]> {
    if (!validateUserId(userId)) {
      throw new Error("Invalid user ID");
    }

    Logger.info("BookmarkService", `Fetching bookmarks for user: ${userId}`);

    await this.setUserContext(userId);

    const { data, error } = await supabase
      .from("bookmarks")
      .select("*")
      .eq("user_id", userId)
      .order("date_added", { ascending: false });

    if (error) {
      Logger.error("BookmarkService", "Failed to fetch bookmarks", error);
      throw new Error(`Failed to fetch bookmarks: ${error.message}`);
    }

    const validBookmarks = (data || []).filter(isValidDatabaseBookmark);

    Logger.info(
      "BookmarkService",
      `Fetched ${validBookmarks.length} valid bookmarks for user ${userId}`,
    );
    return validBookmarks;
  }

  static async addBookmark(
    userId: string,
    title: string,
    url: string,
    folder?: string,
    chromeBookmarkId?: string,
  ): Promise<DatabaseBookmark> {
    if (!validateUserId(userId)) {
      throw new Error("Invalid user ID");
    }

    if (!isValidBookmarkTitle(title) || !isValidUrl(url)) {
      throw new Error("Invalid bookmark data");
    }

    Logger.info("BookmarkService", "Adding bookmark with duplicate prevention", {
      userId,
      title,
      url,
      folder,
      chromeBookmarkId,
    });

    try {
      // Use the upsert function to prevent duplicates
      const { data, error } = await supabase.rpc("upsert_bookmark", {
        p_user_id: userId,
        p_title: title,
        p_url: url,
        p_folder: folder || null,
        p_chrome_bookmark_id: chromeBookmarkId || null,
        p_parent_id: null,
      });

      if (error) {
        Logger.error("BookmarkService", "Failed to upsert bookmark", {
          error,
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });

        throw new Error(`Failed to add bookmark: ${error.message}`);
      }

      if (!data || data.length === 0) {
        throw new Error("No data returned from upsert operation");
      }

      const result = data[0];
      
      // Generate embedding for the bookmark if it was newly created
      if (!result.was_updated) {
        try {
          const embedding = await OpenAIService.generateEmbedding(title);
          await supabase
            .from("bookmarks")
            .update({ title_embedding: embedding })
            .eq("id", result.id);
        } catch (embeddingError) {
          Logger.warn("BookmarkService", "Failed to generate embedding", embeddingError);
          // Don't fail the whole operation for embedding issues
        }
      }

      Logger.info("BookmarkService", `Bookmark ${result.was_updated ? 'updated' : 'added'} successfully: ${result.id}`);
      
      // Return the bookmark in the expected format
      return {
        id: result.id,
        user_id: userId,
        chrome_bookmark_id: result.chrome_bookmark_id,
        title: result.title,
        url: result.url,
        folder: result.folder,
        parent_id: result.parent_id,
        date_added: result.date_added,
        created_at: result.created_at,
        updated_at: result.updated_at,
      };
    } catch (error) {
      Logger.error("BookmarkService", "Failed to add bookmark with duplicate prevention", error);
      throw error;
    }
  }

  static async checkBookmarkExists(
    userId: string,
    title?: string,
    url?: string,
    chromeBookmarkId?: string
  ): Promise<{
    exists: boolean;
    bookmarkId?: string;
    existingTitle?: string;
    existingUrl?: string;
    existingChromeId?: string;
  }> {
    if (!validateUserId(userId)) {
      throw new Error("Invalid user ID");
    }

    try {
      const { data, error } = await supabase.rpc("check_bookmark_exists", {
        p_user_id: userId,
        p_title: title || null,
        p_url: url || null,
        p_chrome_bookmark_id: chromeBookmarkId || null,
      });

      if (error) {
        Logger.error("BookmarkService", "Failed to check bookmark existence", error);
        throw new Error(`Failed to check bookmark: ${error.message}`);
      }

      if (!data || data.length === 0) {
        return { exists: false };
      }

      const result = data[0];
      return {
        exists: result.exists,
        bookmarkId: result.bookmark_id,
        existingTitle: result.existing_title,
        existingUrl: result.existing_url,
        existingChromeId: result.existing_chrome_id,
      };
    } catch (error) {
      Logger.error("BookmarkService", "Error checking bookmark existence", error);
      throw error;
    }
  }

  static async updateBookmark(
    bookmarkId: string,
    userId: string,
    updates: Partial<DatabaseBookmark>,
  ): Promise<DatabaseBookmark> {
    if (!validateUserId(userId)) {
      throw new Error("Invalid user ID");
    }

    Logger.info("BookmarkService", "Updating bookmark", {
      bookmarkId,
      updates,
    });

    try {
      const { data, error } = await supabase
        .from("bookmarks")
        .update(updates)
        .eq("id", bookmarkId)
        .eq("user_id", userId)
        .select()
        .single();

      if (error) {
        Logger.error("BookmarkService", "Failed to update bookmark", error);
        throw new Error(`Failed to update bookmark: ${error.message}`);
      }

      // If title was updated, generate new embedding
      if (updates.title) {
        try {
          const embedding = await OpenAIService.generateEmbedding(updates.title);
          await supabase
            .from("bookmarks")
            .update({ title_embedding: embedding })
            .eq("id", bookmarkId)
            .eq("user_id", userId);
        } catch (error) {
          Logger.error("BookmarkService", "Failed to generate new embedding after update", {
            bookmarkId,
            error
          });
        }
      }

      Logger.info("BookmarkService", "Bookmark updated successfully");
      return data;
    } catch (error) {
      Logger.error("BookmarkService", "Failed to update bookmark", error);
      throw error;
    }
  }

  static async removeBookmark(
    bookmarkId: string,
    userId: string,
  ): Promise<void> {
    if (!validateUserId(userId)) {
      throw new Error("Invalid user ID");
    }

    Logger.info("BookmarkService", `Removing bookmark: ${bookmarkId}`);

    const { error } = await supabase
      .from("bookmarks")
      .delete()
      .eq("id", bookmarkId)
      .eq("user_id", userId);

    if (error) {
      Logger.error("BookmarkService", "Failed to remove bookmark", error);
      throw new Error(`Failed to remove bookmark: ${error.message}`);
    }

    Logger.info("BookmarkService", "Bookmark removed successfully");
  }

  static async getBookmarkByChromeId(
    chromeBookmarkId: string,
    userId: string,
  ): Promise<DatabaseBookmark | null> {
    if (!validateUserId(userId)) {
      throw new Error("Invalid user ID");
    }

    Logger.debug(
      "BookmarkService",
      `Looking for bookmark with Chrome ID: ${chromeBookmarkId} for user: ${userId}`,
    );

    const { data, error } = await supabase
      .from("bookmarks")
      .select("*")
      .eq("chrome_bookmark_id", chromeBookmarkId)
      .eq("user_id", userId)
      .single();

    if (error && error.code !== "PGRST116") {
      Logger.error(
        "BookmarkService",
        "Failed to fetch bookmark by Chrome ID",
        error,
      );
      throw new Error(`Failed to fetch bookmark: ${error.message}`);
    }

    Logger.debug(
      "BookmarkService",
      `Bookmark by Chrome ID result: ${data ? "Found" : "Not found"}`,
    );
    return data || null;
  }

  static async bulkInsertBookmarks(
    userId: string,
    bookmarks: Partial<DatabaseBookmark>[],
  ): Promise<DatabaseBookmark[]> {
    if (!validateUserId(userId)) {
      throw new Error("Invalid user ID");
    }

    Logger.info("BookmarkService", "Bulk inserting bookmarks with duplicate prevention", {
      userId,
      count: bookmarks.length,
    });

    try {
      // Prepare bookmarks data for bulk upsert
      const bookmarksData = bookmarks.map(b => sanitizeBookmarkData({
        title: b.title,
        url: b.url,
        folder: b.folder,
        chrome_bookmark_id: b.chrome_bookmark_id,
        parent_id: b.parent_id,
      }));

      // Use the bulk upsert function
      const { data, error } = await supabase.rpc("bulk_upsert_bookmarks", {
        p_user_id: userId,
        p_bookmarks: JSON.stringify(bookmarksData),
      });

      if (error) {
        Logger.error("BookmarkService", "Failed to bulk upsert bookmarks", {
          error,
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });

        throw new Error(`Failed to bulk insert bookmarks: ${error.message}`);
      }

      if (!data || data.length === 0) {
        throw new Error("No data returned from bulk upsert operation");
      }

      const result = data[0];
      
      Logger.info("BookmarkService", `Bulk upsert completed: ${result.total_processed} processed, ${result.inserted_count} inserted, ${result.updated_count} updated, ${result.skipped_count} skipped`);

      // Fetch the actual bookmarks that were inserted/updated
      const { data: insertedBookmarks, error: fetchError } = await supabase
        .from("bookmarks")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(result.total_processed);

      if (fetchError) {
        Logger.error("BookmarkService", "Failed to fetch inserted bookmarks", fetchError);
        throw new Error(`Failed to fetch inserted bookmarks: ${fetchError.message}`);
      }

      return insertedBookmarks || [];
    } catch (error) {
      Logger.error("BookmarkService", "Failed to bulk insert bookmarks", error);
      throw error;
    }
  }

  static async removeBookmarksByChromeIds(
    chromeBookmarkIds: string[],
    userId: string,
  ): Promise<void> {
    if (!validateUserId(userId)) {
      throw new Error("Invalid user ID");
    }

    if (chromeBookmarkIds.length === 0) {
      Logger.info("BookmarkService", "No bookmarks to remove");
      return;
    }

    Logger.info(
      "BookmarkService",
      `Removing ${chromeBookmarkIds.length} bookmarks by Chrome IDs for user: ${userId}`,
    );
    Logger.debug("BookmarkService", "Chrome IDs to remove", chromeBookmarkIds);

    const { error } = await supabase
      .from("bookmarks")
      .delete()
      .in("chrome_bookmark_id", chromeBookmarkIds)
      .eq("user_id", userId);

    if (error) {
      Logger.error("BookmarkService", "Failed to remove bookmarks", error);
      throw new Error(`Failed to remove bookmarks: ${error.message}`);
    }

    Logger.info("BookmarkService", "Bookmarks removed successfully");
  }

  static async testConnection(
    userId: string,
  ): Promise<{ success: boolean; message: string; debug?: any }> {
    try {
      Logger.info(
        "BookmarkService",
        `Testing database connection for user: ${userId}`,
      );

      // Test basic Supabase connection
      const { error: pingError } = await supabase
        .from("bookmarks")
        .select("count", { count: "exact", head: true })
        .limit(0);

      if (pingError) {
        return {
          success: false,
          message: `Database ping failed: ${pingError.message}`,
        };
      }

      Logger.info("BookmarkService", "Database ping successful");

      // Test user-specific query
      const { data, error } = await supabase
        .from("bookmarks")
        .select("count", { count: "exact", head: true })
        .eq("user_id", userId);

      if (error) {
        return {
          success: false,
          message: `User query failed: ${error.message}`,
        };
      }

      const debug = await this.debugUserContext();

      return {
        success: true,
        message: `Database connection successful. Found bookmarks for user ${userId}`,
        debug,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return {
        success: false,
        message: `Connection test failed: ${message}`,
      };
    }
  }

  static async testBasicConnection(): Promise<boolean> {
    try {
      const { error } = await supabase
        .from("bookmarks")
        .select("count", { count: "exact", head: true })
        .limit(0);

      return !error;
    } catch {
      return false;
    }
  }

  static async getAllBookmarksCount(): Promise<number> {
    try {
      const { count, error } = await supabase
        .from("bookmarks")
        .select("*", { count: "exact", head: true });

      if (error) {
        Logger.error("BookmarkService", "Failed to get bookmarks count", error);
        return 0;
      }

      return count || 0;
    } catch (err) {
      Logger.error("BookmarkService", "Error getting bookmarks count", err);
      return 0;
    }
  }

  // Add method to get embedding statistics
  static async getEmbeddingStats(userId: string): Promise<{
    totalBookmarks: number;
    bookmarksWithEmbeddings: number;
    needsEmbeddings: number;
  }> {
    if (!validateUserId(userId)) {
      throw new Error("Invalid user ID");
    }

    try {
      // Get all bookmarks for the user
      const { data: allBookmarks, error: allError } = await supabase
        .from("bookmarks")
        .select("id, title_embedding")
        .eq("user_id", userId);

      if (allError) {
        throw new Error(`Failed to fetch bookmarks: ${allError.message}`);
      }

      const totalBookmarks = allBookmarks?.length || 0;

      // Count bookmarks with embeddings (non-null title_embedding)
      const bookmarksWithEmbeddings =
        allBookmarks?.filter((b) => b.title_embedding !== null).length || 0;

      const needsEmbeddings = totalBookmarks - bookmarksWithEmbeddings;

      Logger.info("BookmarkService", `Embedding stats for user ${userId}:`, {
        totalBookmarks,
        bookmarksWithEmbeddings,
        needsEmbeddings,
      });

      return {
        totalBookmarks,
        bookmarksWithEmbeddings,
        needsEmbeddings,
      };
    } catch (err) {
      Logger.error("BookmarkService", "Failed to get embedding stats", err);
      throw err;
    }
  }
}