import React from 'react';
import { 
  BookmarkPlus, 
  Chrome, 
  Database, 
  Settings, 
  LogOut, 
  X,
  TrendingUp,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Wifi,
  WifiOff
} from 'lucide-react';
import { User, SyncResult } from '../types';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  onLogout: () => void;
  extensionStatus: 'checking' | 'available' | 'unavailable';
  lastSyncResult: SyncResult | null;
  onSync: () => void;
  loading: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  user,
  onLogout,
  extensionStatus,
  lastSyncResult,
  onSync,
  loading
}) => {
  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed top-0 left-0 h-full w-64 bg-secondary-dark border-r border-border z-50
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0
      `}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-6 border-b border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-br from-accent to-accent-hover rounded-lg flex items-center justify-center">
                  <BookmarkPlus className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-xl font-bold text-text-primary">Recollect</h1>
              </div>
              <button
                onClick={onClose}
                className="lg:hidden text-text-secondary hover:text-text-primary transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* User Profile */}
          {user && (
            <div className="p-6 border-b border-border">
              <div className="flex items-center space-x-3">
                <img
                  src={user.picture}
                  alt={user.name}
                  className="w-10 h-10 rounded-full border-2 border-border"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">
                    {user.name}
                  </p>
                  <p className="text-xs text-text-secondary truncate">
                    {user.email}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Status Cards */}
          <div className="p-6 space-y-4">
            {/* Extension Status */}
            <div className="bg-primary-dark rounded-lg p-4 border border-border">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <Chrome className="w-4 h-4 text-text-secondary" />
                  <span className="text-sm font-medium text-text-primary">Extension</span>
                </div>
                <div className="flex items-center space-x-1">
                  {extensionStatus === 'available' ? (
                    <Wifi className="w-4 h-4 text-green-400" />
                  ) : extensionStatus === 'unavailable' ? (
                    <WifiOff className="w-4 h-4 text-red-400" />
                  ) : (
                    <div className="w-4 h-4 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
                  )}
                </div>
              </div>
              <p className="text-xs text-text-secondary">
                {extensionStatus === 'available' ? 'Connected' :
                 extensionStatus === 'unavailable' ? 'Not Available' : 'Checking...'}
              </p>
            </div>

            {/* Sync Status */}
            {lastSyncResult && (
              <div className="bg-primary-dark rounded-lg p-4 border border-border">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="w-4 h-4 text-text-secondary" />
                    <span className="text-sm font-medium text-text-primary">Last Sync</span>
                  </div>
                  <CheckCircle className="w-4 h-4 text-green-400" />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-text-secondary">Total:</span>
                    <span className="text-text-primary font-medium">{lastSyncResult.total}</span>
                  </div>
                  {lastSyncResult.hasChanges && (
                    <>
                      {lastSyncResult.inserted > 0 && (
                        <div className="flex justify-between text-xs">
                          <span className="text-text-secondary">Added:</span>
                          <span className="text-green-400 font-medium">+{lastSyncResult.inserted}</span>
                        </div>
                      )}
                      {lastSyncResult.updated > 0 && (
                        <div className="flex justify-between text-xs">
                          <span className="text-text-secondary">Updated:</span>
                          <span className="text-blue-400 font-medium">~{lastSyncResult.updated}</span>
                        </div>
                      )}
                      {lastSyncResult.removed > 0 && (
                        <div className="flex justify-between text-xs">
                          <span className="text-text-secondary">Removed:</span>
                          <span className="text-red-400 font-medium">-{lastSyncResult.removed}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Sync Button */}
            {extensionStatus === 'available' && (
              <button
                onClick={onSync}
                disabled={loading}
                className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span>Sync Chrome</span>
              </button>
            )}
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Footer Actions */}
          <div className="p-6 border-t border-border space-y-2">
            <button className="w-full flex items-center space-x-3 px-3 py-2 text-text-secondary hover:text-text-primary hover:bg-hover rounded-lg transition-colors">
              <Settings className="w-4 h-4" />
              <span className="text-sm">Settings</span>
            </button>
            
            <button
              onClick={onLogout}
              className="w-full flex items-center space-x-3 px-3 py-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm">Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;