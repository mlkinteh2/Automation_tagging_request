'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Building2, Car, ClipboardList, MapPin, UserRound } from 'lucide-react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

interface ParkerDetail {
  id: string;
  name: string;
  status: string;
  contact_number: string | null;
  email: string | null;
  company: { id: string; name: string } | null;
  vehicles: { id: string; plate_number: string; status: string }[];
  parking_assignments: {
    id: string;
    status: string;
    start_date: string;
    end_date: string | null;
    parking_lot: { lot_number: string; floor: { floor_code: string } | null } | null;
  }[];
}

interface BobRequest {
  id: string;
  request_number: string;
  request_type: string;
  status: string;
  created_at: string;
}

export default function ParkerDetailPage() {
  const params = useParams<{ id: string }>();
  const [parker, setParker] = useState<ParkerDetail | null>(null);
  const [requests, setRequests] = useState<BobRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadParker = async () => {
      if (!params.id) return;
      const [{ data, error: parkerError }, { data: requestData, error: requestError }] = await Promise.all([
        supabase.from('parkers').select(`id, name, status, contact_number, email, company:companies(id, name), vehicles(id, plate_number, status), parking_assignments(id, status, start_date, end_date, parking_lot:parking_lots(lot_number, floor:floors(floor_code)))`).eq('id', params.id).single(),
        supabase.from('bob_requests').select('id, request_number, request_type, status, created_at, assignment:parking_assignments!inner(parker_id)').eq('assignment.parker_id', params.id).order('created_at', { ascending: false }),
      ]);
      if (parkerError || requestError) setError(parkerError?.message || requestError?.message || 'Unable to load parker.');
      else {
        setParker(data as unknown as ParkerDetail);
        setRequests((requestData || []) as unknown as BobRequest[]);
      }
      setLoading(false);
    };
    loadParker();
  }, [params.id]);

  if (loading) return <div className="p-10 text-sm text-slate-500">Loading parker profile...</div>;
  if (error || !parker) return <div className="space-y-4"><Link href="/people/parkers" className="text-sm text-green-700 font-bold">Back to Parkers</Link><div className="p-5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">{error || 'Parker not found.'}</div></div>;

  const activeAssignment = parker.parking_assignments.find((assignment) => assignment.status === 'ACTIVE');

  return (
    <div className="space-y-6 max-w-6xl">
      <Link href="/people/parkers" className="inline-flex items-center gap-2 text-xs font-bold text-green-700 hover:text-green-900"><ArrowLeft className="w-4 h-4" /> Back to Parkers</Link>
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="flex items-center gap-4"><div className="w-14 h-14 rounded-xl bg-green-100 text-green-700 flex items-center justify-center"><UserRound className="w-7 h-7" /></div><div><h1 className="text-2xl font-bold text-slate-100">{parker.name}</h1><div className="text-xs text-slate-400 mt-1 flex items-center gap-2"><Building2 className="w-3.5 h-3.5" /> {parker.company?.name || 'No company'}</div></div></div>
        <span className={parker.status === 'ACTIVE' ? 'layout-status layout-status-available' : 'layout-status layout-status-default'}>{parker.status}</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5"><div className="text-xs text-slate-500">Registered Vehicles</div><div className="text-3xl font-extrabold text-green-700 mt-1">{parker.vehicles.filter((vehicle) => vehicle.status === 'ACTIVE').length}</div></div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5"><div className="text-xs text-slate-500">Current Assignment</div><div className="text-xl font-extrabold text-green-700 mt-2">{activeAssignment ? `${activeAssignment.parking_lot?.floor?.floor_code}-${activeAssignment.parking_lot?.lot_number}` : 'Unassigned'}</div></div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5"><div className="text-xs text-slate-500">Field Operator Requests</div><div className="text-3xl font-extrabold text-green-700 mt-1">{requests.length}</div></div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden"><div className="p-5 border-b border-slate-800 flex items-center gap-2"><Car className="w-5 h-5 text-orange-500" /><h2 className="font-bold text-slate-100">Registered Vehicles</h2></div><div className="p-5 space-y-2">{parker.vehicles.map((vehicle) => <div key={vehicle.id} className="flex items-center justify-between p-3 bg-slate-950 rounded-lg"><span className="font-mono font-bold text-green-700">{vehicle.plate_number}</span><span className={vehicle.status === 'ACTIVE' ? 'layout-status layout-status-available' : 'layout-status layout-status-default'}>{vehicle.status}</span></div>)}</div></section>
        <section className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden"><div className="p-5 border-b border-slate-800 flex items-center gap-2"><MapPin className="w-5 h-5 text-orange-500" /><h2 className="font-bold text-slate-100">Assignment History</h2></div><div className="p-5 space-y-2">{parker.parking_assignments.map((assignment) => <div key={assignment.id} className="p-3 bg-slate-950 rounded-lg"><div className="flex items-center justify-between"><span className="font-bold text-slate-100">{assignment.parking_lot?.floor?.floor_code}-{assignment.parking_lot?.lot_number}</span><span className="text-xs font-bold text-green-700">{assignment.status}</span></div><div className="text-[11px] text-slate-500 mt-1">{assignment.start_date}{assignment.end_date ? ` to ${assignment.end_date}` : ' to present'}</div></div>)}</div></section>
      </div>
      <section className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden"><div className="p-5 border-b border-slate-800 flex items-center gap-2"><ClipboardList className="w-5 h-5 text-orange-500" /><h2 className="font-bold text-slate-100">Field Operator Request History</h2></div><div className="divide-y divide-slate-800">{requests.length === 0 ? <div className="p-5 text-xs text-slate-500">No Field Operator requests for this parker.</div> : requests.map((request) => <div key={request.id} className="p-4 flex items-center justify-between"><div><div className="font-bold text-slate-100">{request.request_number}</div><div className="text-xs text-slate-500">{request.request_type} · {new Date(request.created_at).toLocaleString()}</div></div><span className={request.status === 'COMPLETED' ? 'layout-status layout-status-available' : 'layout-status layout-status-installation'}>{request.status}</span></div>)}</div></section>
    </div>
  );
}
