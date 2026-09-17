'use client';

import React, { useState } from 'react';
import { FileText, Download, BarChart2, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { ReportService } from '@/lib/reports/reportService';
import { toCsv, downloadCsv } from '@/lib/reports/csv';

interface ReportDef {
  title: string;
  desc: string;
  fetcher: () => Promise<{ columns: string[]; rows: (string | number)[][] }>;
}

export default function ReportsPage() {
  const [busyReport, setBusyReport] = useState<string | null>(null);
  const [errorReport, setErrorReport] = useState<string | null>(null);
  const [doneReport, setDoneReport] = useState<string | null>(null);

  // Curated essential reports only — redundant listings (available lots, parker
  // directory, Field Operator request queues, assignment/transfer logs) already exist as
  // live, filterable views on their dedicated pages (Parking Layout, Parkers,
  // Field Operator Requests) or are covered by Complete Parking History.
  const reportsList: ReportDef[] = [
    { title: '1. Parking Occupancy Rate', desc: 'Breakdown of occupied vs available lots per floor and facility', fetcher: ReportService.occupancyRate },
    { title: '2. Company Allocation Summary', desc: 'Reserved lot distribution and utilization per corporate account', fetcher: ReportService.companyAllocation },
    { title: '3. Pending Field Operator Operations', desc: 'Backlog of active physical tag requests', fetcher: ReportService.pendingBobOperations },
    { title: '4. Average Field Operator Completion Time', desc: 'SLA metric tracking time between request creation and confirmation', fetcher: ReportService.bobCompletionTime },
    { title: '5. Cancellations Report', desc: 'Historical cancellations log with reasons', fetcher: ReportService.cancellations },
    { title: '6. Complete Parking History', desc: 'Full archived log of assignments and tag movements', fetcher: ReportService.completeHistory },
  ];

  const exportCSV = async (report: ReportDef) => {
    setBusyReport(report.title);
    setErrorReport(null);
    setDoneReport(null);
    try {
      const { columns, rows } = await report.fetcher();
      const csv = toCsv(columns, rows);
      const filename = `${report.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
      downloadCsv(filename, csv);
      setDoneReport(`${report.title} — ${rows.length} row${rows.length === 1 ? '' : 's'} exported`);
      setTimeout(() => setDoneReport((current) => (current?.startsWith(report.title) ? null : current)), 4000);
    } catch (err) {
      console.error(`Failed to export report "${report.title}":`, err);
      setErrorReport(`${report.title}: ${err instanceof Error ? err.message : 'Export failed'}`);
    } finally {
      setBusyReport(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-blue-400" /> Operational & BI Reports
          </h1>
          <p className="text-xs text-slate-400 mt-1">Exportable reporting suits for management & Power BI integration (Requirement 36 & 37)</p>
        </div>
      </div>

      {errorReport && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {errorReport}
        </div>
      )}

      {doneReport && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> {doneReport}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reportsList.map((rep) => {
          const isBusy = busyReport === rep.title;
          return (
            <div key={rep.title} className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-blue-500/50 transition-colors flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-slate-100">{rep.title}</span>
                  <FileText className="w-4 h-4 text-blue-400" />
                </div>
                <p className="text-xs text-slate-400 mb-4">{rep.desc}</p>
              </div>

              <button
                onClick={() => exportCSV(rep)}
                disabled={isBusy}
                className="w-full py-2 bg-slate-950 hover:bg-blue-600 hover:text-white disabled:opacity-60 disabled:cursor-not-allowed border border-slate-800 text-slate-300 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors"
              >
                {isBusy ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating...
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" /> Export to CSV
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}