/**
 * Data repair: fix "plate-as-lot" corruption in parking_lots.
 *
 * Problem: a legacy import created parking lots whose lot_number is a vehicle
 * plate (e.g. "JSN8883") instead of the real allocated lot number. Assignments
 * (including ACTIVE ones) point at these bogus lots, so the UI shows e.g.
 * "P2-JSN8883" instead of "P2-52".
 *
 * Strategy (verified against live data on 2026-08-27):
 *  1. Detect every lot failing isValidLotNumber().
 *  2. Look up its intended real lot in REPAIR_MAP (derived from seed_data.txt).
 *  3. Create the real lot if missing (e.g. P2-48).
 *  4. Repoint assignments + BOB requests from bogus lot -> real lot.
 *     - ACTIVE assignment conflicts (real lot already actively assigned) are
 *       de-duplicated when same parker, otherwise aborted for manual review.
 *  5. Special-case "QM8009Q" (occupied, no assignment): restore Ken Chong's
 *     assignment on P1-35 if genuinely missing.
 *  6. Delete bogus lots, write audit logs, print verification summary.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://lkrvvvhzruajpruqxyzc.supabase.co';
const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxrcnZ2dmh6cnVhanBydXF4eXpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5OTMyMDIsImV4cCI6MjEwMjU2OTIwMn0.DNZ4f7sQ1Rx399L-RByEqITac4jhCZWYkSJSS4tpSzE';

async function rest(method, table, searchParams = {}, body) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  for (const [k, v] of Object.entries(searchParams)) url.searchParams.set(k, v);
  const res = await fetch(url, {
    method,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Prefer: 'return=representation',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${table}: HTTP ${res.status} - ${text}`);
  return text ? JSON.parse(text) : null;
}
const q = (table, params) => rest('GET', table, params);
const patch = (table, filters, body) => rest('PATCH', table, filters, body);
const post = (table, body) => rest('POST', table, {}, body);
const del = (table, filters) => rest('DELETE', table, filters);

function isValidLotNumber(value) {
  return /^\d+[A-Z]?$/i.test((value || '').trim());
}
/** Normalize a bogus lot_number for map lookup: strip quotes/spaces, uppercase. */
function normalizeBogus(value) {
  return (value || '').replace(/["\s]/g, '').toUpperCase();
}

/** Verified mapping: bogus lot (normalized) -> intended real floor + lot. */
const REPAIR_MAP = {
  'JSN8883': { floor: 'P2', lot: '52' },            // GAURAN AGGARWAL (ACTIVE)
  'JXF986': { floor: 'P2', lot: '48' },             // JEE XUAN EN (ACTIVE; P2-48 missing)
  'VCU747': { floor: 'P2', lot: '14' },             // AZLAN BIN ABDUL KADIR (ACTIVE)
  'JPB6964/VGM780/WVF7469': { floor: 'P3', lot: '46' }, // NOORFATHANA (cancelled history)
  'JYC959/JWS9594': { floor: 'P3', lot: '29' },     // AHMAD ROZAIMY (cancelled history)
  'VJW256': { floor: 'P3', lot: '31' },             // MCMC (cancelled history)
  'WA3654/BKM9734/VGN1948': { floor: 'P3', lot: '27' }, // VIMALAN (cancelled history)
  'QM8009Q': { floor: 'P1', lot: '35' },            // Ken Chong (occupied, no assignment)
};

const auditLogs = [];

async function ensureRealLot(floors, lots, floorCode, lotNumber) {
  const floor = floors.find((f) => f.floor_code === floorCode);
  if (!floor) throw new Error(`Floor ${floorCode} not found`);
  let real = lots.find((l) => l.floor_id === floor.id && l.lot_number === lotNumber);
  if (!real) {
    const created = await post('parking_lots', {
      floor_id: floor.id,
      lot_number: lotNumber,
      allocation_type: 'RESERVED',
      status: 'AVAILABLE',
    });
    if (!created || !created[0]) throw new Error(`Failed to create lot ${floorCode}-${lotNumber}`);
    real = created[0];
    lots.push(real);
    console.log(`   + created missing real lot ${floorCode}-${lotNumber}`);
  }
  return { real, floor };
}

async function main() {
  console.log('Loading current state...');
  const floors = await q('floors', { select: 'id, floor_code' });
  const lots = await q('parking_lots', { select: 'id, lot_number, status, floor_id' });
  const invalidLots = lots.filter((l) => !isValidLotNumber(l.lot_number));
  console.log(`Found ${invalidLots.length} invalid (plate-as-lot) lots.\n`);

  let repaired = 0;
  for (const bogus of invalidLots) {
    const norm = normalizeBogus(bogus.lot_number);
    const target = REPAIR_MAP[norm];
    const bogusFloor = floors.find((f) => f.id === bogus.floor_id)?.floor_code || '?';
    console.log(`--- Bogus lot "${bogus.lot_number}" [${bogusFloor}] (${bogus.id})`);

    if (!target) {
      console.log('   !! No repair mapping — SKIPPED for manual review.');
      continue;
    }

    const { real, floor } = await ensureRealLot(floors, lots, target.floor, target.lot);
    if (real.id === bogus.id) { console.log('   !! Target equals bogus — skipped.'); continue; }

    // --- Special case: "QM8009Q" (occupied, no assignment) ---
    if (norm === 'QM8009Q') {
      const activeOnReal = await q('parking_assignments', {
        parking_lot_id: `eq.${real.id}`, status: 'eq.ACTIVE', select: 'id',
      });
      if ((activeOnReal || []).length === 0) {
        const veh = await q('vehicles', { plate_number: 'ilike.*QM8009Q*', select: 'id, parker_id' });
        const vehicle = (veh || [])[0];
        if (vehicle) {
          const parkerActive = await q('parking_assignments', {
            parker_id: `eq.${vehicle.parker_id}`, status: 'eq.ACTIVE', select: 'id, parking_lot_id',
          });
          if ((parkerActive || []).length === 0) {
            const now = new Date().toISOString();
            const asg = await post('parking_assignments', {
              parker_id: vehicle.parker_id,
              vehicle_id: vehicle.id,
              parking_lot_id: real.id,
              status: 'ACTIVE',
              start_date: new Date().toISOString().slice(0, 10),
            });
            await post('tags', { assignment_id: asg[0].id, tag_status: 'INSTALLED' });
            await patch('parking_lots', { id: `eq.${real.id}` }, { status: 'OCCUPIED', updated_at: now });
            console.log(`   + restored missing assignment for Ken Chong on P1-${target.lot}`);
          } else {
            console.log('   i Parker already has an ACTIVE assignment elsewhere — not duplicating.');
          }
        } else {
          console.log('   i Vehicle QM8009Q not found — cannot restore assignment.');
        }
      } else {
        console.log(`   i P1-${target.lot} already actively assigned — nothing to restore.`);
      }
    }

    // --- Move assignments ---
    const assignments = await q('parking_assignments', {
      parking_lot_id: `eq.${bogus.id}`,
      select: 'id, status, parker_id, vehicle_id, parker:parkers(id, name)',
    });
    let movedAssignments = 0;
    for (const a of assignments || []) {
      const activeOnReal = await q('parking_assignments', {
        parking_lot_id: `eq.${real.id}`, status: 'eq.ACTIVE', select: 'id, parker_id',
      });
      const conflict = (activeOnReal || []).find((x) => x.id !== a.id);
      if (conflict && a.status === 'ACTIVE') {
        if (conflict.parker_id === a.parker_id) {
          // Duplicate active assignment for same parker: keep one, cancel the dupe.
          await patch('parking_assignments', { id: `eq.${a.id}` }, {
            status: 'CANCELLED',
            end_date: new Date().toISOString().slice(0, 10),
            cancellation_reason: `Duplicate deactivated during data repair (plate-as-lot "${bogus.lot_number}" -> ${floor.floor_code}-${target.lot}).`,
            updated_at: new Date().toISOString(),
          });
          console.log(`   ~ duplicate ACTIVE assignment ${a.id} cancelled (same parker ${a.parker?.name}).`);
        } else {
          throw new Error(
            `CONFLICT: ${floor.floor_code}-${target.lot} is actively assigned to another parker. ` +
            `Aborting before moving assignment ${a.id} (${a.parker?.name}). Manual review needed.`
          );
        }
      }
      await patch('parking_assignments', { id: `eq.${a.id}` }, {
        parking_lot_id: real.id,
        updated_at: new Date().toISOString(),
      });
      movedAssignments++;
      console.log(`   → moved assignment ${a.id} [${a.status}] ${a.parker?.name || ''}`);
    }

    // --- Move BOB requests (FK RESTRICT would block deletion otherwise) ---
    const reqs = await q('bob_requests', { parking_lot_id: `eq.${bogus.id}`, select: 'id, request_number' });
    if ((reqs || []).length > 0) {
      await patch('bob_requests', { parking_lot_id: `eq.${bogus.id}` }, {
        parking_lot_id: real.id,
        updated_at: new Date().toISOString(),
      });
      console.log(`   → repointed ${(reqs || []).length} BOB request(s): ${(reqs || []).map((r) => r.request_number).join(', ')}`);
    }

    // --- Finalize real lot status ---
    const activeAfter = await q('parking_assignments', {
      parking_lot_id: `eq.${real.id}`, status: 'eq.ACTIVE', select: 'id',
    });
    if ((activeAfter || []).length > 0 && real.status !== 'OCCUPIED') {
      await patch('parking_lots', { id: `eq.${real.id}` }, { status: 'OCCUPIED', updated_at: new Date().toISOString() });
      real.status = 'OCCUPIED';
      console.log(`   → lot ${floor.floor_code}-${target.lot} set OCCUPIED`);
    }

    // --- Delete bogus lot ---
    await del('parking_lots', { id: `eq.${bogus.id}` });
    console.log(`   ✓ deleted bogus lot`);

    auditLogs.push({
      action: 'REPAIR_PLATE_AS_LOT',
      entity_type: 'PARKING_LOT',
      entity_id: real.id,
      description: `Data repair: removed bogus lot "${bogus.lot_number}" [${bogusFloor}] (plate stored as lot). Moved ${movedAssignments} assignment(s) and ${(reqs || []).length} BOB request(s) to lot ${floor.floor_code}-${target.lot}.`,
      metadata: { bogusLotNumber: bogus.lot_number, bogusLotId: bogus.id, realLotId: real.id, floor: floor.floor_code, lot: target.lot },
    });
    repaired++;
  }

  if (auditLogs.length > 0) await post('activity_logs', auditLogs);
  console.log(`\nRepaired ${repaired}/${invalidLots.length} bogus lots. Audit logs written.`);

  // ---------- Verification ----------
  console.log('\n=== VERIFICATION ===');
  const remaining = await q('parking_lots', { select: 'id, lot_number' });
  const bad = (remaining || []).filter((l) => !isValidLotNumber(l.lot_number));
  console.log(`Invalid lots remaining: ${bad.length}${bad.length ? ' -> ' + bad.map((l) => l.lot_number).join(', ') : ''}`);

  const gauran = await q('parkers', { name: 'ilike.*GAURAN*', select: 'id, name, parking_assignments(id, status, parking_lot:parking_lots(lot_number, status, floor:floors(floor_code)))' });
  console.log('\nGAURAN AGGARWAL:', JSON.stringify(gauran, null, 2));

  const jee = await q('parkers', { name: 'ilike.*JEE XUAN*', select: 'id, name, parking_assignments(id, status, parking_lot:parking_lots(lot_number, status, floor:floors(floor_code)))' });
  console.log('\nJEE XUAN EN:', JSON.stringify(jee, null, 2));

  const azlan = await q('parkers', { name: 'ilike.*AZLAN BIN ABDUL*', select: 'id, name, parking_assignments(id, status, parking_lot:parking_lots(lot_number, status, floor:floors(floor_code)))' });
  console.log('\nAZLAN BIN ABDUL KADIR:', JSON.stringify(azlan, null, 2));
}

main().catch((e) => {
  console.error('\nREPAIR FAILED:', e.message);
  process.exit(1);
});