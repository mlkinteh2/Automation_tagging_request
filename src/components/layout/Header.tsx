'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Search, Bell, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function Header() {
  const { user, role, logout } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <header className="brand-header h-16 bg-slate-900/90 border-b border-slate-800 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-40">
      {/* Global Search Bar (Requirement 42) */}
      <form onSubmit={handleSearch} className="flex items-center w-full max-w-md">
        <div className="relative w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Global Search (Plate, Parker, Company, Lot, Request ID)..."
            className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 pl-9 pr-4 py-2 rounded-lg focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
      </form>

      {/* Right Controls */}
      <div className="flex items-center gap-4">
        {/* Notifications */}
        <button
          aria-label="Notifications"
          className="relative p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
        >
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-blue-500 rounded-full"></span>
        </button>

        {/* User Badge */}
        <div className="flex items-center gap-3 pl-4 border-l border-slate-800">
          <div className="w-8 h-8 rounded-full bg-blue-600/30 border border-blue-500/50 flex items-center justify-center text-blue-400 font-bold text-xs">
            {user?.name ? user.name[0].toUpperCase() : 'U'}
          </div>
          <div className="text-left hidden md:block">
            <div className="text-xs font-semibold text-slate-200">{user?.name || 'Administrator'}</div>
            <div className="text-[10px] font-bold tracking-wider text-blue-400 uppercase">{role === 'BOB' ? 'FIELD OPERATOR' : role}</div>
          </div>
        </div>
        <button onClick={logout} aria-label="Sign out" title="Sign out" className="rounded-lg p-2 text-slate-400 transition hover:bg-green-50 hover:text-red-600">
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
