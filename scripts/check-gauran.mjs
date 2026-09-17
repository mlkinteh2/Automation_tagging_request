/**
 * Diagnostic script: Check parker GAURAN AGGARWAL and lot P2-52 state.
 * Queries Supabase REST API directly.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://lkrvvvhzruajpruqxyzc.supabase.co';
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxrcnZ2dmh6cnVhanBydXF4eXpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5OTMyMDIsImV4cCI6MjEwMjU2OTIwMn0.DNZ4f7sQ1Rx399L-RByEqITac4jhCZWYkSJSS4tpSzE';

async function query(table, searchParams) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  for (const [k, v] of Object.entries(searchParams)) url.searchParams.set(k, v);
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${table}: HTTP ${res.status} - ${text}`);
  }
  return res.json();
}

async function main() {
  console.log('=== 1. Find parker GAURAN AGGARWAL ===');
  const parkers = await query('parkers', { name: 'ilike.*GAURAN*', select: '*' });
  console.log(JSON.stringify(parkers, null, 2));

  if (parkers.length === 0) {
    console.log('!! No parker named GAURAN found.');
    // Try AGGARWAL
    const alt = await query('parkers', { name: 'ilike.*AGGARWAL*', select: '*' });
    console.log('Search by AGGARWAL:', JSON.stringify(alt, null, 2));
    return;
  }

  const parkerId = parkers[0].id;

  console.log('\n=== 2. Vehicles of this parker ===');
  const vehicles = await query('vehicles', { parker_id: `eq.${parkerId}`, select: '*' });
  console.log(JSON.stringify(vehicles, null, 2));

  console.log('\n=== 3. All assignments of this parker (with lot + floor) ===');
  const assignments = await query('parking_assignments', {
    parker_id: `eq.${parkerId}`,
    select: '*, parking_lot:parking_lots(id, lot_number, status, floor:floors(id, floor_code))',
  });
  console.log(JSON.stringify(assignments, null, 2));

  console.log('\n=== 4. Find floor P2 ===');
  const floors = await query('floors', { floor_code: 'eq.P2', select: '*' });
  console.log(JSON.stringify(floors, null, 2));

  if (floors.length > 0) {
    const p2 = floors[0];
    console.log('\n=== 5. All lots numbered 52 on ANY floor (check duplicates) ===');
    const lots52 = await query('parking_lots', { lot_number: 'eq.52', select: 'id, lot_number, status, floor_id, floor:floors(floor_code)' });
    console.log(JSON.stringify(lots52, null, 2));

    console.log(`\n=== 6. Lots on P2 with number >= 50 (context around lot 52) ===`);
    const p2Lots = await query('parking_lots', {
      floor_id: `eq.${p2.id}`,
      select: 'id, lot_number, status, allocated_company_id',
      order: 'lot_number.asc',
    });
    console.log(JSON.stringify(p2Lots.filter(l => parseInt(l.lot_number, 10) >= 48), null, 2));
  }

  console.log('\n=== 7. Vehicle JSN8883 anywhere in system ===');
  const plate = await query('vehicles', { plate_number: 'ilike.*JSN8883*', select: '*, parker:parkers(id, name)' });
  console.log(JSON.stringify(plate, null, 2));

  console.log('\n=== 8. Assignments on any lot numbered 52 ===');
  if (floors.length > 0) {
    const lots52b = await query('parking_lots', { lot_number: 'eq.52', select: 'id' });
    for (const lot of lots52b) {
      const asg = await query('parking_assignments', {
        parking_lot_id: `eq.${lot.id}`,
        select: '*, parker:parkers(id, name), vehicle:vehicles(plate_number)',
      });
      console.log(`Lot ${lot.id}:`, JSON.stringify(asg, null, 2));
    }
  }
}

main().catch((e) => {
  console.error('ERROR:', e.message);
  process.exit(1);
});