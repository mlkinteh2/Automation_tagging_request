'use client';

import React, { useEffect, useState } from 'react';
import { History, ShieldCheck, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';

interface ActivityLogRow {
  id: string;
  action: string;
  entity_type: string;
  description: string;
  created_at: string;
  users: { name: string } | null;
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<ActivityLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const loadLogs = async () => {
      const { data, error: queryError } = await supabase
        .from('activity_logs')
        .select('id, action, entity_type, description, created_at, users(name)')
        .order('created_at', { ascending: false })
        .limit(200);
      if (queryError) setError(queryError.message);
      else setLogs((data || []) as unknown as ActivityLogRow[]);
      setLoading(false);
    };
    loadLogs();
  }, []);

  const filtered = logs.filter((log) => {
    const query = search.toLowerCase().trim();
    if (!query) return true;
    return `${log.action} ${log.entity_type} ${log.description} ${log.users?.name || ''}`.toLowerCase().includes(query);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <History className="w-6 h-6 text-blue-400" /> Immutable Activity Audit Log
          </h1>
          <p className="text-xs text-slate-400 mt-1">Complete security audit trail of all operations (Requirement 27)</p>
        </div>
        <div className="px-3 py-1.5 bg-slate-900 border border-slate-800 text-xs font-semibold text-emerald-400 rounded-lg flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4" /> Audit Logs Protected (Read-Only)
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
        <div className="relative w-full max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search action, entity, user, or description..."
            className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 pl-9 pr-4 py-2 rounded-lg focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {error && <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-bold">{error}</div>}

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 font-semibold uppercase">
              <th className="p-4">Timestamp</th>
              <th className="p-4">User</th>
              <th className="p-4">Action</th>
              <th className="p-4">Entity Type</th>
              <th className="p-4">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {loading ? (
              <tr><td colSpan={5} className="p-8 text-center text-slate-500">Loading activity logs...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-slate-500">No activity log entries found.</td></tr>
            ) : (
              filtered.map((log) => (
                <tr key={log.id} className="hover:bg-slate-800/40">
                  <td className="p-4 text-slate-400 whitespace-nowrap">{new Date(log.created_at).toLocaleString()}</td>
                  <td className="p-4 font-bold text-blue-400">{log.users?.name || 'System'}</td>
                  <td className="p-4">
                    <span className="px-2 py-0.5 bg-slate-800 text-slate-200 font-bold rounded text-[10px]">
                      {log.action}
                    </span>
                  </td>
                  <td className="p-4 text-slate-400">{log.entity_type}</td>
                  <td className="p-4 font-sans text-slate-200">{log.description}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}