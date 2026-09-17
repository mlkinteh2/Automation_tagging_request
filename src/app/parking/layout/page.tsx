'use client';

import React, { useState, useEffect } from 'react';
import { Search, Filter, CheckCircle2, Clock, MapPin, X, Save } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { ParkingService } from '@/services/parkingService';
import { useAuth } from '@/context/AuthContext';
import { isValidLotNumber } from '@/lib/parking/lotValidation';

interface ParkerData {
  id: string;
  name: string;
  company?: { name: string };
}

interface VehicleData {
  id: string;
  plate_number: string;
  parker_id?: string;
}

interface LiveLot {
  id: string;
  lot_number: string;
  status: string;
  floor: { floor_code: string };
  assignments: {
    id: string;
    status: string;
    parker: ParkerData;
    vehicle: VehicleData;
    tags: { tag_status: string }[];
  }[];
}

export default function ParkingLayoutPage() {
  const { role } = useAuth();
  const isAdministrator = role === 'ADMINISTRATOR';
  const [activeFloor, setActiveFloor] = useState<string>('GF');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  
  const [lots, setLots] = useState<LiveLot[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal State
  const [actionLot, setActionLot] = useState<LiveLot | null>(null);
  const [actionType, setActionType] = useState<'ASSIGN' | 'NEW_PARKER' | 'REPLACE' | 'TRANSFER' | 'CANCEL' | null>(null);
  
  // Form State
  const [allParkers, setAllParkers] = useState<ParkerData[]>([]);
  const [allVehicles, setAllVehicles] = useState<VehicleData[]>([]);
  
  const [selectedParkerId, setSelectedParkerId] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [selectedTransferLotId, setSelectedTransferLotId] = useState('');
  const [newParkerName, setNewParkerName] = useState('');
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newPlateNumber, setNewPlateNumber] = useState('');
  const [newFloorCode, setNewFloorCode] = useState('GF');
  const [newLotNumber, setNewLotNumber] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    // Fetch Lots
    const { data: lotsData } = await supabase
      .from('parking_lots')
      .select(`
        id, lot_number, status,
        floor:floors(floor_code),
        assignments:parking_assignments(
          id, status,
          parker:parkers(id, name, company:companies(name)),
          vehicle:vehicles(id, plate_number),
          tags(tag_status)
        )
      `)
      .order('lot_number');
      
    if (lotsData) setLots((lotsData as unknown as LiveLot[]).filter((lot) => isValidLotNumber(lot.lot_number)));
    
    // Fetch Parkers for Dropdown
    const { data: pData } = await supabase.from('parkers').select('id, name').eq('status', 'ACTIVE');
    if (pData) setAllParkers(pData);
    
    // Fetch Vehicles for Dropdown
    const { data: vData } = await supabase.from('vehicles').select('id, plate_number, parker_id').eq('status', 'ACTIVE');
    if (vData) setAllVehicles(vData);

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openModal = (lot: LiveLot, type: 'ASSIGN' | 'REPLACE' | 'TRANSFER' | 'CANCEL') => {
    setActionLot(lot);
    setActionType(type);
    setSelectedParkerId('');
    setSelectedVehicleId('');
    setSelectedTransferLotId('');
    setCancelReason('');
  };

  const openNewParkerModal = () => {
    setActionLot(null);
    setActionType('NEW_PARKER');
    setNewParkerName('');
    setNewCompanyName('');
    setNewPlateNumber('');
    setNewFloorCode(activeFloor);
    setNewLotNumber('');
  };

  const closeModal = () => {
    setActionLot(null);
    setActionType(null);
  };

  const handleSubmit = async () => {
    if (!actionType) return;
    if (!isAdministrator) {
      alert('Only administrators can change parking assignments.');
      return;
    }
    setIsSubmitting(true);
    try {
      if (actionType === 'NEW_PARKER') {
        const parkerName = newParkerName.trim();
        const companyName = newCompanyName.trim();
        const plateNumber = newPlateNumber.replace(/\s+/g, '').toUpperCase();
        const lotNumber = newLotNumber.replace(/^lot\s*/i, '').trim();
        const selectedLot = lots.find(
          (lot) => lot.floor?.floor_code === newFloorCode && lot.lot_number.toLowerCase() === lotNumber.toLowerCase()
        );

        if (!parkerName || !plateNumber || !lotNumber) {
          throw new Error('Please enter the parker name, car plate, and lot number.');
        }

        if (!isValidLotNumber(lotNumber)) {
          throw new Error(`Lot ${lotNumber} is invalid. Lots must be numeric (e.g. 12, 12A).`);
        }

        let targetLotId = selectedLot?.id;

        if (!selectedLot) {
          // If lot not found, create it dynamically
          const { data: floorData, error: floorError } = await supabase
            .from('floors')
            .select('id')
            .eq('floor_code', newFloorCode)
            .single();
            
          if (floorError || !floorData) {
            throw new Error(`Floor ${newFloorCode} was not found.`);
          }
          
          const { data: newLotData, error: lotError } = await supabase
            .from('parking_lots')
            .insert({
              floor_id: floorData.id,
              lot_number: lotNumber,
              status: 'AVAILABLE'
            })
            .select('id')
            .single();
            
          if (lotError || !newLotData) {
            throw new Error(`Failed to create new lot: ${lotError?.message || 'Unknown error'}`);
          }
          targetLotId = newLotData.id;
        } else if (selectedLot.status !== 'AVAILABLE') {
          throw new Error(`Lot ${newFloorCode}-${lotNumber} is not available.`);
        }

        const { data: existingVehicle } = await supabase
          .from('vehicles')
          .select('id, parker_id, status')
          .eq('plate_number', plateNumber)
          .maybeSingle();
        if (existingVehicle) {
          throw new Error(`Plate ${plateNumber} is already registered.`);
        }

        let companyId: string | null = null;
        if (companyName) {
          const { data: existingCompany, error: companyLookupError } = await supabase
            .from('companies')
            .select('id')
            .ilike('name', companyName)
            .maybeSingle();
          if (companyLookupError) {
            throw new Error(`Failed to look up company: ${companyLookupError.message}`);
          }

          if (existingCompany) {
            companyId = existingCompany.id;
          } else {
            const { data: newCompany, error: companyError } = await supabase
              .from('companies')
              .insert({
                name: companyName,
                company_code: companyName.substring(0, 5).toUpperCase(),
                status: 'ACTIVE',
              })
              .select('id')
              .single();
            if (companyError || !newCompany) {
              throw new Error(`Failed to create company: ${companyError?.message || 'Unknown error'}`);
            }
            companyId = newCompany.id;
          }
        }

        const { data: newParker, error: parkerError } = await supabase
          .from('parkers')
          .insert({ name: parkerName, company_id: companyId, status: 'ACTIVE' })
          .select('id')
          .single();
        if (parkerError || !newParker) {
          throw new Error(`Failed to create parker: ${parkerError?.message || 'Unknown error'}`);
        }

        const { data: newVehicle, error: vehicleError } = await supabase
          .from('vehicles')
          .insert({
            parker_id: newParker.id,
            plate_number: plateNumber,
            vehicle_type: 'CAR',
            status: 'ACTIVE',
          })
          .select('id')
          .single();
        if (vehicleError || !newVehicle) {
          await supabase.from('parkers').delete().eq('id', newParker.id);
          throw new Error(`Failed to create vehicle: ${vehicleError?.message || 'Unknown error'}`);
        }

        await ParkingService.assignParking({
          parkerId: newParker.id,
          vehicleId: newVehicle.id,
          parkingLotId: targetLotId as string,
        });
        alert('New parker added and assigned successfully! Word document generated.');
        closeModal();
        fetchData();
        return;
      }

      if (!actionLot) return;
      const activeAssignment = actionLot.assignments.find(a => a.status === 'ACTIVE');

      if (actionType === 'ASSIGN') {
        if (!selectedParkerId || !selectedVehicleId) throw new Error('Please select parker and vehicle');
        await ParkingService.assignParking({
          parkerId: selectedParkerId,
          vehicleId: selectedVehicleId,
          parkingLotId: actionLot.id
        });
        alert('Assigned successfully! Word document generated.');
      } else if (actionType === 'REPLACE') {
        if (!selectedParkerId || !selectedVehicleId) throw new Error('Please select parker and vehicle');
        await ParkingService.replaceParkerOnLot({
          parkingLotId: actionLot.id,
          newParkerId: selectedParkerId,
          newVehicleId: selectedVehicleId,
          reason: cancelReason || 'Replaced by admin'
        });
        alert('Parker replaced successfully! Field Operator tasks created.');
      } else if (actionType === 'TRANSFER') {
        if (!activeAssignment || !selectedTransferLotId) throw new Error('Please select an available destination lot.');
        await ParkingService.transferParking({
          assignmentId: activeAssignment.id,
          newParkingLotId: selectedTransferLotId,
        });
        alert('Parking transferred successfully! Removal and installation tasks created.');
      } else if (actionType === 'CANCEL') {
        if (!activeAssignment) throw new Error('No active assignment to cancel');
        await ParkingService.cancelParking({
          assignmentId: activeAssignment.id,
          reason: cancelReason || 'Cancelled by admin'
        });
        alert('Assignment cancelled. Removal task sent to Field Operator.');
      }
      closeModal();
      fetchData();
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'An unexpected error occurred.'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredLots = lots.filter((lot) => {
    if (lot.floor?.floor_code !== activeFloor) return false;
    if (statusFilter !== 'ALL' && lot.status !== statusFilter) return false;
    
    const activeAssignment = lot.assignments?.find(a => a.status === 'ACTIVE');
    
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchLot = lot.lot_number.toLowerCase().includes(q);
      const matchParker = activeAssignment?.parker?.name.toLowerCase().includes(q);
      const matchPlate = activeAssignment?.vehicle?.plate_number.toLowerCase().includes(q);
      return matchLot || matchParker || matchPlate;
    }
    return true;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'AVAILABLE': return <span className="layout-status layout-status-available">AVAILABLE</span>;
      case 'OCCUPIED': return <span className="layout-status layout-status-occupied">OCCUPIED</span>;
      case 'PENDING_INSTALLATION': return <span className="layout-status layout-status-installation">PENDING INSTALL</span>;
      case 'PENDING_REMOVAL': return <span className="layout-status layout-status-removal">PENDING REMOVAL</span>;
      default: return <span className="layout-status layout-status-default">{status}</span>;
    }
  };

  const getTagBadge = (tagStatus?: string) => {
    switch (tagStatus) {
      case 'INSTALLED': return <span className="layout-tag layout-tag-installed"><CheckCircle2 className="w-3.5 h-3.5" /> Installed</span>;
      case 'INSTALLATION_PENDING': return <span className="layout-tag layout-tag-installation"><Clock className="w-3.5 h-3.5" /> Pending Install</span>;
      case 'REMOVAL_PENDING': return <span className="layout-tag layout-tag-removal"><Clock className="w-3.5 h-3.5" /> Pending Removal</span>;
      default: return <span className="layout-tag layout-tag-none">None</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <MapPin className="text-blue-400 w-6 h-6"/> Parking Layout Matrix
          </h1>
          <p className="text-xs text-slate-400 mt-1">Interactive Reserved Parking Grid with Live Data</p>
        </div>
        {isAdministrator && (
          <button
            onClick={openNewParkerModal}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg shadow-md flex items-center gap-2 transition-colors"
          >
            <Save className="w-4 h-4" /> Add New Parker
          </button>
        )}
      </div>

      <div className="layout-floor-tabs flex border-b border-slate-800 space-x-2">
        {(['GF', 'P1', 'P2', 'P3']).map((floor) => (
          <button
            key={floor}
            onClick={() => setActiveFloor(floor)}
            className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors ${
              activeFloor === floor
                ? 'border-blue-500 text-blue-400 bg-slate-900/40'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Floor {floor}
          </button>
        ))}
      </div>

      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Parker, Plate, Lot..."
            className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 pl-9 pr-4 py-2 rounded-lg focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-xs text-slate-200 px-3 py-2 rounded-lg focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">All Lot Statuses</option>
            <option value="AVAILABLE">AVAILABLE</option>
            <option value="OCCUPIED">OCCUPIED</option>
            <option value="PENDING_INSTALLATION">PENDING INSTALLATION</option>
            <option value="PENDING_REMOVAL">PENDING REMOVAL</option>
          </select>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                <th className="py-3.5 px-4">Lot #</th>
                <th className="py-3.5 px-4">Parker Name</th>
                <th className="py-3.5 px-4">Company</th>
                <th className="py-3.5 px-4">Vehicle Plate</th>
                <th className="py-3.5 px-4">Parking Status</th>
                <th className="py-3.5 px-4">Tag Status</th>
                {isAdministrator && <th className="py-3.5 px-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr><td colSpan={isAdministrator ? 7 : 6} className="py-8 text-center text-slate-500">Loading layout...</td></tr>
              ) : filteredLots.length === 0 ? (
                <tr>
                  <td colSpan={isAdministrator ? 7 : 6} className="py-8 text-center text-slate-500">
                    No reserved parking lots matching your criteria on floor {activeFloor}.
                  </td>
                </tr>
              ) : (
                filteredLots.map((lot) => {
                  const activeAssignment = lot.assignments?.find(a => a.status === 'ACTIVE');
                  const activeTag = activeAssignment?.tags?.[0];

                  return (
                    <tr key={lot.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-100">Lot {lot.lot_number}</td>
                      <td className="py-3.5 px-4 font-medium text-slate-200">
                        {activeAssignment?.parker?.name || <span className="text-slate-500 italic">Unassigned</span>}
                      </td>
                      <td className="py-3.5 px-4 text-slate-300">
                        {activeAssignment?.parker?.company?.name || <span className="text-slate-500 italic">-</span>}
                      </td>
                      <td className="py-3.5 px-4 font-extrabold text-blue-400 tracking-wide">
                        {activeAssignment?.vehicle?.plate_number || <span className="text-slate-500 font-normal italic">-</span>}
                      </td>
                      <td className="py-3.5 px-4">{getStatusBadge(lot.status)}</td>
                      <td className="py-3.5 px-4">{getTagBadge(activeTag?.tag_status)}</td>
                      {isAdministrator && <td className="py-3.5 px-4 text-right flex justify-end gap-2">
                        {lot.status === 'AVAILABLE' && (
                            <button onClick={() => openModal(lot, 'ASSIGN')} className="layout-action layout-action-assign">
                            Assign
                          </button>
                        )}
                        {(lot.status === 'OCCUPIED' || lot.status === 'PENDING_INSTALLATION' || lot.status === 'PENDING_REMOVAL') && (
                          <>
                            <button onClick={() => openModal(lot, 'REPLACE')} className="layout-action layout-action-replace">
                              Replace Parker
                            </button>
                            {lot.status === 'OCCUPIED' && (
                              <button onClick={() => openModal(lot, 'TRANSFER')} className="layout-action layout-action-transfer">
                                Transfer
                              </button>
                            )}
                            <button onClick={() => openModal(lot, 'CANCEL')} className="layout-action layout-action-cancel">
                              Cancel
                            </button>
                          </>
                        )}
                      </td>}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ACTION MODAL */}
      {actionType && (actionLot || actionType === 'NEW_PARKER') && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-950">
              <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                {actionType === 'NEW_PARKER' && 'Add New Parker'}
                {actionType === 'ASSIGN' && `Assign Lot ${actionLot?.lot_number}`}
                {actionType === 'REPLACE' && `Replace Parker on Lot ${actionLot?.lot_number}`}
                {actionType === 'TRANSFER' && `Transfer Lot ${actionLot?.lot_number}`}
                {actionType === 'CANCEL' && `Cancel Lot ${actionLot?.lot_number}`}
              </h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="p-6 space-y-4">
              {actionType === 'NEW_PARKER' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-1 uppercase">Floor</label>
                      <select
                        value={newFloorCode}
                        onChange={e => setNewFloorCode(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                      >
                        {(['GF', 'P1', 'P2', 'P3']).map(floor => <option key={floor} value={floor}>{floor}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-1 uppercase">Lot Number</label>
                      <input
                        type="text"
                        value={newLotNumber}
                        onChange={e => setNewLotNumber(e.target.value)}
                        placeholder="e.g. 13"
                        className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1 uppercase">Parker Name</label>
                    <input
                      type="text"
                      value={newParkerName}
                      onChange={e => setNewParkerName(e.target.value)}
                      placeholder="Enter the new parker name"
                      className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1 uppercase">Company Name (Optional)</label>
                    <input
                      type="text"
                      value={newCompanyName}
                      onChange={e => setNewCompanyName(e.target.value)}
                      placeholder="Enter the company name"
                      className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1 uppercase">Car Plate</label>
                    <input
                      type="text"
                      value={newPlateNumber}
                      onChange={e => setNewPlateNumber(e.target.value)}
                      placeholder="e.g. JWW1076"
                      className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 uppercase font-mono focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </>
              )}

              {(actionType === 'ASSIGN' || actionType === 'REPLACE') && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1 uppercase">Select Parker</label>
                    <select 
                      value={selectedParkerId}
                      onChange={e => {
                        setSelectedParkerId(e.target.value);
                        setSelectedVehicleId(''); // Reset vehicle when parker changes
                      }}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                    >
                      <option value="">-- Choose Parker --</option>
                      {allParkers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>

                  {selectedParkerId && (
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-1 uppercase">Select Vehicle</label>
                      <select 
                        value={selectedVehicleId}
                        onChange={e => setSelectedVehicleId(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                      >
                        <option value="">-- Choose Vehicle Plate --</option>
                        {allVehicles.filter(v => v.parker_id === selectedParkerId).map(v => (
                          <option key={v.id} value={v.id}>{v.plate_number}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </>
              )}

              {actionType === 'TRANSFER' && (
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1 uppercase">Destination Lot</label>
                  <select
                    value={selectedTransferLotId}
                    onChange={e => setSelectedTransferLotId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="">-- Choose Available Lot --</option>
                    {lots.filter(lot => lot.status === 'AVAILABLE' && lot.id !== actionLot?.id).map(lot => (
                      <option key={lot.id} value={lot.id}>{lot.floor?.floor_code} - Lot {lot.lot_number}</option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-500 mt-2">The current lot will remain pending removal until the Field Operator confirms the physical tag removal.</p>
                </div>
              )}

              {(actionType === 'REPLACE' || actionType === 'CANCEL') && (
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1 uppercase">Reason (Optional)</label>
                  <input 
                    type="text" 
                    value={cancelReason}
                    onChange={e => setCancelReason(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                    placeholder={actionType === 'REPLACE' ? "e.g., Requested reassignment" : "e.g., No longer employed"}
                  />
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex justify-end gap-3">
              <button onClick={closeModal} className="px-4 py-2 text-xs font-bold text-slate-300 hover:text-white transition-colors">
                Close
              </button>
              <button 
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold rounded shadow flex items-center gap-2 transition-colors"
              >
                <Save className="w-4 h-4" /> {isSubmitting ? 'Processing...' : 'Confirm Action'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
