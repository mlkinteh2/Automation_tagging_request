'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Users, Search, Building2, X, Save, ArrowRightLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { ParkingService } from '@/services/parkingService';
import { useAuth } from '@/context/AuthContext';
import { isValidLotNumber } from '@/lib/parking/lotValidation';

interface ParkerData {
  id: string;
  name: string;
  status: string;
  company: { id: string; name: string } | null;
  vehicles: { id: string; plate_number: string; status: string }[];
  parking_assignments: {
    id: string;
    status: string;
    parking_lot: {
      lot_number: string;
      floor: { floor_code: string };
    };
  }[];
}

interface AvailableLot {
  id: string;
  lot_number: string;
  floor: { floor_code: string } | null;
}

export default function ParkersPage() {
  const { user, role } = useAuth();
  const [search, setSearch] = useState('');
  const [parkers, setParkers] = useState<ParkerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingParker, setEditingParker] = useState<ParkerData | null>(null);
  const [editForm, setEditForm] = useState({ name: '', companyName: '', plates: '' });
  const [transferringParker, setTransferringParker] = useState<ParkerData | null>(null);
  const [transferAssignmentId, setTransferAssignmentId] = useState('');
  const [availableLots, setAvailableLots] = useState<AvailableLot[]>([]);
  const [selectedLotId, setSelectedLotId] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);

  const fetchParkers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('parkers')
      .select(`
        id,
        name,
        status,
        company:companies(id, name),
        vehicles(id, plate_number, status),
        parking_assignments(
          id,
          status,
          parking_lot:parking_lots(
            lot_number,
            floor:floors(floor_code)
          )
        )
      `)
      .order('name');

    if (data) {
      setParkers(data as unknown as ParkerData[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchParkers();
  }, []);

  const handleEditClick = (parker: ParkerData) => {
    setEditingParker(parker);
    setEditForm({
      name: parker.name,
      companyName: parker.company?.name || '',
      plates: parker.vehicles.filter(v => v.status === 'ACTIVE').map(v => v.plate_number).join(', ')
    });
  };

  const handleSaveEdit = async () => {
    if (!editingParker) return;

    try {
      // 1. Handle Company (Find or Create)
      let companyId = editingParker.company?.id;
      if (editForm.companyName.trim() && editForm.companyName !== editingParker.company?.name) {
        const { data: existingCompany } = await supabase
          .from('companies')
          .select('id')
          .ilike('name', editForm.companyName.trim())
          .single();

        if (existingCompany) {
          companyId = existingCompany.id;
        } else {
          const { data: newCompany } = await supabase
            .from('companies')
            .insert({ name: editForm.companyName.trim(), company_code: editForm.companyName.trim().substring(0, 5).toUpperCase() })
            .select('id')
            .single();
          if (newCompany) companyId = newCompany.id;
        }
      }

      // 2. Update Parker Name and Company
      await supabase
        .from('parkers')
        .update({ name: editForm.name, company_id: companyId })
        .eq('id', editingParker.id);

      // 3. Handle Vehicles (Simple sync: deactivate old ones not in list, add new ones)
      const inputPlates = editForm.plates.split(',').map(p => p.trim().toUpperCase()).filter(p => p);
      const currentActivePlates = editingParker.vehicles.filter(v => v.status === 'ACTIVE').map(v => v.plate_number);

      const toAdd = inputPlates.filter(p => !currentActivePlates.includes(p));
      const toRemove = currentActivePlates.filter(p => !inputPlates.includes(p));

      // Deactivate removed plates
      if (toRemove.length > 0) {
        await supabase.from('vehicles').update({ status: 'INACTIVE' }).eq('parker_id', editingParker.id).in('plate_number', toRemove);
      }

      // Add new plates
      for (const plate of toAdd) {
        // Check if plate exists globally
        const { data: existingVeh } = await supabase.from('vehicles').select('id').eq('plate_number', plate).single();
        if (existingVeh) {
          await supabase.from('vehicles').update({ parker_id: editingParker.id, status: 'ACTIVE' }).eq('id', existingVeh.id);
        } else {
          await supabase.from('vehicles').insert({ parker_id: editingParker.id, plate_number: plate, status: 'ACTIVE' });
        }
      }

      // Refresh Data
      setEditingParker(null);
      fetchParkers();
    } catch (err) {
      console.error('Error updating parker:', err);
      alert('Failed to update parker.');
    }
  };

  const openTransferModal = async (parker: ParkerData, assignmentId: string) => {
    setTransferringParker(parker);
    setTransferAssignmentId(assignmentId);
    setSelectedLotId('');
    setAvailableLots([]);

    const { data, error } = await supabase
      .from('parking_lots')
      .select('id, lot_number, floor:floors(floor_code)')
      .eq('status', 'AVAILABLE')
      .order('lot_number');

    if (error) {
      setTransferringParker(null);
      alert(`Unable to load available parking lots: ${error.message}`);
      return;
    }
    setAvailableLots(((data || []) as unknown as AvailableLot[]).filter((lot) => isValidLotNumber(lot.lot_number)));
  };

  const closeTransferModal = (force = false) => {
    if (isTransferring && !force) return;
    setTransferringParker(null);
    setTransferAssignmentId('');
    setSelectedLotId('');
  };

  const handleTransfer = async () => {
    if (role !== 'ADMINISTRATOR') {
      alert('Only administrators can change a parker’s parking lot.');
      return;
    }
    if (!transferAssignmentId || !selectedLotId) {
      alert('Please select an available destination lot.');
      return;
    }

    setIsTransferring(true);
    try {
      await ParkingService.transferParking({
        assignmentId: transferAssignmentId,
        newParkingLotId: selectedLotId,
        createdById: user?.id,
      });
      closeTransferModal(true);
      await fetchParkers();
      alert('Parking lot changed successfully. Removal and installation tasks were created.');
    } catch (err) {
      alert(`Unable to change parking lot: ${err instanceof Error ? err.message : 'Unexpected error.'}`);
    } finally {
      setIsTransferring(false);
    }
  };

  const filtered = parkers.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.company?.name || '').toLowerCase().includes(search.toLowerCase()) ||
      p.vehicles.some((v) => v.plate_number.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-400" /> Parkers Directory
          </h1>
          <p className="text-xs text-slate-400 mt-1">Manage individual parkers and their registered vehicles</p>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
        <div className="relative w-full max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Parker name, company, vehicle plate..."
            className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 pl-9 pr-4 py-2 rounded-lg focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 font-semibold uppercase">
              <th className="p-4">Parker Name</th>
              <th className="p-4">Company</th>
              <th className="p-4">Registered Vehicles</th>
              <th className="p-4">Current Lot</th>
              <th className="p-4">Status</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {loading ? (
              <tr><td colSpan={6} className="p-8 text-center text-slate-500">Loading live data...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-slate-500">No parkers found.</td></tr>
            ) : filtered.map((p) => {
              const activeAssignment = p.parking_assignments?.find(a => a.status === 'ACTIVE');
              const lotStr = activeAssignment ? `${activeAssignment.parking_lot.floor.floor_code}-${activeAssignment.parking_lot.lot_number}` : 'Unassigned';

              return (
                <tr key={p.id} className="hover:bg-slate-800/40">
                  <td className="p-4 font-bold text-slate-100">{p.name}</td>
                  <td className="p-4 text-slate-300">
                    {p.company ? (
                      <span className="flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5 text-blue-400" /> {p.company.name}</span>
                    ) : '-'}
                  </td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-1">
                      {p.vehicles.filter(v => v.status === 'ACTIVE').map((v) => (
                        <span key={v.id} className="px-2 py-0.5 bg-blue-500/20 text-blue-400 font-mono font-bold rounded border border-blue-500/30">
                          {v.plate_number}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="p-4 font-bold text-emerald-400">{lotStr}</td>
                  <td className="p-4">
                    <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 font-bold rounded text-[10px]">
                      {p.status}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end flex-wrap gap-2">
                      <Link href={`/people/parkers/${p.id}`} className="px-3 py-1 bg-green-700 text-white rounded text-xs font-bold hover:bg-green-800 whitespace-nowrap">
                        View Profile
                      </Link>
                      <button
                        onClick={() => handleEditClick(p)}
                        className="px-3 py-1 bg-slate-800 text-slate-300 rounded text-xs hover:bg-slate-700 whitespace-nowrap"
                      >
                        Edit Profile
                      </button>
                      {activeAssignment && (
                        <button
                          onClick={() => openTransferModal(p, activeAssignment.id)}
                          className="px-3 py-1 bg-blue-600 text-white rounded text-xs font-bold hover:bg-blue-500 flex items-center gap-1 whitespace-nowrap"
                        >
                          <ArrowRightLeft className="w-3.5 h-3.5" /> Change Lot
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>

      {/* Edit Modal */}
      {editingParker && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-950">
              <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                Edit Parker Profile
              </h3>
              <button onClick={() => setEditingParker(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1 uppercase">Full Name</label>
                <input 
                  type="text" 
                  value={editForm.name}
                  onChange={e => setEditForm({...editForm, name: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1 uppercase">Company Name</label>
                <input 
                  type="text" 
                  value={editForm.companyName}
                  onChange={e => setEditForm({...editForm, companyName: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1 uppercase">Vehicle Plates (Comma Separated)</label>
                <input 
                  type="text" 
                  value={editForm.plates}
                  onChange={e => setEditForm({...editForm, plates: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 font-mono focus:outline-none focus:border-blue-500"
                  placeholder="e.g. JTF5279, JWW1076"
                />
                <p className="text-[10px] text-slate-500 mt-1">Separate multiple plates with a comma.</p>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex justify-end gap-3">
              <button 
                onClick={() => setEditingParker(null)}
                className="px-4 py-2 text-xs font-bold text-slate-300 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveEdit}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded shadow flex items-center gap-2 transition-colors"
              >
                <Save className="w-4 h-4" /> Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {transferringParker && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-950">
              <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2"><ArrowRightLeft className="w-5 h-5 text-blue-400" /> Change Parking Lot</h3>
              <button onClick={() => closeTransferModal()} disabled={isTransferring} className="text-slate-400 hover:text-white disabled:opacity-50"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-300">Move <span className="font-bold text-slate-100">{transferringParker.name}</span> to an available lot.</p>
              <p className="text-xs text-amber-400">This creates a removal task for the current lot and an installation task for the new lot.</p>
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1 uppercase">New Parking Lot</label>
                <select value={selectedLotId} onChange={(event) => setSelectedLotId(event.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500">
                  <option value="">-- Choose Available Lot --</option>
                  {availableLots.map((lot) => <option key={lot.id} value={lot.id}>{lot.floor?.floor_code || '-'} - Lot {lot.lot_number}</option>)}
                </select>
                {availableLots.length === 0 && <p className="text-xs text-amber-400 mt-2">No available parking lots were found.</p>}
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex justify-end gap-3">
              <button onClick={() => closeTransferModal()} disabled={isTransferring} className="px-4 py-2 text-xs font-bold text-slate-300 hover:text-white disabled:opacity-50">Cancel</button>
              <button onClick={handleTransfer} disabled={isTransferring || !selectedLotId} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold rounded shadow flex items-center gap-2 transition-colors"><ArrowRightLeft className="w-4 h-4" /> {isTransferring ? 'Changing...' : 'Change Lot'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
