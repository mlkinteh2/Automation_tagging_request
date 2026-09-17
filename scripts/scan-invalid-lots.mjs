/**
 * Scan: find ALL parking_lots whose lot_number fails validation (plate-as-lot corruption),
 * including their active assignments, tags and BOB requests.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://lkrvvvhzruajpruqxyzc.supabase.co';
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxrcnZ2dmh6cnVhanBydXF4eXpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5OTMyMDIsImV4cCI6MjEwMjU2OTIwMn0.DNZ4f7sQ1Rx399L-RByEqITac4jhCZWYkSJSS4tpSzE';

async function query(table, searchParams) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  for (const [k, v] of Object.entries(searchParams)) url.searchParams.set(k, v);
  const res = await fetch(url, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`${table}: HTTP ${res.status} - ${await res.text()}`);
  return res.json();
}

function isValidLotNumber(value) {
  return /^\d+[A-Z]?$/i.test(value?.trim() || '');
}

async function main() {
  const lots = await query('parking_lots', {
    select: 'id, lot_number, status, floor:floors(floor_code)',
    order: 'lot_number.asc',
  });

  const invalid = lots.filter((l) => !isValidLotNumber(l.lot_number));
  console.log(`Total lots: ${lots.length}; INVALID (non-numeric) lots: ${invalid.length}\n`);

  for (const lot of invalid) {
    console.log(`--- Lot "${lot.lot_number}" [${lot.floor?.floor_code}] id=${lot.id} status=${lot.status}`);
    const assignments = await query('parking_assignments', {
      parking_lot_id: `eq.${lot.id}`,
      select: 'id, status, parker:parkers(id, name), vehicle:vehicles(plate_number)',
    });
    for (const a of assignments) {
      console.log(`    Assignment ${a.id} [${a.status}] parker=${a.parker?.name} plate=${a.vehicle?.plate_number}`);
      const tags = await query('tags', { assignment_id: `eq.${a.id}`, select: 'id, tag_status' });
      for (const t of tags) console.log(`      Tag ${t.id} [${t.tag_status}]`);
    }
    const reqs = await query('bob_requests', {
      parking_lot_id: `eq.${lot.id}`,
      select: 'id, request_number, request_type, status',
    });
    for (const r of reqs) console.log(`    BOB ${r.request_number} [${r.request_type}/${r.status}]`);
    console.log('');
  }
}

main().catch((e) => {
  console.error('ERROR:', e.message);
  process.exit(1);
});