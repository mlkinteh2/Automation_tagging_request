'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Building2, Car, ChevronDown, ChevronRight, MapPin, Search, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';

interface CompanyRow {
  id: string;
  name: string;
  company_code: string | null;
  status: string;
}

interface ParkerRow {
  id: string;
  name: string;
  status: string;
  company_id: string | null;
  vehicles: { id: string; plate_number: string; status: string }[];
  parking_assignments: {
    id: string;
    status: string;
    parking_lot: { lot_number: string; floor: { floor_code: string } | null } | null;
  }[];
}

interface CompanySummary extends CompanyRow {
  parkers: ParkerRow[];
  activeParkers: number;
  reservedLots: number;
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [parkers, setParkers] = useState<ParkerRow[]>([]);
  const [search, setSearch] = useState('');
  const [expandedCompanies, setExpandedCompanies] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = async () => {
    setLoading(true);
    setError('');

    const [companiesResult, parkersResult] = await Promise.all([
      supabase.from('companies').select('id, name, company_code, status').order('name'),
      supabase
        .from('parkers')
        .select(`
          id,
          name,
          status,
          company_id,
          vehicles(id, plate_number, status),
          parking_assignments(
            id,
            status,
            parking_lot:parking_lots(lot_number, floor:floors(floor_code))
          )
        `)
        .order('name'),
    ]);

    if (companiesResult.error || parkersResult.error) {
      setError(companiesResult.error?.message || parkersResult.error?.message || 'Unable to load company data.');
    } else {
      setCompanies((companiesResult.data || []) as CompanyRow[]);
      setParkers((parkersResult.data || []) as unknown as ParkerRow[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const summaries = useMemo<CompanySummary[]>(() => {
    return companies.map((company) => {
      const companyParkers = parkers.filter((parker) => parker.company_id === company.id);
      const activeParkers = companyParkers.filter((parker) => parker.status === 'ACTIVE');
      const reservedLots = activeParkers.reduce(
        (count, parker) => count + parker.parking_assignments.filter((assignment) => assignment.status === 'ACTIVE').length,
        0,
      );

      return {
        ...company,
        parkers: companyParkers,
        activeParkers: activeParkers.length,
        reservedLots,
      };
    });
  }, [companies, parkers]);

  const filteredSummaries = summaries.filter((company) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return (
      company.name.toLowerCase().includes(query) ||
      company.parkers.some(
        (parker) =>
          parker.name.toLowerCase().includes(query) ||
          parker.vehicles.some((vehicle) => vehicle.plate_number.toLowerCase().includes(query)),
      )
    );
  });

  const toggleCompany = (companyId: string) => {
    setExpandedCompanies((current) => {
      const next = new Set(current);
      if (next.has(companyId)) next.delete(companyId);
      else next.add(companyId);
      return next;
    });
  };

  const totalParkers = summaries.reduce((total, company) => total + company.activeParkers, 0);
  const totalLots = summaries.reduce((total, company) => total + company.reservedLots, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Building2 className="w-6 h-6 text-blue-400" /> Companies Directory
          </h1>
          <p className="text-xs text-slate-400 mt-1">See every parker, registered vehicle, and reserved lot by company</p>
        </div>
        <div className="flex gap-3 text-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-lg px-4 py-2">
            <span className="text-slate-500">Companies</span>
            <span className="ml-2 font-bold text-slate-100">{summaries.length}</span>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-lg px-4 py-2">
            <span className="text-slate-500">Parkers</span>
            <span className="ml-2 font-bold text-blue-400">{totalParkers}</span>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-lg px-4 py-2">
            <span className="text-slate-500">Reserved Lots</span>
            <span className="ml-2 font-bold text-emerald-400">{totalLots}</span>
          </div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
        <div className="relative w-full max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search company, parker, or car plate..."
            className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 pl-9 pr-4 py-2.5 rounded-lg focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {error && <div className="p-4 bg-red-500/10 border border-red-500/40 text-red-400 text-xs font-bold rounded-xl">{error}</div>}

      <div className="space-y-3">
        {loading ? (
          <div className="p-12 text-center text-slate-500 bg-slate-900 border border-slate-800 rounded-xl">Loading companies...</div>
        ) : filteredSummaries.length === 0 ? (
          <div className="p-12 text-center text-slate-500 bg-slate-900 border border-slate-800 rounded-xl">No companies found.</div>
        ) : (
          filteredSummaries.map((company) => {
            const isExpanded = expandedCompanies.has(company.id);
            return (
              <section key={company.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleCompany(company.id)}
                  className="w-full p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-left hover:bg-slate-800/40 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {isExpanded ? <ChevronDown className="w-5 h-5 text-blue-400 shrink-0" /> : <ChevronRight className="w-5 h-5 text-slate-500 shrink-0" />}
                    <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center shrink-0">
                      <Building2 className="w-5 h-5 text-blue-400" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="font-bold text-slate-100 truncate">{company.name}</h2>
                      <p className="text-[11px] text-slate-500">{company.company_code || 'No company code'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-5 pl-8 sm:pl-0 text-xs">
                    <span className="flex items-center gap-1.5 text-slate-300"><Users className="w-4 h-4 text-blue-400" /> {company.activeParkers} parkers</span>
                    <span className="flex items-center gap-1.5 text-slate-300"><MapPin className="w-4 h-4 text-emerald-400" /> {company.reservedLots} lots</span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-slate-800">
                    {company.parkers.length === 0 ? (
                      <div className="p-6 text-xs text-slate-500">No parkers assigned to this company.</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider">
                            <tr>
                              <th className="p-4">Parker</th>
                              <th className="p-4">Car Plates</th>
                              <th className="p-4">Reserved Lots</th>
                              <th className="p-4">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60">
                            {company.parkers.map((parker) => {
                              const activeAssignments = parker.parking_assignments.filter((assignment) => assignment.status === 'ACTIVE');
                              const activeVehicles = parker.vehicles.filter((vehicle) => vehicle.status === 'ACTIVE');
                              return (
                                <tr key={parker.id} className="hover:bg-slate-800/30">
                                  <td className="p-4 font-bold text-slate-100">{parker.name}</td>
                                  <td className="p-4">
                                    <div className="flex flex-wrap gap-1.5">
                                      {activeVehicles.length === 0 ? <span className="text-slate-500">No active plate</span> : activeVehicles.map((vehicle) => (
                                        <span key={vehicle.id} className="px-2 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/30 rounded font-mono font-bold flex items-center gap-1">
                                          <Car className="w-3 h-3" /> {vehicle.plate_number}
                                        </span>
                                      ))}
                                    </div>
                                  </td>
                                  <td className="p-4">
                                    <div className="flex flex-wrap gap-1.5">
                                      {activeAssignments.length === 0 ? <span className="text-slate-500">Unassigned</span> : activeAssignments.map((assignment) => (
                                        <span key={assignment.id} className="px-2 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded font-bold">
                                          {assignment.parking_lot?.floor?.floor_code || '-'} - Lot {assignment.parking_lot?.lot_number || '-'}
                                        </span>
                                      ))}
                                    </div>
                                  </td>
                                  <td className="p-4">
                                    <span className={`px-2 py-1 rounded text-[10px] font-bold ${parker.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
                                      {parker.status}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}
