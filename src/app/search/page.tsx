'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { Search as SearchIcon } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

interface SearchResult { type: string; title: string; detail: string; href: string; }

function SearchResults() {
  const params = useSearchParams();
  const query = (params.get('q') || '').trim();
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const searchRecords = async () => {
      if (!query) { setLoading(false); return; }
      const term = `%${query}%`;
      const [parkers, vehicles, companies, lots, requests] = await Promise.all([
        supabase.from('parkers').select('id, name, company:companies(name)').ilike('name', term).limit(10),
        supabase.from('vehicles').select('id, plate_number, parker:parkers(name)').ilike('plate_number', term).limit(10),
        supabase.from('companies').select('id, name').ilike('name', term).limit(10),
        supabase.from('parking_lots').select('id, lot_number, floor:floors(floor_code)').ilike('lot_number', term).limit(10),
        supabase.from('bob_requests').select('id, request_number, request_type').ilike('request_number', term).limit(10),
      ]);
      setResults([
        ...(parkers.data || []).map((item: any) => ({ type: 'Parker', title: item.name, detail: item.company?.name || 'No company', href: '/people/parkers' })),
        ...(vehicles.data || []).map((item: any) => ({ type: 'Vehicle', title: item.plate_number, detail: item.parker?.name || 'No parker', href: '/people/vehicles' })),
        ...(companies.data || []).map((item: any) => ({ type: 'Company', title: item.name, detail: 'Company directory', href: '/people/companies' })),
        ...(lots.data || []).map((item: any) => ({ type: 'Parking Lot', title: `Lot ${item.lot_number}`, detail: item.floor?.floor_code || '', href: '/parking/lots' })),
        ...(requests.data || []).map((item: any) => ({ type: 'Field Operator Request', title: item.request_number, detail: item.request_type, href: '/bob/requests' })),
      ]);
      setLoading(false);
    };
    searchRecords();
  }, [query]);

  return <div className="space-y-6 max-w-5xl"><div><h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2"><SearchIcon className="w-6 h-6 text-blue-400" /> Search Results</h1><p className="text-xs text-slate-400 mt-1">Global search for parker, company, vehicle, lot, and Field Operator request records</p></div>{!query ? <div className="p-10 bg-slate-900 border border-slate-800 rounded-xl text-sm text-slate-500">Enter a search term in the header.</div> : loading ? <div className="p-10 bg-slate-900 border border-slate-800 rounded-xl text-sm text-slate-500">Searching for “{query}”...</div> : results.length === 0 ? <div className="p-10 bg-slate-900 border border-slate-800 rounded-xl text-sm text-slate-500">No records found for “{query}”.</div> : <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-800">{results.map((result, index) => <Link key={`${result.type}-${result.title}-${index}`} href={result.href} className="flex items-center justify-between gap-4 p-4 hover:bg-slate-800/40"><div><div className="text-[10px] uppercase font-bold text-green-700">{result.type}</div><div className="font-bold text-slate-100 mt-1">{result.title}</div></div><div className="text-xs text-slate-400">{result.detail}</div></Link>)}</div>}</div>;
}

export default function SearchPage() {
  return <Suspense fallback={<div className="p-10 text-sm text-slate-500">Loading search...</div>}><SearchResults /></Suspense>;
}
