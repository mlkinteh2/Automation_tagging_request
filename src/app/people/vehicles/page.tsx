'use client';

import React, { useState } from 'react';
import { Car, Search, User, Building2, CheckCircle2, History, Tag } from 'lucide-react';

export default function VehicleSearchPage() {
  const [query, setQuery] = useState('JWW1076');
  const [searched, setSearched] = useState(true);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <Car className="w-6 h-6 text-blue-400" /> Dedicated Vehicle Search
        </h1>
        <p className="text-xs text-slate-400 mt-1">Lookup vehicle registration details, current assignment, and tag history</p>
      </div>

      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter vehicle number plate (e.g. JWW1076)..."
            className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 pl-9 pr-4 py-2.5 rounded-lg focus:outline-none focus:border-blue-500 uppercase font-mono font-bold"
          />
        </div>
        <button
          onClick={() => setSearched(true)}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg shadow-md transition-colors"
        >
          Search Vehicle
        </button>
      </div>

      {searched && (
        <div className="space-y-6">
          {/* Main Vehicle Result Card */}
          <div className="bg-slate-900 border border-blue-500/40 rounded-xl p-6 shadow-xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 pb-4 mb-4 gap-4">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Vehicle Plate</span>
                <span className="text-3xl font-extrabold text-blue-400 font-mono tracking-widest">{query.toUpperCase()}</span>
              </div>
              <div className="flex gap-2">
                <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold text-xs rounded-lg flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Assignment: ACTIVE
                </span>
                <span className="px-3 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/30 font-bold text-xs rounded-lg flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5" /> Tag: INSTALLED
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs">
              <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                <span className="text-slate-500 flex items-center gap-1 mb-1">
                  <User className="w-3.5 h-3.5 text-blue-400" /> Parker Name
                </span>
                <span className="text-sm font-bold text-slate-200">OKAMOTO YOSHIKI</span>
              </div>

              <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                <span className="text-slate-500 flex items-center gap-1 mb-1">
                  <Building2 className="w-3.5 h-3.5 text-blue-400" /> Company
                </span>
                <span className="text-sm font-bold text-slate-200">OKAKICHI</span>
              </div>

              <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                <span className="text-slate-500 flex items-center gap-1 mb-1">
                  <Car className="w-3.5 h-3.5 text-emerald-400" /> Current Reserved Lot
                </span>
                <span className="text-sm font-extrabold text-emerald-400">P1 - Lot 13</span>
              </div>
            </div>
          </div>

          {/* Historical Assignments Timeline (Requirement 28) */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-200 flex items-center gap-2">
              <History className="w-5 h-5 text-blue-400" /> Complete Assignment History
            </h2>

            <div className="space-y-3">
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg text-xs flex flex-col md:flex-row md:items-center justify-between gap-2">
                <div>
                  <div className="font-bold text-slate-200">P1 - Lot 13</div>
                  <div className="text-slate-400">Assigned by Admin on 17 Aug 2026</div>
                </div>
                <span className="px-2.5 py-1 bg-blue-500/20 text-blue-400 font-bold rounded self-start md:self-auto">
                  CURRENT ACTIVE
                </span>
              </div>

              <div className="p-4 bg-slate-950 border border-slate-800/60 rounded-lg text-xs flex flex-col md:flex-row md:items-center justify-between gap-2 opacity-70">
                <div>
                  <div className="font-bold text-slate-300">P2 - Lot 41</div>
                  <div className="text-slate-500">Duration: 01 Jan 2026 - 15 Aug 2026 (Reason: Transferred to P1)</div>
                </div>
                <span className="px-2.5 py-1 bg-slate-800 text-slate-400 font-bold rounded self-start md:self-auto">
                  TRANSFERRED
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
