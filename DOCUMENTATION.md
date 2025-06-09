# Recollect App - Complete Technical Documentation

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Data Flow](#data-flow)
3. [Chrome Extension Components](#chrome-extension-components)
4. [Web Application Components](#web-application-components)
5. [Database Schema](#database-schema)
6. [Services & Utilities](#services--utilities)
7. [Authentication Flow](#authentication-flow)
8. [Search Flow](#search-flow)
9. [Sync Flow](#sync-flow)
10. [Error Handling](#error-handling)

---

## Architecture Overview

Recollect is a sophisticated bookmark management system consisting of:

### Core Components
- **Chrome Extension**: Context-aware bookmark search and management
- **React Web App**: Full-featured bookmark management interface
- **Supabase Database**: PostgreSQL with vector search capabilities
- **Google OAuth**: Secure authentication system

### Technology Stack
- **Frontend**: React 18 + TypeScript + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **Extension**: Chrome Extension Manifest V3
- **Authentication**: Google OAuth 2.0
- **Search**: pgvector for semantic search + pg_trgm for text search

---

## Data Flow

### High-Level Data Flow
```
Chrome Browser Bookmarks → Extension → Content Script → Web App → Supabase Database
                                    ↓
Extension Popup ← Background Script ← Search Results ← Semantic Search Engine
```

### Detailed Flow Sequence
1. **User adds bookmark in Chrome** → Chrome's bookmark API
2. **Extension detects change** → Background script event listener
3. **Background script syncs** → Sends to web app via content script
4. **Web app processes** → Validates and stores in Supabase
5. **User searches** → Context menu or page analysis triggers search
6. **Search executes** → Semantic/text search in database
7. **Results display** → Beautiful popup with keyboard navigation

---

## Chrome Extension Components

### 1. Background Script (`public/background.js`)

**Purpose**: Central coordinator for all extension operations

#### Key Classes & Functions:

##### `BackgroundManager` Class
```javascript
class BackgroundManager {
  constructor() {
    this.contextMenuEnabled = true;
    this.pageAnalysisEnabled = true;
    this.searchCache = new Map();
    this.pendingSearches = new Map();
    this.responseHandlers = new Map();
  }
}
```

**Core Functions:**

##### `init()`
- Sets up all event listeners
- Initializes context menu
- Configures page analysis
- Establishes content script connections

##### `setupContextMenu()`
- Creates "Search Bookmarks for '%s'" context menu item
- Handles right-click search functionality
- Triggers when user selects text and right-clicks

##### `handleContextMenuSearch(selectedText, tab)`
- **Input**: Selected text from webpage, current tab info
- **Process**: 
  1. Shows loading badge
  2. Calls `searchBookmarksByKeyword()`
  3. Stores results in chrome.storage.local
  4. Auto-opens popup with results
- **Output**: Search results displayed in popup

##### `analyzePageForBookmarks(tabId, tab)`
- **Purpose**: Automatic page analysis for related bookmarks
- **Process**:
  1. Extracts page context (title, keywords, domain)
  2. Searches for semantically related bookmarks
  3. Shows suggestions if matches found
- **Triggers**: Tab updates, tab activation

##### `searchBookmarksByKeyword(keyword)`
- **Input**: Search keyword string
- **Process**:
  1. Generates unique request ID
  2. Sets up response listener with timeout
  3. Sends request to web app via content script
  4. Waits for response with matching request ID
- **Output**: Promise resolving to search results array
- **Timeout**: 15 seconds with cleanup

##### `sendMessageToWebApp(message)`
- **Purpose**: Robust message delivery to web application
- **Process**:
  1. Finds web app tabs (localhost, netlify, vercel)
  2. Tests content script readiness with ping
  3. Injects content script if needed
  4. Forwards message with retry logic
- **Error Handling**: Multiple fallback strategies

##### `showSearchResults(results, query, searchType, autoOpen)`
- **Input**: Search results array, query string, search type, auto-open flag
- **Process**:
  1. Stores results in chrome.storage.local
  2. Updates extension badge with result count
  3. Auto-opens popup if requested
  4. Shows notifications for feedback
- **Storage Format**:
```javascript
{
  results: Array<SearchResult>,
  query: string,
  searchType: 'keyword' | 'context' | 'manual',
  timestamp: number
}
```

### 2. Content Script (`public/content.js`)

**Purpose**: Bridge between web page and extension background

#### Key Classes & Functions:

##### `ContentScriptManager` Class
```javascript
class ContentScriptManager {
  constructor() {
    this.isInitialized = false;
    this.messageQueue = [];
    this.port = null;
    this.responseListeners = new Map();
    this.contextValid = true;
  }
}
```

**Core Functions:**

##### `setupContextValidation()`
- **Purpose**: Monitors extension context validity
- **Process**:
  1. Tests `chrome.runtime.id` availability
  2. Sets up periodic validation (10-second intervals)
  3. Handles context invalidation gracefully
- **Critical**: Prevents "Extension context invalidated" errors

##### `handleWebPageMessage(event)`
- **Purpose**: Processes messages from web application
- **Filters**: Ignores React DevTools and other non-bookmark messages
- **Key Logic**:
```javascript
if (event.data.action === 'searchResults') {
  this.forwardSearchResponseToBackground(event.data);
}
```

##### `forwardSearchResponseToBackground(data)`
- **Critical Function**: Forwards search results to background script
- **Process**:
  1. Validates extension context
  2. Sends search response with matching request ID
  3. Handles errors gracefully
- **Message Format**:
```javascript
{
  action: 'searchResponse',
  data: {
    requestId: string,
    success: boolean,
    results: Array<SearchResult>
  }
}
```

##### `injectExtensionFlag()`
- **Purpose**: Injects availability flag into web page
- **Injected Code**:
```javascript
window.bookmarkExtensionAvailable = true;
window.notifyExtensionSyncComplete = function(data) { ... };
```

### 3. Popup (`public/popup.html` + `public/popup.js`)

**Purpose**: Beautiful dark-themed interface for search results

#### Key Classes & Functions:

##### `PopupManager` Class
```javascript
class PopupManager {
  constructor() {
    this.isConnected = false;
    this.bookmarkCount = 0;
    this.elements = {};
  }
}
```

**Core Functions:**

##### `loadSearchResults()`
- **Purpose**: Loads and displays search results from storage
- **Process**:
  1. Requests results from background script
  2. Calls `displaySearchResults()` if data exists
  3. Shows "no results" state otherwise

##### `displaySearchResults(searchData)`
- **Input**: Search data object with results, query, type, timestamp
- **Process**:
  1. Renders search query if available
  2. Updates title based on search type
  3. Creates result cards with metadata
  4. Sets up click handlers for bookmark opening
  5. Enables keyboard navigation
- **UI Features**:
  - Beautiful gradient animations
  - Hover effects with transforms
  - Similarity scores display
  - Search type indicators

##### `setupKeyboardNavigation()`
- **Purpose**: Arrow key navigation through results
- **Controls**:
  - `↑/↓`: Navigate between results
  - `Enter`: Open selected bookmark
  - Visual highlighting with CSS transitions

##### `handleAutoOpen()`
- **Purpose**: Detects auto-opened popup from search
- **Process**:
  1. Checks timestamp of last search results
  2. If recent (< 10 seconds), assumes auto-opened
  3. Clears extension badge
  4. Adds highlight animation

---

## Web Application Components

### 1. Main App (`src/App.tsx`)

**Purpose**: Root component with routing and authentication

#### Key Functions:

##### `AppContent` Component
- **Purpose**: Main app logic with conditional rendering
- **Routing**: Hash-based routing (`#bookmarks`)
- **States**: Loading, Landing (unauthenticated), Dashboard, BookmarkManager

### 2. Authentication (`src/contexts/AuthContext.tsx`)

**Purpose**: Google OAuth authentication management

#### Key Functions:

##### `AuthProvider` Component
- **State Management**: User session, loading states, errors
- **Storage**: localStorage with token expiry (1 hour)
- **Session Validation**: Automatic cleanup of expired tokens

##### `login(credential: string)`
- **Input**: JWT credential from Google OAuth
- **Process**:
  1. Decodes JWT payload
  2. Extracts user information (id, name, email, picture)
  3. Stores in localStorage with expiry
  4. Updates context state

##### `logout()`
- **Process**:
  1. Clears user state
  2. Removes localStorage data
  3. Revokes Google session
  4. Resets error states

### 3. Bookmark Manager (`src/components/BookmarkManager.tsx`)

**Purpose**: Main bookmark management interface

#### Key Functions:

##### `handleExtensionMessage(event)`
- **Purpose**: Processes search requests from extension
- **Message Types**:
  - `searchByKeyword`: Text-based search
  - `searchByPageContext`: Context-aware search

##### `handleKeywordSearchRequest(keyword, requestId)`
- **Input**: Search keyword, unique request ID
- **Process**:
  1. Validates user authentication
  2. Calls `searchBookmarksByKeyword()`
  3. Sends response via `sendSearchResponse()`
- **Search Algorithm**:
```javascript
bookmarks.filter(bookmark => 
  bookmark.title.toLowerCase().includes(searchTerm) ||
  bookmark.url.toLowerCase().includes(searchTerm) ||
  (bookmark.folder && bookmark.folder.toLowerCase().includes(searchTerm))
)
```

##### `handlePageContextSearchRequest(context, requestId)`
- **Input**: Page context object, request ID
- **Process**:
  1. Extracts search terms from context
  2. Scores bookmarks by relevance
  3. Filters and sorts results
  4. Returns top matches

##### `searchBookmarksByPageContext(context)`
- **Context Analysis**:
  - Title keywords (length > 3 characters)
  - Domain extraction and processing
  - Technology detection (github, docs, etc.)
- **Scoring Algorithm**:
```javascript
calculateContextSimilarity(bookmark, searchTerms, domain) {
  let score = 0;
  // Term matching (70% weight)
  score += (matchingTerms.length / searchTerms.length) * 0.7;
  // Domain similarity (30% weight)
  if (bookmarkDomain.includes(domain.split('.')[0])) score += 0.3;
  // Technology matching bonus
  if (hasTechMatch) score += 0.2;
  return Math.min(score, 1.0);
}
```

##### `sendSearchResponse(requestId, success, message, results)`
- **Purpose**: Sends search results back to extension
- **Message Format**:
```javascript
{
  source: 'bookmark-manager-webapp',
  action: 'searchResults',
  requestId: string,
  success: boolean,
  message: string,
  results: Array<SearchResult>
}
```

### 4. Hooks (`src/hooks/useSupabaseBookmarks.ts`)

**Purpose**: Bookmark data management with Supabase

#### Key Functions:

##### `useSupabaseBookmarks()`
- **Returns**: Comprehensive bookmark management interface
- **State Management**: bookmarks, loading, error, sync status
- **Extension Integration**: Automatic sync detection

##### `loadBookmarks()`
- **Purpose**: Fetches user bookmarks from database
- **Process**:
  1. Validates user authentication
  2. Calls `BookmarkService.getBookmarks()`
  3. Updates local state
  4. Handles errors gracefully

##### `syncWithExtension(onProgress)`
- **Purpose**: Synchronizes Chrome bookmarks with database
- **Process**:
  1. Tests extension availability
  2. Validates database connection
  3. Calls `SyncService.syncWithExtension()`
  4. Updates UI with progress callbacks
  5. Refreshes bookmark list

##### `handleExtensionSyncRequest()`
- **Purpose**: Handles sync requests from extension
- **Process**:
  1. Updates sync status
  2. Performs sync operation
  3. Notifies extension of completion
  4. Updates local bookmark list

---

## Database Schema

### Tables

#### `bookmarks` Table
```sql
CREATE TABLE bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  chrome_bookmark_id text,
  title text NOT NULL,
  url text NOT NULL,
  folder text,
  parent_id text,
  date_added timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  title_embedding vector(384)  -- For semantic search
);
```

#### Indexes
- `idx_bookmarks_user_id`: Fast user queries
- `idx_bookmarks_chrome_id`: Sync operations
- `idx_bookmarks_date_added`: Sorting
- `idx_bookmarks_title_embedding`: Vector similarity search
- `idx_bookmarks_title_trgm`: Trigram text search

### Functions

#### `search_bookmarks_semantic(query, user_id, threshold, max_results)`
- **Purpose**: Performs semantic search using embeddings
- **Fallbacks**: Trigram search → Simple text search
- **Returns**: Results with similarity scores and search types

#### `generate_title_embedding(title_text)`
- **Purpose**: Creates 384-dimensional embeddings
- **Algorithm**: Hash-based with text feature extraction
- **Features**: Length, capitalization, technology keywords

#### `update_bookmark_embeddings(user_id)`
- **Purpose**: Generates embeddings for bookmarks without them
- **Process**: Batch processing with error handling
- **Returns**: Count of updated bookmarks

---

## Services & Utilities

### 1. Extension Service (`src/services/extensionService.ts`)

**Purpose**: Web app interface to Chrome extension

#### Key Functions:

##### `ExtensionService` (Singleton)
- **Initialization**: Sets up message handlers and availability detection
- **Cleanup**: Proper resource management

##### `setupAvailabilityDetection(onAvailabilityChange)`
- **Purpose**: Monitors extension availability
- **Process**:
  1. Periodic availability checks (5-second intervals)
  2. Listens for extension ready events
  3. Calls callback on status changes
- **Returns**: Cleanup function

##### `getBookmarks()`
- **Purpose**: Retrieves bookmarks from Chrome
- **Process**:
  1. Validates extension availability
  2. Sends message with timeout (15 seconds)
  3. Validates returned bookmark data
- **Returns**: Promise<ExtensionBookmark[]>

##### `testConnection()`
- **Purpose**: Tests extension communication
- **Process**:
  1. Checks availability flag
  2. Attempts to fetch bookmarks
  3. Returns success/failure with message

### 2. Bookmark Service (`src/services/bookmarkService.ts`)

**Purpose**: Database operations for bookmarks

#### Key Functions:

##### `getBookmarks(userId)`
- **Purpose**: Fetches user bookmarks from database
- **Process**:
  1. Sets user context for RLS
  2. Queries bookmarks table
  3. Validates and filters results
- **Returns**: Promise<DatabaseBookmark[]>

##### `addBookmark(userId, title, url, folder, chromeBookmarkId)`
- **Purpose**: Adds new bookmark to database
- **Validation**: Title, URL, user ID validation
- **Process**: Sanitizes data, inserts with metadata

##### `bulkInsertBookmarks(userId, bookmarks)`
- **Purpose**: Efficient batch bookmark insertion
- **Process**:
  1. Sanitizes bookmark data
  2. Performs bulk insert operation
  3. Returns inserted bookmarks

##### `testConnection(userId)`
- **Purpose**: Tests database connectivity
- **Process**:
  1. Basic Supabase ping
  2. User-specific query test
  3. Debug context information
- **Returns**: Success status with debug info

### 3. Sync Service (`src/services/syncService.ts`)

**Purpose**: Synchronization between Chrome and database

#### Key Functions:

##### `syncWithExtension(userId, onProgress)`
- **Purpose**: Complete sync operation
- **Process**:
  1. Tests database and extension connections
  2. Fetches bookmarks from both sources
  3. Analyzes differences
  4. Executes sync operations
  5. Updates sync hash for change detection

##### `analyzeBookmarkDifferences(extensionBookmarks, databaseBookmarks)`
- **Purpose**: Determines sync operations needed
- **Analysis**:
  - New bookmarks to insert
  - Existing bookmarks to update
  - Deleted bookmarks to remove
- **Returns**: Operation arrays for each type

##### `executeSyncOperations(userId, analysis, totalBookmarks, onProgress)`
- **Purpose**: Performs actual sync operations
- **Process**:
  1. Bulk insert new bookmarks
  2. Update modified bookmarks
  3. Remove deleted bookmarks
  4. Progress reporting throughout

### 4. Semantic Search Service (`src/services/semanticSearchService.ts`)

**Purpose**: AI-powered bookmark search

#### Key Functions:

##### `searchByQuery(query, userId, options)`
- **Purpose**: Text-based semantic search
- **Process**:
  1. Validates inputs and options
  2. Calls database search function
  3. Handles fallbacks gracefully
- **Returns**: Promise<SemanticSearchResult[]>

##### `searchByPageContext(context, userId, options)`
- **Purpose**: Context-aware bookmark search
- **Process**:
  1. Creates search query from page context
  2. Performs semantic search
  3. Filters out current page if requested

##### `updateUserEmbeddings(userId)`
- **Purpose**: Generates embeddings for user bookmarks
- **Process**:
  1. Calls database function
  2. Returns count of updated bookmarks
  3. Handles errors gracefully

---

## Authentication Flow

### 1. Google OAuth Setup
```
User clicks "Sign in with Google" → Google OAuth popup → JWT token returned
```

### 2. Token Processing
```javascript
// In AuthContext.tsx
const login = async (credential: string) => {
  const payload = JSON.parse(atob(credential.split('.')[1]));
  const userData = {
    id: payload.sub,        // Google user ID
    name: payload.name,     // Full name
    email: payload.email,   // Email address
    picture: payload.picture // Profile picture URL
  };
  // Store with 1-hour expiry
  localStorage.setItem('user', JSON.stringify(userData));
  localStorage.setItem('tokenExpiry', (Date.now() + 3600000).toString());
};
```

### 3. Session Management
- **Storage**: localStorage with automatic expiry
- **Validation**: Checks token expiry on app load
- **Cleanup**: Automatic cleanup of expired sessions

---

## Search Flow

### 1. Context Menu Search
```
User selects text → Right-click → "Search Bookmarks" → Background script → Web app → Results → Popup
```

**Detailed Steps:**
1. **User Action**: Selects text on webpage, right-clicks
2. **Context Menu**: Chrome shows "Search Bookmarks for 'selected text'"
3. **Background Script**: `handleContextMenuSearch()` triggered
4. **Request Generation**: Creates unique request ID, sets up response listener
5. **Message Sending**: Sends to web app via content script
6. **Web App Processing**: `handleKeywordSearchRequest()` processes search
7. **Database Query**: Searches bookmarks with keyword matching
8. **Response**: Results sent back with matching request ID
9. **Storage**: Background script stores results in chrome.storage.local
10. **Popup Display**: Auto-opens popup with beautiful results display

### 2. Page Context Search
```
User visits page → Extension analyzes → Finds related bookmarks → Shows suggestions
```

**Detailed Steps:**
1. **Page Load**: Tab update/activation triggers analysis
2. **Context Extraction**: Title, keywords, domain, technology detection
3. **Search Processing**: Context-aware search in database
4. **Relevance Scoring**: Calculates similarity scores
5. **Result Filtering**: Excludes current page, applies thresholds
6. **Notification**: Shows results if matches found

### 3. Search Algorithms

#### Keyword Search
```javascript
const searchBookmarksByKeyword = (keyword) => {
  return bookmarks.filter(bookmark => 
    bookmark.title.toLowerCase().includes(keyword) ||
    bookmark.url.toLowerCase().includes(keyword) ||
    bookmark.folder?.toLowerCase().includes(keyword)
  ).map(bookmark => ({
    ...bookmark,
    similarity_score: calculateKeywordSimilarity(bookmark, keyword),
    search_type: 'keyword'
  }));
};
```

#### Context Search
```javascript
const searchBookmarksByPageContext = (context) => {
  const searchTerms = extractSearchTerms(context);
  return bookmarks
    .map(bookmark => ({
      ...bookmark,
      similarity_score: calculateContextSimilarity(bookmark, searchTerms, context.domain),
      search_type: 'context'
    }))
    .filter(bookmark => bookmark.similarity_score > 0.1)
    .sort((a, b) => b.similarity_score - a.similarity_score)
    .slice(0, 8);
};
```

---

## Sync Flow

### 1. Manual Sync
```
User clicks "Sync Chrome" → Tests connections → Analyzes differences → Executes operations → Updates UI
```

**Detailed Steps:**
1. **User Trigger**: Clicks sync button in web app
2. **Connection Tests**: 
   - Extension availability check
   - Database connectivity test
3. **Data Fetching**:
   - Chrome bookmarks via extension
   - Database bookmarks via Supabase
4. **Difference Analysis**:
   - Compare by chrome_bookmark_id
   - Identify new, updated, deleted bookmarks
5. **Operation Execution**:
   - Bulk insert new bookmarks
   - Update modified bookmarks
   - Remove deleted bookmarks
6. **Progress Updates**: Real-time progress callbacks
7. **Completion**: Update UI with sync results

### 2. Automatic Sync
```
Extension detects bookmark change → Notifies web app → Triggers sync → Updates database
```

### 3. Sync Algorithms

#### Change Detection
```javascript
const analyzeBookmarkDifferences = (extensionBookmarks, databaseBookmarks) => {
  const dbBookmarkMap = new Map(
    databaseBookmarks
      .filter(b => b.chrome_bookmark_id)
      .map(b => [b.chrome_bookmark_id, b])
  );

  const toInsert = [];
  const toUpdate = [];
  
  for (const extBookmark of extensionBookmarks) {
    const existingBookmark = dbBookmarkMap.get(extBookmark.id);
    
    if (existingBookmark) {
      if (needsUpdate(existingBookmark, extBookmark)) {
        toUpdate.push({ id: existingBookmark.id, updates: {...} });
      }
    } else {
      toInsert.push({ chrome_bookmark_id: extBookmark.id, ... });
    }
  }
  
  const toRemove = databaseBookmarks
    .filter(b => b.chrome_bookmark_id && !extensionBookmarkIds.has(b.chrome_bookmark_id))
    .map(b => b.chrome_bookmark_id);
    
  return { toInsert, toUpdate, toRemove };
};
```

---

## Error Handling

### 1. Extension Context Invalidation
**Problem**: Extension reloads invalidate content script context
**Solution**: 
- Context validation checks
- Graceful degradation
- Error message to user
- Automatic cleanup

### 2. Message Timeout Handling
**Problem**: Messages between extension and web app can timeout
**Solution**:
- 15-second timeouts with cleanup
- Retry mechanisms
- Fallback error messages
- Request ID matching

### 3. Database Connection Issues
**Problem**: Supabase connection failures
**Solution**:
- Connection testing functions
- Graceful error messages
- Retry mechanisms
- Debug information

### 4. Search Fallbacks
**Problem**: Semantic search may fail
**Solution**:
- Trigram search fallback
- Simple text search fallback
- Error handling at each level
- User-friendly error messages

---

## Performance Optimizations

### 1. Extension Performance
- **Debounced availability checks**: Prevents spam
- **Message queuing**: Handles rapid requests
- **Context validation**: Prevents invalid operations
- **Cleanup functions**: Proper resource management

### 2. Database Performance
- **Indexes**: Optimized for common queries
- **Bulk operations**: Efficient sync operations
- **Vector search**: Fast similarity queries
- **Connection pooling**: Supabase handles automatically

### 3. UI Performance
- **Virtual scrolling**: For large bookmark lists
- **Debounced search**: Prevents excessive queries
- **Memoized components**: React optimization
- **Lazy loading**: Components loaded on demand

---

## Security Considerations

### 1. Authentication
- **Google OAuth 2.0**: Industry standard
- **Token expiry**: 1-hour sessions
- **Secure storage**: localStorage with validation
- **Session cleanup**: Automatic expiry handling

### 2. Database Security
- **Row Level Security**: User data isolation
- **Input validation**: All inputs sanitized
- **SQL injection prevention**: Parameterized queries
- **HTTPS only**: Secure communication

### 3. Extension Security
- **Manifest V3**: Latest security standards
- **Content Security Policy**: Strict CSP rules
- **Origin validation**: Message source verification
- **Permission minimization**: Only required permissions

---

This documentation provides a complete technical overview of the Recollect app, covering every component, function, and data flow in the system. Each section explains the purpose, implementation, and interactions of the various parts that make up this sophisticated bookmark management solution.