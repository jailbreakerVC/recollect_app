import React from 'react';
import { Database, Chrome, TrendingUp, Wifi } from 'lucide-react';
import { SyncResult } from '../services/syncService';

interface StatusCardsProps {
  connectionStatus: 'unknown' | 'connected' | 'disconnected';
  extensionAvailable: boolean;
  lastSyncResult: SyncResult | null;
}

export const StatusCards: React.FC<StatusCardsProps> = ({
  connectionStatus,
  extensionAvailable,
  lastSyncResult
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
      {/* Database Status */}
      <div className={`rounded-lg p-6 ${
        connectionStatus === 'connected' ? 'bg-blue-50 border border-blue-200' :
        connectionStatus === 'disconnected' ? 'bg-red-50 border border-red-200' :
        'bg-yellow-50 border border-yellow-200'
      }`}>
        <div className="flex items-start">
          <div className="flex items-center">
            <Database className={`w-6 h-6 mt-0.5 mr-3 flex-shrink-0 ${
              connectionStatus === 'connected' ? 'text-blue-600' :
              connectionStatus === 'disconnected' ? 'text-red-600' : 'text-yellow-600'
            }`} />
            {connectionStatus === 'connected' && <Wifi className="w-4 h-4 text-green-500" />}
          </div>
          <div>
            <h3 className={`text-lg font-semibold mb-2 ${
              connectionStatus === 'connected' ? 'text-blue-800' :
              connectionStatus === 'disconnected' ? 'text-red-800' : 'text-yellow-800'
            }`}>
              Database {connectionStatus === 'connected' ? 'Connected' : 
                       connectionStatus === 'disconnected' ? 'Disconnected' : 'Checking...'}
            </h3>
            <p className={
              connectionStatus === 'connected' ? 'text-blue-700' :
              connectionStatus === 'disconnected' ? 'text-red-700' : 'text-yellow-700'
            }>
              {connectionStatus === 'connected' 
                ? 'Your bookmarks are stored securely in Supabase. Use the refresh button to reload data or sync with Chrome extension.'
                : connectionStatus === 'disconnected'
                ? 'Unable to connect to the database. Please check your Supabase configuration.'
                : 'Testing database connection...'
              }
            </p>
          </div>
        </div>
      </div>

      {/* Extension Status */}
      <div className={`rounded-lg p-6 ${extensionAvailable ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
        <div className="flex items-start">
          <Chrome className={`w-6 h-6 mt-0.5 mr-3 flex-shrink-0 ${extensionAvailable ? 'text-green-600' : 'text-amber-600'}`} />
          <div>
            <h3 className={`text-lg font-semibold mb-2 ${extensionAvailable ? 'text-green-800' : 'text-amber-800'}`}>
              {extensionAvailable ? 'Chrome Extension Active' : 'Chrome Extension Optional'}
            </h3>
            <p className={extensionAvailable ? 'text-green-700' : 'text-amber-700'}>
              {extensionAvailable 
                ? 'Chrome extension is connected. Use the sync button to import your Chrome bookmarks.'
                : 'Install the Chrome extension to sync your browser bookmarks with the database.'
              }
            </p>
          </div>
        </div>
      </div>

      {/* Sync Status */}
      {lastSyncResult && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
          <div className="flex items-start">
            <TrendingUp className="w-6 h-6 mt-0.5 mr-3 flex-shrink-0 text-purple-600" />
            <div>
              <h3 className="text-lg font-semibold mb-2 text-purple-800">
                Last Sync Results
              </h3>
              <div className="text-purple-700 space-y-1">
                <div className="flex justify-between">
                  <span>Added:</span>
                  <span className="font-medium">{lastSyncResult.inserted}</span>
                </div>
                <div className="flex justify-between">
                  <span>Updated:</span>
                  <span className="font-medium">{lastSyncResult.updated}</span>
                </div>
                <div className="flex justify-between">
                  <span>Removed:</span>
                  <span className="font-medium">{lastSyncResult.removed}</span>
                </div>
                <div className="flex justify-between border-t border-purple-200 pt-1">
                  <span>Total:</span>
                  <span className="font-medium">{lastSyncResult.total}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};