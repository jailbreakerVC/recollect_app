import React from 'react';
import { Menu, Search, Bell, Settings } from 'lucide-react';
import { User } from '../types';

interface TopBarProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  user: User | null;
}

const TopBar: React.FC<TopBarProps> = ({
  sidebarOpen,
  onToggleSidebar,
  searchTerm,
  onSearchChange,
  user
}) => {
  return (
    <header className="bg-secondary-dark border-b border-border px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Left Section */}
        <div className="flex items-center space-x-4">
          <button
            onClick={onToggleSidebar}
            className="lg:hidden text-text-secondary hover:text-text-primary transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          
          <div className="hidden lg:block">
            <h2 className="text-xl font-semibold text-text-primary">Dashboard</h2>
            <p className="text-sm text-text-secondary">Manage your bookmarks</p>
          </div>
        </div>

        {/* Center Section - Search */}
        <div className="flex-1 max-w-md mx-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-secondary w-4 h-4" />
            <input
              type="text"
              placeholder="Search bookmarks..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-primary-dark border border-border rounded-lg text-text-primary placeholder-text-secondary focus:ring-2 focus:ring-accent focus:border-transparent"
            />
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center space-x-3">
          <button className="p-2 text-text-secondary hover:text-text-primary hover:bg-hover rounded-lg transition-colors">
            <Bell className="w-5 h-5" />
          </button>
          
          <button className="p-2 text-text-secondary hover:text-text-primary hover:bg-hover rounded-lg transition-colors">
            <Settings className="w-5 h-5" />
          </button>

          {user && (
            <div className="flex items-center space-x-2 ml-2">
              <img
                src={user.picture}
                alt={user.name}
                className="w-8 h-8 rounded-full border border-border"
              />
              <span className="hidden sm:block text-sm font-medium text-text-primary">
                {user.name.split(' ')[0]}
              </span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default TopBar;