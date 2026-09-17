'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import {
  Car,
  CheckCircle2,
  Clock,
  Wrench,
  ShieldAlert,
  ArrowRight,
  TrendingUp,
  Building,
  Loader2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { isValidLotNumber } from '@/lib/parking/lotValidation';

interface DashboardData {
  totalLots: number;
  occupiedLots: number;
  availableLots: number;
  pendingBobTasks: number;
  floorData: {
    floor: string;
    total: number;
    occupied: number;
    pending: number;
    available: number;
  }[];
  bobTasks: {
    install: number;
    removal: number;
    completedToday: number;
  };
  urgentBobRequests: DashboardRequestItem[];
  recentLogs: RecentLogEntry[];
}

type DashboardRequestItem = {
  id: string;
  status: string;
  request_type: string;
  request_number: string;
  created_at: string;
  completed_at?: string | null;
  parking_lots?: {
    floors?: { floor_code?: string } | null;
    lot_number?: string;
  } | null;
  vehicles?: {
    plate_number?: string;
  } | null;
  parking_assignments?: {
    parkers?: {
      name?: string;
      companies?: { name?: string } | null;
    } | null;
  } | null;
};

type RecentLogEntry = {
  id: string;
  created_at?: string | null;
  action?: string | null;
  description?: string | null;
  details?: string | null;
  users?: { name?: string } | null;
  [key: string]: unknown;
};

export default function DashboardPage() {
  const { role } = useAuth();
  const isBob = role === 'BOB';

  const getFloorCode = (lot: { floor?: { floor_code?: string } | Array<{ floor_code?: string }> | null }) => {
    const floorEntry = Array.isArray(lot.floor) ? lot.floor[0] : lot.floor;
    return floorEntry?.floor_code || 'GF';
  };

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState<DashboardData>({
    totalLots: 0,
    occupiedLots: 0,
    availableLots: 0,
    pendingBobTasks: 0,
    floorData: [],
    bobTasks: { install: 0, removal: 0, completedToday: 0 },
    urgentBobRequests: [],
    recentLogs: [],
  });

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch parking lots with floor info
        const { data: lots, error: lotsError } = await supabase
          .from('parking_lots')
          .select('lot_number, status, floor:floors(floor_code)');
        if (lotsError) setError(`Parking lots: ${lotsError.message}`);

        // Fetch Field Operator requests
        const { data: bobRequests, error: bobRequestsError } = await supabase
          .from('bob_requests')
          .select('*, parking_lots(*, floors(floor_code)), vehicles(plate_number), parking_assignments(parkers(name, companies(name)))')
          .order('created_at', { ascending: false });
        if (bobRequestsError) setError((current) => current || `Field Operator requests: ${bobRequestsError.message}`);

        // Fetch Activity logs
        const { data: logs, error: logsError } = await supabase
          .from('activity_logs')
          .select('*, users(name)')
          .order('created_at', { ascending: false })
          .limit(5);
        if (logsError) setError((current) => current || `Activity logs: ${logsError.message}`);

        // Calculate lots metrics
        let totalLots = 0;
        let occupiedLots = 0;
        let availableLots = 0;
        const floorMap = new Map<string, { total: number; occupied: number; pending: number; available: number }>();

        ['GF', 'P1', 'P2', 'P3'].forEach(f => floorMap.set(f, { total: 0, occupied: 0, pending: 0, available: 0 }));

        if (lots) {
          const validLots = lots.filter((lot) => isValidLotNumber(lot.lot_number));
          totalLots = validLots.length;
          validLots.forEach(lot => {
            const floor = getFloorCode(lot as { floor?: { floor_code?: string } | Array<{ floor_code?: string }> | null });
            if (!floorMap.has(floor)) {
              floorMap.set(floor, { total: 0, occupied: 0, pending: 0, available: 0 });
            }
            const fData = floorMap.get(floor)!;
            fData.total++;
            
            if (lot.status === 'OCCUPIED') {
              occupiedLots++;
              fData.occupied++;
            } else if (lot.status === 'AVAILABLE') {
              availableLots++;
              fData.available++;
            } else if (lot.status === 'PENDING_INSTALLATION' || lot.status === 'PENDING_REMOVAL') {
              fData.pending++;
            }
          });
        }

        const floorData = Array.from(floorMap.entries())
          .map(([floor, stats]) => ({ floor, ...stats }))
          .sort((a, b) => {
            const order = ['GF', 'P1', 'P2', 'P3'];
            return order.indexOf(a.floor) - order.indexOf(b.floor);
          });

        // Calculate Field Operator metrics
        let install = 0;
        let removal = 0;
        let completedToday = 0;
        const pendingRequests: DashboardRequestItem[] = [];

        if (bobRequests) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          bobRequests.forEach(req => {
            if (req.status !== 'COMPLETED' && req.status !== 'CANCELLED') {
              pendingRequests.push(req);
              if (req.request_type === 'INSTALLATION') install++;
              if (req.request_type === 'REMOVAL') removal++;
            } else if (req.status === 'COMPLETED' && req.completed_at) {
              const completedDate = new Date(req.completed_at);
              if (completedDate >= today) completedToday++;
            }
          });
        }

        setData({
          totalLots,
          occupiedLots,
          availableLots,
          pendingBobTasks: install + removal,
          floorData,
          bobTasks: { install, removal, completedToday },
          urgentBobRequests: pendingRequests,
          recentLogs: logs || [],
        });

      } catch (err) {
        console.error('Failed to fetch dashboard data:', err);
        setError(err instanceof Error ? err.message : 'Unable to load dashboard data from the database.');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (isBob) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-gradient-to-r from-blue-900/60 to-slate-900 p-6 rounded-xl border border-blue-800/40">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Wrench className="w-6 h-6 text-blue-400" />
            Field Operator Dashboard
          </h1>
          <p className="text-sm text-slate-300 mt-1">
            Physical Tag Installation & Removal Queue
          </p>
        </div>

        {/* Field Operator Summary Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-slate-400">Pending Install</div>
              <div className="text-3xl font-extrabold text-blue-400 mt-1">{data.bobTasks.install}</div>
            </div>
            <div className="w-12 h-12 bg-blue-500/10 border border-blue-500/30 rounded-lg flex items-center justify-center text-blue-400">
              <Wrench className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-slate-400">Pending Removal</div>
              <div className="text-3xl font-extrabold text-amber-400 mt-1">{data.bobTasks.removal}</div>
            </div>
            <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center justify-center text-amber-400">
              <ShieldAlert className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-slate-400">Completed Today</div>
              <div className="text-3xl font-extrabold text-emerald-400 mt-1">{data.bobTasks.completedToday}</div>
            </div>
            <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Urgent Task Cards for Field Operator */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-slate-200">Urgent Tasks</h2>
          
          {data.urgentBobRequests.length === 0 ? (
            <div className="text-sm text-slate-400 py-4 text-center">No urgent tasks pending.</div>
          ) : (
            data.urgentBobRequests.map(req => {
              const isInstall = req.request_type === 'INSTALLATION';
              const floorCode = req.parking_lots?.floors?.floor_code || '-';
              const lotNumber = req.parking_lots?.lot_number || '-';
              const plate = req.vehicles?.plate_number || '-';
              const parkerName = req.parking_assignments?.parkers?.name || '-';
              const companyName = req.parking_assignments?.parkers?.companies?.name || '-';
              
              return (
                <div key={req.id} className={`bg-slate-900 border ${isInstall ? 'border-blue-500/40 hover:border-blue-500' : 'border-amber-500/40 hover:border-amber-500'} rounded-xl p-5 transition-colors`}>
                  <div className="flex items-center justify-between mb-3">
                    <span className={`px-2.5 py-1 text-xs font-bold ${isInstall ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-amber-500/20 text-amber-400 border-amber-500/30'} border rounded`}>
                      {isInstall ? 'INSTALLATION' : 'REMOVAL'} ({req.request_number})
                    </span>
                    <span className="text-xs text-slate-400">Created: {formatDistanceToNow(new Date(req.created_at))} ago</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-4">
                    <div>
                      <div className="text-xs text-slate-500">Location</div>
                      <div className="font-bold text-slate-200">{floorCode} - Lot {lotNumber}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Vehicle Plate</div>
                      <div className={`font-extrabold ${isInstall ? 'text-blue-400' : 'text-amber-400'}`}>{plate}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Parker</div>
                      <div className="font-semibold text-slate-300">{parkerName}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Company</div>
                      <div className="font-semibold text-slate-300">{companyName}</div>
                    </div>
                  </div>
                  <Link
                    href={`/bob/requests?search=${req.request_number}`}
                    className={`w-full inline-flex items-center justify-center gap-2 py-2.5 ${isInstall ? 'bg-blue-600 hover:bg-blue-500' : 'bg-amber-600 hover:bg-amber-500'} text-white font-bold text-xs rounded-lg transition-colors`}
                  >
                    {isInstall ? <Wrench className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />} 
                    View & Confirm {isInstall ? 'Installation' : 'Removal'}
                  </Link>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  const utilizationRate = data.totalLots > 0 ? Math.round((data.occupiedLots / data.totalLots) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Executive Dashboard</h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time status of Reserved Parking & Field Operator Operations
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/parking/layout"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg shadow-lg flex items-center gap-2 transition-colors"
          >
            <Car className="w-4 h-4" /> + Assign Parking
          </Link>
          <Link
            href="/import"
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 flex items-center gap-2 transition-colors"
          >
            <Building className="w-4 h-4" /> Excel Import
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
          Dashboard data warning: {error}
        </div>
      )}

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
          <div className="text-xs font-medium text-slate-400">Total Reserved Lots</div>
          <div className="text-3xl font-extrabold text-slate-100 mt-1">{data.totalLots}</div>
          <div className="text-[11px] text-slate-500 mt-2 flex items-center gap-1">
            <Building className="w-3 h-3 text-slate-400" /> Floors GF, P1, P2, P3
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
          <div className="text-xs font-medium text-slate-400">Occupied Lots</div>
          <div className="text-3xl font-extrabold text-blue-400 mt-1">{data.occupiedLots}</div>
          <div className="text-[11px] text-emerald-400 mt-2 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> {utilizationRate}% Utilization Rate
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
          <div className="text-xs font-medium text-slate-400">Available Lots</div>
          <div className="text-3xl font-extrabold text-emerald-400 mt-1">{data.availableLots}</div>
          <div className="text-[11px] text-slate-500 mt-2">Ready for allocation</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
          <div className="text-xs font-medium text-slate-400">Pending Field Operator Tasks</div>
          <div className="text-3xl font-extrabold text-amber-400 mt-1">{data.pendingBobTasks}</div>
          <div className="text-[11px] text-amber-400/80 mt-2">{data.bobTasks.install} Install / {data.bobTasks.removal} Removal</div>
        </div>
      </div>

      {/* Floor Occupancy Grid */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h2 className="text-base font-bold text-slate-200 mb-4 flex items-center justify-between">
          <span>Floor Capacity Breakdown</span>
          <Link href="/parking/layout" className="text-xs text-blue-400 hover:underline flex items-center gap-1">
            View Full Layout <ArrowRight className="w-3 h-3" />
          </Link>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {data.floorData.map((f) => (
            <div key={f.floor} className="bg-slate-950 border border-slate-800/80 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-extrabold text-lg text-blue-400">{f.floor}</span>
                <span className="text-xs font-semibold px-2 py-0.5 bg-slate-800 rounded text-slate-300">
                  {f.total > 0 ? Math.round((f.occupied / f.total) * 100) : 0}% Occupied
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mb-3">
                <div
                  className="bg-blue-500 h-full rounded-full"
                  style={{ width: `${f.total > 0 ? (f.occupied / f.total) * 100 : 0}%` }}
                ></div>
              </div>

              <div className="grid grid-cols-3 text-[11px] text-center text-slate-400">
                <div>
                  <div className="font-semibold text-slate-200">{f.occupied}</div>
                  <div>Occupied</div>
                </div>
                <div>
                  <div className="font-semibold text-amber-400">{f.pending}</div>
                  <div>Pending</div>
                </div>
                <div>
                  <div className="font-semibold text-emerald-400">{f.available}</div>
                  <div>Available</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Activity & Field Operator Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Field Operator Pending Operations */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-200 flex items-center gap-2">
              <Wrench className="w-4 h-4 text-blue-400" /> Pending Field Operator Actions
            </h3>
            <Link href="/bob/requests" className="text-xs text-blue-400 hover:underline">
              Manage Queue
            </Link>
          </div>

          <div className="space-y-3">
            {data.urgentBobRequests.slice(0, 3).map(req => {
              const isInstall = req.request_type === 'INSTALLATION';
              const floorCode = req.parking_lots?.floors?.floor_code || '-';
              const lotNumber = req.parking_lots?.lot_number || '-';
              const plate = req.vehicles?.plate_number || '-';
              const parkerName = req.parking_assignments?.parkers?.name || '-';

              return (
                <div key={req.id} className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between">
                  <div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 ${isInstall ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'} rounded`}>
                      {isInstall ? 'INSTALLATION' : 'REMOVAL'}
                    </span>
                    <div className="text-xs font-semibold text-slate-200 mt-1">{req.request_number} ({floorCode} - Lot {lotNumber})</div>
                    <div className="text-[11px] text-slate-400">{parkerName} | Plate: {plate}</div>
                  </div>
                  <Link
                    href={`/bob/requests?search=${req.request_number}`}
                    className={`px-3 py-1.5 ${isInstall ? 'bg-blue-600 hover:bg-blue-500' : 'bg-amber-600 hover:bg-amber-500'} text-white text-xs font-semibold rounded`}
                  >
                    Inspect
                  </Link>
                </div>
              );
            })}
            
            {data.urgentBobRequests.length === 0 && (
              <div className="text-sm text-slate-400 py-4 text-center border border-dashed border-slate-700 rounded-lg">
                No pending actions.
              </div>
            )}
          </div>
        </div>

        {/* Recent Audit Log */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-200 flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-400" /> Recent Operations Audit
            </h3>
            <Link href="/history/audit-log" className="text-xs text-blue-400 hover:underline">
              View Log
            </Link>
          </div>

          <div className="space-y-3">
            {data.recentLogs.map((log) => {
              const logDate = log.created_at ? new Date(log.created_at) : new Date();
              const logText = typeof log.description === 'string' && log.description
                ? log.description
                : typeof log.action === 'string' && log.action
                  ? log.action
                  : 'System activity';

              return (
                <div key={log.id} className="text-xs p-3 bg-slate-950 border border-slate-800/80 rounded-lg">
                  <div className="flex items-center justify-between text-slate-400 mb-1">
                    <span className="font-semibold text-blue-400">{log.users?.name || 'System'}</span>
                    <span className="text-[10px] text-slate-500">{formatDistanceToNow(logDate)} ago</span>
                  </div>
                  <div className="text-slate-300 font-medium">{logText}</div>
                </div>
              );
            })}
            
            {data.recentLogs.length === 0 && (
              <div className="text-sm text-slate-400 py-4 text-center border border-dashed border-slate-700 rounded-lg">
                No recent activity.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
