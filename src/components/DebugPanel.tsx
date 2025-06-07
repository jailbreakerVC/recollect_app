import React from 'react';
import { Bug, TestTube } from 'lucide-react';
import { ExtensionService } from '../services/extensionService';
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
        <div>Supabase URL: {import.meta.env.VITE_SUPABASE_URL ? '✅ Set' : '❌ Missing'}</div>
        <div>Supabase Key: {import.meta.env.VITE_SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing'}</div>
        <div>User ID: {user?.id || 'Not logged in'}</div>
        <div>Extension Available: {extensionAvailable ? 'Yes' : 'No'}</div>
        <div>Extension Flag: {(window as any).bookmarkExtensionAvailable ? 'Set' : 'Not Set'}</div>
        <div>Extension Service: {ExtensionService ? 'Loaded' : 'Not Loaded'}</div>
        <div>Bookmarks Count: {bookmarks.length}</div>
        <div>Loading: {loading ? 'Yes' : 'No'}</div>
        <div>Error: {error || 'None'}</div>
        <div>Sync Status: {syncStatus || 'None'}</div>
        <div>Connection Status: {connectionStatus}</div>
        {debugInfo && (
          <div className="mt-2 p-2 bg-gray-100 rounded text-xs">
            <div className="font-medium mb-1">User Context Debug:</div>
            <pre className="whitespace-pre-wrap">{JSON.stringify(debugInfo, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
};