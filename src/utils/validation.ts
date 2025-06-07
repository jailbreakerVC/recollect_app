import { ExtensionBookmark, DatabaseBookmark } from '../types';

export class ValidationUtils {
  static isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  static isValidBookmarkTitle(title: string): boolean {
    return typeof title === 'string' && title.trim().length > 0;
  }

  static isValidExtensionBookmark(bookmark: any): bookmark is ExtensionBookmark {
    return (
      bookmark &&
      typeof bookmark.id === 'string' &&
      typeof bookmark.title === 'string' &&
      typeof bookmark.url === 'string' &&
      typeof bookmark.dateAdded === 'string' &&
      this.isValidUrl(bookmark.url) &&
      this.isValidBookmarkTitle(bookmark.title)
    );
  }

  static isValidDatabaseBookmark(bookmark: any): bookmark is DatabaseBookmark {
    return (
      bookmark &&
      typeof bookmark.id === 'string' &&
      typeof bookmark.user_id === 'string' &&
      typeof bookmark.title === 'string' &&
      typeof bookmark.url === 'string' &&
      this.isValidUrl(bookmark.url) &&
      this.isValidBookmarkTitle(bookmark.title)
    );
  }

  static sanitizeBookmarkData(bookmark: Partial<DatabaseBookmark>): Partial<DatabaseBookmark> {
    return {
      ...bookmark,
      title: bookmark.title?.trim(),
      url: bookmark.url?.trim(),
      folder: bookmark.folder?.trim() || undefined,
    };
  }

  static validateUserId(userId: string): boolean {
    return typeof userId === 'string' && userId.trim().length > 0;
  }
}