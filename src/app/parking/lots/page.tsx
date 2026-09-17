'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Filter, MapPin, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { isValidLotNumber } from '@/lib/parking/lotValidation';

interface LotRow {
  id: string;
  lot_number: string;
  status: string;
  allocation_type: string;
  floor: { floor_code: string } | null;
  allocated_company: { name: string } | null;
}

const statusOptions = ['ALL', 'AVAILABLE', 'OCCUPIED', 'PENDING_INSTALLATION', 'PENDING_REMOVAL', 'MAINTENANCE'];

export default function ParkingLotsPage() {
  const [lots, setLots] = useState<LotRow[]>([]);
  const [floor, setFloor] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadLots = async () => {
      const { data, error: queryError } = await supabase
        .from('parking_lots')
        .select('id, lot_number, status, allocation_type, floor:floors(floor_code), allocated_company:companies(name)')
        .order('lot_number');
      if (queryError) setError(queryError.message);
      else setLots(((data || []) as unknown as LotRow[]).filter((lot) => isValidLotNumber(lot.lot_number)));
      setLoading(false);
    };
    loadLots();
  }, []);

  const floors = useMemo(() => ['ALL', ...Array.from(new Set(lots.map((lot) => lot.floor?.floor_code).filter(Boolean)))], [lots]);
  const filtered = lots.filter((lot) => {
    const query = search.toLowerCase().trim();
    return (
      (floor === 'ALL' || lot.floor?.floor_code === floor) &&
      (status === 'ALL' || lot.status === status) &&
      (!query || `${lot.lot_number} ${lot.floor?.floor_code || ''} ${lot.allocated_company?.name || ''}`.toLowerCase().includes(query))
    );
  });

  const badgeClass = (value: string) => {
    if (value === 'AVAILABLE') return 'layout-status layout-status-available';
    if (value === 'OCCUPIED') return 'layout-status layout-status-occupied';
    if (value === 'PENDING_REMOVAL') return 'layout-status layout-status-removal';
    return 'layout-status layout-status-installation';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2"><MapPin className="w-6 h-6 text-blue-400" /> Parking Lots</h1>
        <p className="text-xs text-slate-400 mt-1">Inventory, allocation, and live status of every reserved parking lot</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          ['Total Lots', lots.length],
          ['Available', lots.filter((lot) => lot.status === 'AVAILABLE').length],
          ['Occupied', lots.filter((lot) => lot.status === 'OCCUPIED').length],
          ['Pending Action', lots.filter((lot) => lot.status.startsWith('PENDING')).length],
        ].map(([label, value]) => <div key={String(label)} className="bg-slate-900 border border-slate-800 rounded-xl p-4"><div className="text-xs text-slate-400">{label}</div><div className="text-2xl font-extrabold text-slate-100 mt-1">{value}</div></div>)}
      </div>
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1"><Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search lot, floor, or company..." className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200" /></div>
        <select value={floor} onChange={(event) => setFloor(event.target.value)} className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200">{floors.map((item) => <option key={item}>{item}</option>)}</select>
        <select value={status} onChange={(event) => setStatus(event.target.value)} className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200"><option>ALL</option>{statusOptions.slice(1).map((item) => <option key={item}>{item}</option>)}</select>
        <Filter className="hidden md:block w-4 h-4 text-green-700 self-center" />
      </div>
      {error && <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-bold">{error}</div>}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="bg-slate-950 text-slate-400 uppercase"><tr><th className="p-4">Lot</th><th className="p-4">Floor</th><th className="p-4">Allocation</th><th className="p-4">Company Block</th><th className="p-4">Status</th></tr></thead><tbody className="divide-y divide-slate-800/60">{loading ? <tr><td colSpan={5} className="p-8 text-center text-slate-500">Loading parking lots...</td></tr> : filtered.map((lot) => <tr key={lot.id} className="hover:bg-slate-800/40"><td className="p-4 font-extrabold text-slate-100">Lot {lot.lot_number}</td><td className="p-4 font-bold text-green-700">{lot.floor?.floor_code || '-'}</td><td className="p-4 text-slate-300">{lot.allocation_type}</td><td className="p-4 text-slate-300">{lot.allocated_company?.name || 'Open allocation'}</td><td className="p-4"><span className={badgeClass(lot.status)}>{lot.status.replaceAll('_', ' ')}</span></td></tr>)}</tbody></table></div>
      </div>
    </div>
  );
}
