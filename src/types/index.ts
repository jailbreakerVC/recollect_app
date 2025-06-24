export interface User {
  id: string;
  name: string;
  email: string;
  picture: string;
}

export interface ExtensionBookmark {
  id: string;
  title: string;
  url: string;
  dateAdded: string;
  folder?: string;
  parentId?: string;
}

export interface DatabaseBookmark {
  id: string;
  user_id: string;
  chrome_bookmark_id?: string;
  title: string;
  url: string;
  folder?: string;
  parent_id?: string;
  date_added: string;
  created_at: string;
  updated_at: string;
  title_embedding?: number[]; // Optional for backward compatibility
}

export interface SyncResult {
  inserted: number;
  updated: number;
  removed: number;
  total: number;
  hasChanges: boolean;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'loading';
  title: string;
  message?: string;
  duration?: number;
  persistent?: boolean;
}

export interface ExtensionMessage {
  source: string;
  type: string;
  requestId?: string;
  payload?: any;
  data?: any;
  event?: string;
}

export type ConnectionStatus = 'unknown' | 'connected' | 'disconnected';
export type ExtensionStatus = 'checking' | 'available' | 'unavailable';
export type SortOption = 'date' | 'title' | 'folder';