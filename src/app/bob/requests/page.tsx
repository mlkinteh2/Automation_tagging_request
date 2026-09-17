'use client';

import React, { useEffect, useState } from 'react';
import { Wrench, CheckCircle2, Download, Check, MapPin, CarFront, Building2, Clock3, ListFilter } from 'lucide-react';
import { generateNumberPlateDoc } from '@/lib/docx/generateTagDoc';
import { supabase } from '@/lib/supabase/client';
import { ParkingService } from '@/services/parkingService';
import { useAuth } from '@/context/AuthContext';

interface BobTask {
  id: string;
  requestNumber: string;
  type: 'INSTALLATION' | 'REMOVAL';
  parker: string;
  company: string;
  plate: string;
  floor: string;
  lot: string;
  status: 'PENDING' | 'COMPLETED';
  createdAt: string;
}

interface BobRequestsPageProps {
  initialFilter?: 'ALL' | 'INSTALLATION' | 'REMOVAL' | 'PENDING' | 'COMPLETED';
}

interface BobRequestRow {
  id: string;
  request_number: string;
  request_type: BobTask['type'];
  status: BobTask['status'];
  created_at: string;
  assignment?: {
    parker?: { name: string; company?: { name: string } | null } | null;
  } | null;
  parking_lot?: { lot_number: string; floor?: { floor_code: string } | null } | null;
  vehicle?: { plate_number: string } | null;
}

export default function BobRequestsPage({ initialFilter = 'ALL' }: BobRequestsPageProps) {
  const { role } = useAuth();
  const canCompleteTasks = role === 'BOB';
  const [tasks, setTasks] = useState<BobTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'INSTALLATION' | 'REMOVAL' | 'PENDING' | 'COMPLETED'>(initialFilter);
  const [selectedTask, setSelectedTask] = useState<BobTask | null>(null);
  const [notes, setNotes] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const fetchTasks = async () => {
    setLoading(true);
    setLoadError('');
    const { data, error } = await supabase
      .from('bob_requests')
      .select(`
        id, request_number, request_type, status, created_at,
        assignment:parking_assignments(parker:parkers(name, company:companies(name))),
        parking_lot:parking_lots(lot_number, floor:floors(floor_code)),
        vehicle:vehicles(plate_number)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      setLoadError(error.message);
      setTasks([]);
    } else {
      setTasks((data as unknown as BobRequestRow[]).map((request) => ({
        id: request.id,
        requestNumber: request.request_number,
        type: request.request_type,
        parker: request.assignment?.parker?.name || 'Unknown parker',
        company: request.assignment?.parker?.company?.name || 'No company',
        plate: request.vehicle?.plate_number || 'Unknown plate',
        floor: request.parking_lot?.floor?.floor_code || 'Unknown floor',
        lot: request.parking_lot?.lot_number || 'Unknown lot',
        status: request.status === 'COMPLETED' ? 'COMPLETED' : 'PENDING',
        createdAt: new Date(request.created_at).toLocaleString(),
      })));
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const filtered = tasks.filter((t) => {
    if (filter === 'INSTALLATION') return t.type === 'INSTALLATION';
    if (filter === 'REMOVAL') return t.type === 'REMOVAL';
    if (filter === 'PENDING') return t.status === 'PENDING';
    if (filter === 'COMPLETED') return t.status === 'COMPLETED';
    return true;
  });

  const handleDownloadDoc = async (task: BobTask) => {
    try {
      const buffer = await generateNumberPlateDoc({
        requestNumber: task.requestNumber,
        plateNumber: task.plate,
        floorCode: task.floor,
        lotNumber: task.lot,
        parkerName: task.parker,
        companyName: task.company,
      });

      const uint8Array = new Uint8Array(buffer);
      const blob = new Blob([uint8Array], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${task.requestNumber}_${task.plate}_${task.floor}-${task.lot}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
    }
  };

  const confirmCompletion = async () => {
    if (!selectedTask) return;
    try {
      if (selectedTask.type === 'INSTALLATION') {
        await ParkingService.completeBobInstallation({ requestId: selectedTask.id, notes });
      } else {
        await ParkingService.completeBobRemoval({ requestId: selectedTask.id, notes });
      }
      setSuccessMsg(`Successfully confirmed completion for ${selectedTask.requestNumber}!`);
      setSelectedTask(null);
      setNotes('');
      await fetchTasks();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unable to complete this Field Operator request.');
    }
  };

  const pendingCount = tasks.filter((task) => task.status === 'PENDING').length;
  const completedCount = tasks.filter((task) => task.status === 'COMPLETED').length;
  const installationCount = tasks.filter((task) => task.type === 'INSTALLATION').length;
  const removalCount = tasks.filter((task) => task.type === 'REMOVAL').length;

  return (
    <div className="space-y-5 pb-8">
      <div className="relative overflow-hidden rounded-2xl border border-green-700/20 bg-gradient-to-br from-white via-green-50/80 to-amber-50/60 px-5 py-5 shadow-[0_10px_28px_rgba(13,115,48,0.08)] sm:px-6">
        <div className="absolute right-0 top-0 h-32 w-32 translate-x-10 -translate-y-10 rounded-full border-[18px] border-amber-400/15" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-100/70 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.16em] text-amber-700">
              <Wrench className="h-3.5 w-3.5" /> Field operations
            </div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-100 sm:text-3xl">
              Field Operator Tag Queue
          </h1>
            <p className="mt-1 text-sm text-slate-500">Physical signboard installation and removal tasks</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ['Pending', pendingCount, 'text-amber-700'],
              ['Completed', completedCount, 'text-emerald-700'],
              ['Install', installationCount, 'text-blue-700'],
              ['Removal', removalCount, 'text-orange-700'],
            ].map(([label, value, color]) => (
              <div key={label} className="min-w-[72px] rounded-xl border border-green-700/15 bg-white/75 px-3 py-2 backdrop-blur-sm">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
                <div className={`mt-0.5 text-xl font-extrabold ${color}`}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 text-xs font-bold rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5" />
          {successMsg}
        </div>
      )}

      {loadError && (
        <div className="p-4 bg-red-500/10 border border-red-500/40 text-red-400 text-xs font-bold rounded-xl">
          {loadError}
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-col gap-3 rounded-xl border border-green-700/15 bg-white/70 p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
          <ListFilter className="h-4 w-4 text-amber-500" /> Filter queue
        </div>
        <div className="flex flex-wrap gap-2">
        {(['ALL', 'INSTALLATION', 'REMOVAL', 'PENDING', 'COMPLETED'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-4 py-2 text-xs font-bold rounded-lg border transition-colors ${
              filter === tab
                  ? 'bg-green-700 border-green-700 text-white shadow-md shadow-green-700/20'
                  : 'bg-white border-green-700/15 text-slate-500 hover:border-amber-400/60 hover:text-green-800'
            }`}
          >
            {tab}
          </button>
        ))}
        </div>
      </div>

      {/* Requests List */}
      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          <div className="p-12 text-center text-slate-500 bg-slate-900 border border-slate-800 rounded-xl">
            Loading Field Operator requests...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-500 bg-slate-900 border border-slate-800 rounded-xl">
            No Field Operator requests found for filter "{filter}".
          </div>
        ) : (
          filtered.map((t) => (
            <div
              key={t.id}
              className={`group relative overflow-hidden rounded-2xl border bg-white p-4 shadow-[0_5px_18px_rgba(13,115,48,0.06)] transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(13,115,48,0.11)] sm:p-5 ${
                t.status === 'PENDING'
                  ? t.type === 'INSTALLATION'
                    ? 'border-blue-500/35'
                    : 'border-amber-500/45'
                  : 'border-green-700/15 opacity-85'
              }`}
            >
              <div className={`absolute inset-y-0 left-0 w-1 ${t.type === 'INSTALLATION' ? 'bg-blue-500' : 'bg-amber-400'}`} />
              <div className="flex flex-col gap-5 pl-2 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[10px] font-extrabold tracking-wide ${
                        t.type === 'INSTALLATION'
                          ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                      }`}
                    >
                      {t.type}
                    </span>
                    <span className="text-base font-extrabold text-slate-200">{t.requestNumber}</span>
                    <span className="flex items-center gap-1 text-[11px] text-slate-400"><Clock3 className="h-3.5 w-3.5" /> {t.createdAt}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-xs sm:grid-cols-4">
                    <div>
                      <span className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-400"><MapPin className="h-3 w-3" /> Location</span>
                      <span className="font-extrabold text-slate-200">Floor {t.floor} · Lot {t.lot}</span>
                    </div>
                    <div>
                      <span className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-400"><CarFront className="h-3 w-3" /> Vehicle plate</span>
                      <span className="font-mono text-sm font-extrabold tracking-wide text-blue-400">{t.plate}</span>
                    </div>
                    <div>
                      <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">Parker</span>
                      <span className="font-semibold text-slate-300">{t.parker}</span>
                    </div>
                    <div>
                      <span className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-400"><Building2 className="h-3 w-3" /> Company</span>
                      <span className="font-semibold text-slate-300">{t.company}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end md:self-auto">
                  {/* Download DOCX (INSTALLATION ONLY - Requirement 14) */}
                  {t.type === 'INSTALLATION' && (
                    <button
                      onClick={() => handleDownloadDoc(t)}
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 flex items-center gap-1.5 transition-colors"
                      title="Download Word Document Number Plate"
                    >
                      <Download className="w-3.5 h-3.5 text-blue-400" />
                      Number Plate (.docx)
                    </button>
                  )}

                  {t.status === 'PENDING' && canCompleteTasks ? (
                    <button
                      onClick={() => setSelectedTask(t)}
                      className={`px-4 py-2 text-xs font-bold text-white rounded-lg shadow-md flex items-center gap-1.5 transition-colors ${
                        t.type === 'INSTALLATION'
                          ? 'bg-blue-600 hover:bg-blue-500'
                          : 'bg-amber-600 hover:bg-amber-500'
                      }`}
                    >
                      <Check className="w-4 h-4" />
                      Confirm {t.type === 'INSTALLATION' ? 'Installed' : 'Removed'}
                    </button>
                  ) : t.status === 'COMPLETED' ? (
                    <span className="px-3 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-bold rounded-lg flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Completed
                    </span>
                  ) : (
                    <span className="px-3 py-1.5 bg-slate-800 text-slate-400 border border-slate-700 text-xs font-bold rounded-lg">Pending</span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Confirmation Modal */}
      {selectedTask && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-blue-400" />
              Confirm {selectedTask.type} Completion
            </h3>

            <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Request:</span>
                <span className="font-bold text-slate-200">{selectedTask.requestNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Location:</span>
                <span className="font-bold text-slate-200">Floor {selectedTask.floor} - Lot {selectedTask.lot}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Plate:</span>
                <span className="font-bold text-blue-400">{selectedTask.plate}</span>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Completion Notes (Optional):
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Tag physically attached to lot wall."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 focus:outline-none focus:border-blue-500 h-20"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setSelectedTask(null)}
                className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-semibold rounded-lg hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={confirmCompletion}
                className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-500 shadow-lg"
              >
                Confirm Completion
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
