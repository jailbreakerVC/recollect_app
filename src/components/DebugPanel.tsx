import React from 'react';
import { Bug, TestTube, Database } from 'lucide-react';
import { ExtensionService } from '../services/extensionService';
import { BookmarkService } from '../services/bookmarkService';
import { DatabaseBookmark } from '../lib/supabase';

interface DebugPanelProps {
  user: any;
  extensionAvailable: boolean;
  bookmarks: DatabaseBookmark[];
  loading: boolean;
  error: string | null;
  syncStatus: string | null;
  connectionStatus: 'unknown' | 'connected' | 'disconnected';
  debugInfo: any;
  onTestConnection: () => void;
  onDebugRefresh: () => void;
}

export const DebugPanel: React.FC<DebugPanelProps> = ({
  user,
  extensionAvailable,
  bookmarks,
  loading,
  error,
  syncStatus,
  connectionStatus,
  debugInfo,
  onTestConnection,
  onDebugRefresh
}) => {
  const [totalBookmarksCount, setTotalBookmarksCount] = React.useState<number | null>(null);

  // Get total bookmarks count for debugging
  React.useEffect(() => {
    const getTotalCount = async () => {
      try {
        const count = await BookmarkService.getAllBookmarksCount();
        setTotalBookmarksCount(count);
      } catch (err) {
        console.error('Failed to get total bookmarks count:', err);
      }
    };

    if (connectionStatus === 'connected') {
      getTotalCount();
    }
  }, [connectionStatus, bookmarks.length]);

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div className="mb-8 bg-gray-50 border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-semibold text-gray-900">Debug Information</h4>
        <div className="flex space-x-2">
          <button
            onClick={onTestConnection}
            className="inline-flex items-center px-2 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-700 transition-colors"
          >
            <TestTube className="w-3 h-3 mr-1" />
            Test Connection
          </button>
          <button
            onClick={onDebugRefresh}
            className="inline-flex items-center px-2 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-700 transition-colors"
          >
            <Bug className="w-3 h-3 mr-1" />
            Refresh Debug
          </button>
        </div>
      </div>
      <div className="text-sm text-gray-600 space-y-1">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="font-medium text-gray-700 mb-1">Environment</div>
            <div>Supabase URL: {import.meta.env.VITE_SUPABASE_URL ? '✅ Set' : '❌ Missing'}</div>
            <div>Supabase Key: {import.meta.env.VITE_SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing'}</div>
            <div>User ID: {user?.id || 'Not logged in'}</div>
            <div>Connection Status: {connectionStatus}</div>
          </div>
          <div>
            <div className="font-medium text-gray-700 mb-1">Extension</div>
            <div>Extension Available: {extensionAvailable ? 'Yes' : 'No'}</div>
            <div>Extension Flag: {(window as any).bookmarkExtensionAvailable ? 'Set' : 'Not Set'}</div>
            <div>Extension Service: {ExtensionService ? 'Loaded' : 'Not Loaded'}</div>
          </div>
        </div>
        
        <div className="border-t border-gray-300 pt-2 mt-2">
          <div className="font-medium text-gray-700 mb-1">Data Status</div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div>User Bookmarks: {bookmarks.length}</div>
              <div>Loading: {loading ? 'Yes' : 'No'}</div>
              <div>Error: {error || 'None'}</div>
            </div>
            <div>
              <div>Total DB Bookmarks: {totalBookmarksCount !== null ? totalBookmarksCount : 'Loading...'}</div>
              <div>Sync Status: {syncStatus || 'None'}</div>
              <div>RLS Status: Disabled (Dev Mode)</div>
            </div>
          </div>
        </div>
        
        {debugInfo && (
          <div className="mt-2 p-2 bg-gray-100 rounded text-xs border-t border-gray-300">
            <div className="font-medium mb-1 flex items-center">
              <Database className="w-3 h-3 mr-1" />
              Database Debug Info:
            </div>
            <pre className="whitespace-pre-wrap overflow-x-auto">{JSON.stringify(debugInfo, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
};