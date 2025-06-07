export const APP_CONFIG = {
  EXTENSION_CHECK_INTERVAL: 3000,
  SYNC_TIMEOUT: 15000,
  MESSAGE_TIMEOUT: 10000,
  MAX_BOOKMARKS_PER_SYNC: 1000,
  RETRY_ATTEMPTS: 3,
  DEBOUNCE_DELAY: 300,
} as const;

export const EXTENSION_MESSAGES = {
  SOURCES: {
    WEBAPP: 'bookmark-manager-webapp',
    EXTENSION: 'bookmark-manager-extension',
  },
  TYPES: {
    SYNC_COMPLETE: 'syncComplete',
    CONNECTION_TEST: 'connectionTest',
    AVAILABILITY_CHECK: 'availabilityCheck',
    EXTENSION_READY: 'bookmarkExtensionReady',
  },
  ACTIONS: {
    GET_BOOKMARKS: 'getBookmarks',
    ADD_BOOKMARK: 'addBookmark',
    REMOVE_BOOKMARK: 'removeBookmark',
    TEST_CONNECTION: 'testConnection',
  },
} as const;

export const IGNORED_MESSAGE_SOURCES = [
  'react-devtools',
  'devtools',
  'react-devtools-content-script',
  'react-devtools-bridge',
] as const;

export const TOAST_DURATIONS = {
  SUCCESS: 5000,
  ERROR: 8000,
  INFO: 4000,
  LOADING: 0, // Persistent until manually closed
} as const;