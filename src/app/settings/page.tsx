'use client';

import React from 'react';
import { Database, Settings, ShieldCheck } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div><h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2"><Settings className="w-6 h-6 text-blue-400" /> Settings</h1><p className="text-xs text-slate-400 mt-1">System configuration and connection status</p></div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5"><div className="flex items-center gap-3 mb-3"><Database className="w-5 h-5 text-green-700" /><h2 className="font-bold text-slate-100">Database</h2></div><p className="text-xs text-slate-400">Supabase data source is configured for live parking, parker, vehicle, and Field Operator request records.</p><span className="inline-flex mt-4 layout-status layout-status-available">CONNECTED</span></div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5"><div className="flex items-center gap-3 mb-3"><ShieldCheck className="w-5 h-5 text-green-700" /><h2 className="font-bold text-slate-100">Access Control</h2></div><p className="text-xs text-slate-400">Role-based navigation is available for Administrator, Supervisor, and Field Operator operations.</p><span className="inline-flex mt-4 layout-status layout-status-installation">SIMULATOR MODE</span></div>
      </div>
    </div>
  );
}
