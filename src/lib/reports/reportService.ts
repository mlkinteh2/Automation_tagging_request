import { supabase } from '@/lib/supabase/client';
import { CsvCell } from './csv';

/**
 * ReportService — builds the 6 essential operational/BI reports (Requirements 36 & 37)
 * from live Supabase data and returns RFC 4180 CSV content.
 *
 * Curated for management value — redundant data listings were removed because they
 * already exist as live, filterable views on their dedicated pages:
 *  1. Parking Occupancy Rate      — core capacity KPI per floor
 *  2. Company Allocation Summary  — corporate lot utilization
 *  3. Pending BOB Operations      — actionable field-ops backlog
 *  4. Average BOB Completion Time — BOB SLA performance
 *  5. Cancellations Report        — audit trail with reasons
 *  6. Complete Parking History    — full archive for audit / Power BI
 */
export class ReportService {
  private static fmtDate(value?: string | null): string {
    if (!value) return '';
    const d = new Date(value);
    return isNaN(d.getTime()) ? '' : d.toLocaleString();
  }

  private static fmtDay(value?: string | null): string {
    if (!value) return '';
    const d = new Date(value);
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString();
  }

  /** 1. Parking Occupancy Rate — occupied vs available lots per floor */
  static async occupancyRate(): Promise<{ columns: string[]; rows: CsvCell[][] }> {
    const { data, error } = await supabase
      .from('parking_lots')
      .select('lot_number, status, floors(floor_code, floor_name)');

    if (error) throw new Error(error.message);

    const map = new Map<
      string,
      { total: number; occupied: number; available: number; pending: number; maintenance: number; inactive: number }
    >();

    for (const lot of data || []) {
      const floor = (lot.floors as { floor_code?: string } | null)?.floor_code || 'UNKNOWN';
      if (!map.has(floor)) {
        map.set(floor, { total: 0, occupied: 0, available: 0, pending: 0, maintenance: 0, inactive: 0 });
      }
      const f = map.get(floor)!;
      f.total++;
      if (lot.status === 'OCCUPIED') f.occupied++;
      else if (lot.status === 'AVAILABLE') f.available++;
      else if (lot.status === 'PENDING_INSTALLATION' || lot.status === 'PENDING_REMOVAL') f.pending++;
      else if (lot.status === 'MAINTENANCE') f.maintenance++;
      else if (lot.status === 'INACTIVE') f.inactive++;
    }

    const rows: CsvCell[][] = Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([floor, f]) => [
        floor,
        f.total,
        f.occupied,
        f.available,
        f.pending,
        f.maintenance,
        f.inactive,
        f.total > 0 ? `${Math.round((f.occupied / f.total) * 100)}%` : '0%',
      ]);

    return {
      columns: ['Floor', 'Total Lots', 'Occupied', 'Available', 'Pending', 'Maintenance', 'Inactive', 'Occupancy Rate'],
      rows,
    };
  }

  /** 2. Company Allocation Summary — reserved lot distribution & utilization per company */
  static async companyAllocation(): Promise<{ columns: string[]; rows: CsvCell[][] }> {
    const { data, error } = await supabase
      .from('parking_lots')
      .select('id, status, allocated_company_id, companies(name, company_code)');

    if (error) throw new Error(error.message);

    const map = new Map<string, { code: string; name: string; total: number; occupied: number; available: number; other: number }>();

    for (const lot of data || []) {
      const company = lot.companies as { name?: string; company_code?: string } | null;
      if (!company) continue;
      const key = company.name || 'Unknown';
      if (!map.has(key)) {
        map.set(key, { code: company.company_code || '', name: key, total: 0, occupied: 0, available: 0, other: 0 });
      }
      const c = map.get(key)!;
      c.total++;
      if (lot.status === 'OCCUPIED') c.occupied++;
      else if (lot.status === 'AVAILABLE') c.available++;
      else c.other++;
    }

    const rows: CsvCell[][] = Array.from(map.values())
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((c) => [c.code, c.name, c.total, c.occupied, c.available, c.other, c.total > 0 ? `${Math.round((c.occupied / c.total) * 100)}%` : '0%']);

    return {
      columns: ['Company Code', 'Company Name', 'Allocated Lots', 'Occupied', 'Available', 'Other Status', 'Utilization'],
      rows,
    };
  }

  /** 3. Cancellations Report — historical cancellations log with reasons */
  static async cancellations(): Promise<{ columns: string[]; rows: CsvCell[][] }> {
    const { data, error } = await supabase
      .from('parking_assignments')
      .select(
        'end_date, cancellation_reason, updated_at, parkers(name), vehicles(plate_number), parking_lots(lot_number, floors(floor_code))'
      )
      .eq('status', 'CANCELLED')
      .order('updated_at', { ascending: false })
      .limit(500);

    if (error) throw new Error(error.message);

    const rows: CsvCell[][] = (data || []).map((a) => [
      this.fmtDate(a.updated_at),
      (a.parkers as { name?: string } | null)?.name || '',
      (a.vehicles as { plate_number?: string } | null)?.plate_number || '',
      (a.parking_lots as { lot_number?: string; floors?: { floor_code?: string } } | null)?.floors?.floor_code || '',
      (a.parking_lots as { lot_number?: string } | null)?.lot_number || '',
      a.cancellation_reason || '',
    ]);

    return {
      columns: ['Cancelled At', 'Parker', 'Plate Number', 'Floor', 'Lot', 'Cancellation Reason'],
      rows,
    };
  }

  /** 4. Pending BOB Operations — backlog of active physical tag requests */
  static async pendingBobOperations(): Promise<{ columns: string[]; rows: CsvCell[][] }> {
    const { data, error } = await supabase
      .from('bob_requests')
      .select(
        'request_number, request_type, status, created_at, vehicles(plate_number), parking_lots(lot_number, floors(floor_code)), parking_assignments(parkers(name))'
      )
      .in('status', ['PENDING', 'IN_PROGRESS'])
      .order('created_at', { ascending: true });

    if (error) throw new Error(error.message);

    const rows: CsvCell[][] = (data || []).map((r) => [
      r.request_number,
      r.request_type,
      r.status,
      this.fmtDate(r.created_at),
      (r.parking_assignments as { parkers?: { name?: string } } | null)?.parkers?.name || '',
      (r.vehicles as { plate_number?: string } | null)?.plate_number || '',
      (r.parking_lots as { lot_number?: string; floors?: { floor_code?: string } } | null)?.floors?.floor_code || '',
      (r.parking_lots as { lot_number?: string } | null)?.lot_number || '',
    ]);

    return {
      columns: ['Request Number', 'Type', 'Status', 'Created At', 'Parker', 'Plate Number', 'Floor', 'Lot'],
      rows,
    };
  }

  /** 5. Average BOB Completion Time — SLA metric: request creation → confirmation */
  static async bobCompletionTime(): Promise<{ columns: string[]; rows: CsvCell[][] }> {
    const { data, error } = await supabase
      .from('bob_requests')
      .select('request_number, request_type, created_at, completed_at')
      .eq('status', 'COMPLETED')
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(500);

    if (error) throw new Error(error.message);

    const rows: CsvCell[][] = [];
    const totals: Record<string, { sum: number; count: number }> = {
      INSTALLATION: { sum: 0, count: 0 },
      REMOVAL: { sum: 0, count: 0 },
    };

    for (const r of data || []) {
      const created = new Date(r.created_at).getTime();
      const completed = new Date(r.completed_at as string).getTime();
      if (isNaN(created) || isNaN(completed)) continue;
      const hours = (completed - created) / 3_600_000;
      if (totals[r.request_type]) {
        totals[r.request_type].sum += hours;
        totals[r.request_type].count++;
      }
      rows.push([r.request_number, r.request_type, this.fmtDate(r.created_at), this.fmtDate(r.completed_at), `${hours.toFixed(2)}h`]);
    }

    rows.push([]);
    rows.push(['--- SLA Summary ---', '', '', '', '']);
    for (const [type, t] of Object.entries(totals)) {
      const avg = t.count > 0 ? `${(t.sum / t.count).toFixed(2)}h` : 'N/A';
      rows.push([`Average ${type} Completion`, `${t.count} completed`, '', '', avg]);
    }

    return {
      columns: ['Request Number', 'Type', 'Created At', 'Completed At', 'Completion Time'],
      rows,
    };
  }

  /** 6. Complete Parking History — full archived log of assignments & tag movements */
  static async completeHistory(): Promise<{ columns: string[]; rows: CsvCell[][] }> {
    const { data, error } = await supabase
      .from('parking_assignments')
      .select(
        'created_at, start_date, end_date, status, cancellation_reason, parkers(name), vehicles(plate_number), parking_lots(lot_number, floors(floor_code)), tags(tag_status, installed_at, removed_at)'
      )
      .order('created_at', { ascending: false })
      .limit(1000);

    if (error) throw new Error(error.message);

    const rows: CsvCell[][] = (data || []).map((a) => {
      const tag = (a.tags as { tag_status: string; installed_at?: string; removed_at?: string }[] | null)?.[0];
      return [
        this.fmtDate(a.created_at),
        this.fmtDay(a.start_date),
        this.fmtDay(a.end_date),
        a.status,
        (a.parkers as { name?: string } | null)?.name || '',
        (a.vehicles as { plate_number?: string } | null)?.plate_number || '',
        (a.parking_lots as { lot_number?: string; floors?: { floor_code?: string } } | null)?.floors?.floor_code || '',
        (a.parking_lots as { lot_number?: string } | null)?.lot_number || '',
        tag?.tag_status || '',
        this.fmtDate(tag?.installed_at),
        this.fmtDate(tag?.removed_at),
        a.cancellation_reason || '',
      ];
    });

    return {
      columns: ['Created At', 'Start Date', 'End Date', 'Status', 'Parker', 'Plate Number', 'Floor', 'Lot', 'Tag Status', 'Installed At', 'Removed At', 'Cancellation Reason'],
      rows,
    };
  }
}