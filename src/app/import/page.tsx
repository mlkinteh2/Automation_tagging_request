'use client';

import React, { useState } from 'react';
import { parseRawSeedText, ParsedRecord, SkippedRow } from '@/lib/seed/importData';
import { FileSpreadsheet, CheckCircle2, AlertTriangle, Upload, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { isValidLotNumber } from '@/lib/parking/lotValidation';

export default function ImportPage() {
  const [rawText, setRawText] = useState('');
  const [parsed, setParsed] = useState<ParsedRecord[]>([]);
  const [skipped, setSkipped] = useState<SkippedRow[]>([]);
  const [validated, setValidated] = useState(false);
  const [imported, setImported] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');

  const handleParse = () => {
    if (!rawText.trim()) return;
    const result = parseRawSeedText(rawText);
    setParsed(result.records);
    setSkipped(result.skipped);
    setValidated(true);
    setImported(false);
  };

  const loadSampleData = async () => {
    // Sample snippet from user's Excel data
    const sample = `GF		
NO	NAME	COMPANY	CAR PLATE	Lots Allocated
1	OKAMOTO YOSHIKI	OKAKICHI	JTF 5279 / JWW 1076	1
2	AGARIE RYO	OKAKICHI	JTC 3570	2
3	PINNACLE INTERNATIONAL SDN BHD	Pinnacle	U123/PINNACLE/JX123	3
4	COMPANY CAR	Okakichi	JTT 2758	4
5	OKAMOTO YOSHIKI	Okakichi	VET 3052	5
11		No parker		11

P1		
NO	NAME	COMPANY	CAR PLATE	Lots Allocated
16	MUHAMMAD ASHRAFF RUZAIDI	MCMC	JTP662/BNM8257/JWT606	1
 26	OKAMOTO YOSHIKI	OKAKICHI	JWW1076	13`;
    setRawText(sample);
  };

  const executeImport = async () => {
    setImporting(true);
    setImportError('');
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!supabaseUrl || supabaseUrl.includes('your-') || supabaseUrl.includes('placeholder')) {
        throw new Error('Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL in .env.local and restart the app.');
      }

      try {
        new URL(supabaseUrl);
      } catch {
        throw new Error(`Invalid Supabase URL: ${supabaseUrl}`);
      }

      // Remove legacy plate values that were mistakenly created as lots.
      // Invalid lots are removed when unassigned, or when their only assignments
      // are CANCELLED/TRANSFERRED history (those assignments are repointed to the
      // correct real lot first so history is preserved).
      const { data: existingLots, error: existingLotsError } = await supabase
        .from('parking_lots')
        .select('id, lot_number, status, parking_assignments(id, status)');
      if (existingLotsError) throw existingLotsError;

      for (const lot of (existingLots || []).filter((l) => !isValidLotNumber(l.lot_number))) {
        const movable = (lot.parking_assignments || []).every((a: { status: string }) =>
          a.status === 'CANCELLED' || a.status === 'TRANSFERRED'
        );
        if (!movable) continue; // ACTIVE/PENDING references require manual repair — never delete blindly.

        // Repoint historical assignments to the correct real lot on this floor when it exists.
        const floorIdOfBogus = await supabase.from('parking_lots').select('floor_id').eq('id', lot.id).single();
        const bogusFloorId = floorIdOfBogus.data?.floor_id;
        let fallbackRealLotId: string | null = null;
        if (bogusFloorId && (lot.parking_assignments || []).length > 0) {
          const { data: candidate } = await supabase
            .from('parking_lots')
            .select('id')
            .eq('floor_id', bogusFloorId)
            .eq('lot_number', lot.lot_number.replace(/[^0-9A-Za-z]/g, '').slice(0, 2))
            .maybeSingle();
          fallbackRealLotId = candidate?.id || null;
        }

        for (const a of lot.parking_assignments || []) {
          await supabase.from('parking_assignments').update({ parking_lot_id: fallbackRealLotId }).eq('id', (a as { id: string }).id);
        }
        await supabase.from('bob_requests').update({ parking_lot_id: fallbackRealLotId }).eq('parking_lot_id', lot.id);

        const { error: deleteError } = await supabase.from('parking_lots').delete().eq('id', lot.id);
        if (deleteError) console.error(`Could not delete invalid lot "${lot.lot_number}":`, deleteError.message);
      }

      // 1. Ensure Facility exists
      let facilityId = '';
      const { data: fac } = await supabase.from('facilities').select('id').eq('name', 'Main Parking').single();
      if (fac) facilityId = fac.id;
      else {
        const { data: newFac } = await supabase.from('facilities').insert({ name: 'Main Parking' }).select('id').single();
        if (newFac) facilityId = newFac.id;
      }

      // 2. Ensure Floors exist
      const floorCodes = ['GF', 'P1', 'P2', 'P3'];
      const floorIds: Record<string, string> = {};
      for (const fc of floorCodes) {
        const { data: fl } = await supabase.from('floors').select('id').eq('floor_code', fc).single();
        if (fl) floorIds[fc] = fl.id;
        else {
          const { data: newFl } = await supabase.from('floors').insert({ facility_id: facilityId, floor_code: fc, floor_name: `Floor ${fc}` }).select('id').single();
          if (newFl) floorIds[fc] = newFl.id;
        }
      }

      // 3. Process each record
      for (const r of parsed) {
        const floorId = floorIds[r.floorCode] || floorIds['GF'];
        
        // Create or Update Lot
        let lotId = '';
        const { data: exLot } = await supabase.from('parking_lots').select('id, status').eq('floor_id', floorId).eq('lot_number', r.lotNumber).single();
        if (exLot) {
          lotId = exLot.id;
          if (exLot.status !== 'OCCUPIED' && r.isOccupied) {
            await supabase.from('parking_lots').update({ status: 'OCCUPIED' }).eq('id', lotId);
          }
        }
        else {
          const { data: newLot } = await supabase.from('parking_lots').insert({
            floor_id: floorId,
            lot_number: r.lotNumber,
            status: r.isOccupied ? 'OCCUPIED' : 'AVAILABLE'
          }).select('id').single();
          if (newLot) lotId = newLot.id;
        }

        if (r.isOccupied && r.parkerName) {
          // Company
          let companyId = null;
          if (r.companyName) {
            const { data: exComp } = await supabase.from('companies').select('id').ilike('name', r.companyName).single();
            if (exComp) companyId = exComp.id;
            else {
              const { data: newComp } = await supabase.from('companies').insert({ name: r.companyName }).select('id').single();
              if (newComp) companyId = newComp.id;
            }
          }

          // Parker
          let parkerId = '';
          const { data: exParker } = await supabase.from('parkers').select('id').eq('name', r.parkerName).single();
          if (exParker) {
            parkerId = exParker.id;
            if (companyId) await supabase.from('parkers').update({ company_id: companyId }).eq('id', parkerId);
          } else {
            const { data: newParker } = await supabase.from('parkers').insert({ name: r.parkerName, company_id: companyId }).select('id').single();
            if (newParker) parkerId = newParker.id;
          }
          if (!parkerId) {
            throw new Error(`Parker "${r.parkerName}" could not be stored in Supabase.`);
          }

          // Vehicles
          let primaryVehicleId = '';
          for (const plate of r.carPlates) {
            let vId = '';
            const { data: exVeh } = await supabase.from('vehicles').select('id').eq('plate_number', plate).single();
            if (exVeh) {
              vId = exVeh.id;
            } else {
              const { data: newVeh } = await supabase.from('vehicles').insert({ parker_id: parkerId, plate_number: plate }).select('id').single();
              if (newVeh) vId = newVeh.id;
            }
            if (!primaryVehicleId) primaryVehicleId = vId;
          }

          // Assignment
          if (primaryVehicleId && lotId) {
            // Check if assignment exists
            const { data: exAss } = await supabase.from('parking_assignments').select('id').eq('parking_lot_id', lotId).eq('status', 'ACTIVE').single();
            let assignmentId = '';
            if (!exAss) {
              const { data: newAss, error: assignmentError } = await supabase.from('parking_assignments').insert({
                parker_id: parkerId,
                vehicle_id: primaryVehicleId,
                parking_lot_id: lotId,
                status: 'ACTIVE'
              }).select('id').single();
              if (assignmentError) {
                throw new Error(`Assignment for lot ${r.lotNumber} failed: ${assignmentError.message}`);
              }
              if (!newAss?.id) {
                throw new Error(`Assignment for lot ${r.lotNumber} failed: Supabase returned no assignment ID.`);
              }

              assignmentId = newAss.id;
              const { error: tagError } = await supabase.from('tags').insert({
                assignment_id: assignmentId,
                tag_status: 'INSTALLED'
              });
              if (tagError) {
                throw new Error(`Tag for lot ${r.lotNumber} failed: ${tagError.message}`);
              }
            }
          }
        }
      }
      setImported(true);
    } catch (err) {
      const message = err instanceof TypeError && err.message === 'Failed to fetch'
        ? `Cannot reach Supabase at ${process.env.NEXT_PUBLIC_SUPABASE_URL || 'the configured URL'}. Verify that the project still exists and that the URL is correct.`
        : err instanceof Error
        ? err.message
        : typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message: unknown }).message)
          : JSON.stringify(err);
      console.error('Import failed:', message);
      setImportError(message || 'Import failed. Check the browser console for details.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <FileSpreadsheet className="w-6 h-6 text-blue-400" /> Excel & CSV Data Import
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Import and normalize legacy parking allocation records (Requirement 29, 30 & 31)
        </p>
      </div>

      {/* Input Box */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-300">
            Paste Tab-Separated Excel / CSV Data:
          </label>
          <button
            onClick={loadSampleData}
            className="text-xs text-blue-400 hover:underline flex items-center gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Load Sample Excel Dataset
          </button>
        </div>

        <textarea
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          placeholder="Paste raw tab-separated lines from Excel here..."
          className="w-full h-48 bg-slate-950 border border-slate-800 rounded-lg p-4 font-mono text-xs text-slate-200 focus:outline-none focus:border-blue-500"
        />

        <div className="flex justify-end gap-3">
          <button
            onClick={handleParse}
            disabled={!rawText.trim()}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs rounded-lg shadow-lg transition-colors flex items-center gap-2"
          >
            <Upload className="w-4 h-4" /> Validate & Preview Import
          </button>
        </div>
      </div>

      {/* Validation Preview */}
      {validated && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-200">Import Validation Preview</h2>
              <p className="text-xs text-slate-400">
                Found {parsed.length} parking lot allocation records. Number plates normalized automatically.
              </p>
            </div>
            {!imported ? (
              <button
                onClick={executeImport}
                disabled={importing}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white font-bold text-xs rounded-lg shadow-md transition-colors flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" /> {importing ? 'Importing Data (Wait...)' : 'Import Valid Records'}
              </button>
            ) : (
              <span className="px-4 py-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-bold rounded-lg flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> Successfully Imported {parsed.length} Records!
              </span>
            )}
          </div>

          {importError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-xs text-red-300">
              <div className="font-bold text-red-200">Import failed</div>
              <div className="mt-1 break-words">{importError}</div>
              <div className="mt-2 text-red-300/80">
                Confirm the Supabase project URL and anon key in <code>.env.local</code>, then restart <code>npm run dev</code>.
              </div>
            </div>
          )}

          {skipped.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase">
                <AlertTriangle className="w-4 h-4" /> {skipped.length} row{skipped.length > 1 ? 's' : ''} skipped — invalid lot number in &quot;Lots Allocated&quot; column
              </div>
              <ul className="space-y-1 max-h-40 overflow-y-auto">
                {skipped.map((s, i) => (
                  <li key={i} className="text-[11px] text-amber-300/80 font-mono truncate" title={s.line}>
                    {s.line.slice(0, 90)} — {s.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 uppercase font-semibold">
                  <th className="p-3">Floor</th>
                  <th className="p-3">Lot #</th>
                  <th className="p-3">Parker Name</th>
                  <th className="p-3">Company</th>
                  <th className="p-3">Normalized Vehicle Plates</th>
                  <th className="p-3">Occupancy Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {parsed.map((r, i) => (
                  <tr key={i} className="hover:bg-slate-800/30">
                    <td className="p-3 font-bold text-blue-400">{r.floorCode}</td>
                    <td className="p-3 font-bold text-slate-200">Lot {r.lotNumber}</td>
                    <td className="p-3 text-slate-200">{r.parkerName || <span className="text-slate-500 italic">No Parker (Allocated Only)</span>}</td>
                    <td className="p-3 text-slate-300">{r.companyName || '-'}</td>
                    <td className="p-3">
                      {r.carPlates.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {r.carPlates.map((plate, idx) => (
                            <span key={idx} className="px-2 py-0.5 bg-blue-500/20 text-blue-400 font-mono font-bold rounded border border-blue-500/30">
                              {plate}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-500 italic">No vehicles</span>
                      )}
                    </td>
                    <td className="p-3">
                      {r.isOccupied ? (
                        <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 text-[10px] font-bold rounded">OCCUPIED</span>
                      ) : (
                        <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-[10px] font-bold rounded">AVAILABLE</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
