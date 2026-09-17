import { isValidLotNumber } from '@/lib/parking/lotValidation';

export interface ParsedRecord {
  floorCode: string;
  lotNumber: string;
  parkerName?: string;
  companyName?: string;
  carPlates: string[];
  remarks?: string;
  isOccupied: boolean;
}

export interface SkippedRow {
  line: string;
  reason: string;
}

export interface ParseResult {
  records: ParsedRecord[];
  skipped: SkippedRow[];
}

/**
 * Parses legacy tab-separated allocation sheets.
 *
 * Guard: the "Lots Allocated" column MUST contain a valid lot number
 * (numeric, optional trailing zone letter). Rows whose lot column holds a
 * vehicle plate or any other non-lot value are rejected and reported as
 * skipped, preventing "plate-as-lot" corruption (e.g. a lot named JSN8883).
 */
export function parseRawSeedText(rawText: string): ParseResult {
  const lines = rawText.split('\n');
  let currentFloor = 'GF';
  const records: ParsedRecord[] = [];
  const skipped: SkippedRow[] = [];

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    // Detect floor headers
    if (line === 'GF' || line === 'P1' || line === 'P2' || line === 'P3') {
      currentFloor = line;
      continue;
    }

    // Skip table header lines
    if (line.toUpperCase().includes('NAME') && line.toUpperCase().includes('COMPANY')) {
      continue;
    }

    const cols = line.split('\t').map(c => c.trim());
    if (cols.length < 4) continue;

    // Col 0: NO
    // Col 1: NAME
    // Col 2: COMPANY
    // Col 3: CAR PLATE
    // Col 4: Lots Allocated / Lot number
    const name = cols[1];
    const company = cols[2];
    const rawPlates = cols[3] || '';
    const lotCol = cols[4] || '';

    // Skip empty placeholder entries or "No parker" entries as real parkers (Rule 31)
    const isNoParker = !name || name.toLowerCase() === 'no parker' || name.toLowerCase() === 'empty';

    // Parse lot number
    let lotNumber = lotCol.replace(/lot/i, '').trim();

    // GUARD: reject rows whose lot column is not a valid lot number
    // (e.g. a vehicle plate leaked into the lot column via shifted columns).
    if (!isValidLotNumber(lotNumber)) {
      skipped.push({
        line,
        reason: `"${lotCol}" is not a valid lot number (expected numeric, e.g. 52). Row ignored to prevent corrupt lot data.`,
      });
      continue;
    }

    // Split multiple car plates (Rule 8)
    const carPlates: string[] = [];
    if (rawPlates && !rawPlates.toLowerCase().includes('no parker') && !rawPlates.toLowerCase().includes('empty')) {
      // Split on /, &, whitespace where plate pattern matches
      const splitRaw = rawPlates.split(/[/&,\n]+/);
      for (const plate of splitRaw) {
        const cleaned = plate.replace(/\s+/g, '').toUpperCase();
        if (cleaned && cleaned.length >= 2) {
          carPlates.push(cleaned);
        }
      }
    }

    records.push({
      floorCode: currentFloor,
      lotNumber,
      parkerName: isNoParker ? undefined : name,
      companyName: company || undefined,
      carPlates,
      remarks: cols[5] || undefined,
      isOccupied: !isNoParker && carPlates.length > 0,
    });
  }

  return { records, skipped };
}