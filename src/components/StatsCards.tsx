import React from 'react';
import { BookmarkPlus, Chrome, Database, TrendingUp, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { SyncResult } from '../types';

interface StatsCardsProps {
  totalBookmarks: number;
  extensionStatus: 'checking' | 'available' | 'unavailable';
  lastSyncResult: SyncResult | null;
  syncStatus: string | null;
}

const StatsCards: React.FC<StatsCardsProps> = ({
  totalBookmarks,
  extensionStatus,
  lastSyncResult,
  syncStatus
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {/* Total Bookmarks */}
      <div className="bg-secondary-dark rounded-xl p-6 border border-border">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-text-secondary text-sm font-medium">Total Bookmarks</p>
            <p className="text-2xl font-bold text-text-primary mt-1">{totalBookmarks.toLocaleString()}</p>
          </div>
          <div className="w-12 h-12 bg-accent/20 rounded-lg flex items-center justify-center">
            <BookmarkPlus className="w-6 h-6 text-accent" />
          </div>
        </div>
      </div>

      {/* Extension Status */}
      <div className="bg-secondary-dark rounded-xl p-6 border border-border">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-text-secondary text-sm font-medium">Chrome Extension</p>
            <p className={`text-sm font-semibold mt-1 ${
              extensionStatus === 'available' ? 'text-green-400' :
              extensionStatus === 'unavailable' ? 'text-red-400' : 'text-yellow-400'
            }`}>
              {extensionStatus === 'available' ? 'Connected' :
               extensionStatus === 'unavailable' ? 'Not Available' : 'Checking...'}
            </p>
          </div>
          <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
            extensionStatus === 'available' ? 'bg-green-400/20' :
            extensionStatus === 'unavailable' ? 'bg-red-400/20' : 'bg-yellow-400/20'
          }`}>
            {extensionStatus === 'available' ? (
              <CheckCircle className="w-6 h-6 text-green-400" />
            ) : extensionStatus === 'unavailable' ? (
              <AlertCircle className="w-6 h-6 text-red-400" />
            ) : (
              <Clock className="w-6 h-6 text-yellow-400" />
            )}
          </div>
        </div>
      </div>

      {/* Database Status */}
      <div className="bg-secondary-dark rounded-xl p-6 border border-border">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-text-secondary text-sm font-medium">Database</p>
            <p className="text-green-400 text-sm font-semibold mt-1">Connected</p>
          </div>
          <div className="w-12 h-12 bg-green-400/20 rounded-lg flex items-center justify-center">
            <Database className="w-6 h-6 text-green-400" />
          </div>
        </div>
      </div>

      {/* Sync Status */}
      <div className="bg-secondary-dark rounded-xl p-6 border border-border">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-text-secondary text-sm font-medium">Last Sync</p>
            {syncStatus ? (
              <p className="text-blue-400 text-sm font-semibold mt-1">{syncStatus}</p>
            ) : lastSyncResult ? (
              <p className="text-green-400 text-sm font-semibold mt-1">
                {lastSyncResult.hasChanges ? 'Changes Applied' : 'Up to Date'}
              </p>
            ) : (
              <p className="text-text-secondary text-sm mt-1">Never</p>
            )}
          </div>
          <div className="w-12 h-12 bg-blue-400/20 rounded-lg flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-blue-400" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatsCards;