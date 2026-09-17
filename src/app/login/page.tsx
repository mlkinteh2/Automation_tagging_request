'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { ArrowRight, BriefcaseBusiness, LockKeyhole, Mail, ShieldCheck, UserRound, Wrench } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import type { UserRole } from '@/types/database';

const roles: { role: UserRole; label: string; description: string; icon: typeof ShieldCheck; email: string }[] = [
  { role: 'ADMINISTRATOR', label: 'Administrator', description: 'Manage parking, people, imports, and reports.', icon: ShieldCheck, email: 'admin@parkingco.com' },
  { role: 'SUPERVISOR', label: 'Supervisor', description: 'Review operations, assignments, and audit activity.', icon: BriefcaseBusiness, email: 'supervisor@parkingco.com' },
  { role: 'BOB', label: 'Field Operator', description: 'Complete installation and removal tasks in the field.', icon: Wrench, email: 'fieldops@parkingco.com' },
];

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [selectedRole, setSelectedRole] = useState<UserRole>('ADMINISTRATOR');
  const [email, setEmail] = useState('admin@parkingco.com');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectRole = (role: (typeof roles)[number]) => {
    setSelectedRole(role.role);
    setEmail(role.email);
    setPassword(role.role === 'ADMINISTRATOR' ? 'admin123' : role.role === 'SUPERVISOR' ? 'supervisor123' : 'field123');
    setError('');
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    const result = login(email, password);
    if (!result.success) {
      setError(result.message || 'Unable to sign in.');
      setIsSubmitting(false);
      return;
    }
    router.replace('/dashboard');
  };

  return (
    <main className="login-page min-h-screen bg-white px-4 py-8 sm:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-3xl border border-green-100 bg-white shadow-[0_24px_70px_rgba(13,115,48,0.14)] lg:grid-cols-[0.9fr_1.1fr]">
          <section className="login-hero flex flex-col justify-between bg-green-700 p-8 text-white sm:p-12">
            <div>
              <Image src="/hispeedcity-logo.svg" alt="Hi speedcity" width={210} height={58} priority className="h-auto w-[210px] brightness-0 invert" />
              <div className="mt-8 max-w-sm"><div className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-green-100">Parking Operations</div><h1 className="text-4xl font-black leading-tight text-white sm:text-5xl">Reserved parking, clearly managed.</h1><p className="mt-5 text-sm leading-6 text-green-50">A single workspace for parking assignments, parker records, and field signboard operations.</p></div>
            </div>
            <div className="mt-12 flex items-center gap-3 text-xs font-semibold text-green-50"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-green-900/30"><UserRound className="h-4 w-4" /></div> Secure role-based access for every operator</div>
          </section>

          <section className="p-6 sm:p-10">
            <div className="mb-8"><div className="text-xs font-bold uppercase tracking-[0.18em] text-green-700">RPSMAS workspace</div><h2 className="mt-2 text-3xl font-black text-green-950">Welcome back</h2><p className="mt-2 text-sm text-slate-500">Choose your role and sign in to continue.</p></div>
            <div className="mb-7 grid gap-2 sm:grid-cols-3">
              {roles.map((role) => { const Icon = role.icon; const active = selectedRole === role.role; return <button key={role.role} type="button" onClick={() => selectRole(role)} className={`rounded-2xl border p-3 text-left transition ${active ? 'border-green-600 bg-green-50 shadow-sm' : 'border-slate-200 bg-white hover:border-green-300 hover:bg-green-50/50'}`}><Icon className={`h-5 w-5 ${active ? 'text-green-700' : 'text-slate-400'}`} /><span className={`mt-2 block text-xs font-extrabold ${active ? 'text-green-900' : 'text-slate-700'}`}>{role.label}</span><span className="mt-1 block text-[10px] leading-4 text-slate-500">{role.description}</span></button>; })}
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div><label htmlFor="login-email" className="mb-1.5 block text-xs font-bold text-green-950">Email address</label><div className="relative"><Mail className="absolute left-3 top-3 h-4 w-4 text-green-700" /><input id="login-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-xl border border-green-100 bg-green-50/40 py-2.5 pl-10 pr-3 text-sm text-green-950 outline-none" /></div></div>
              <div><label htmlFor="login-password" className="mb-1.5 block text-xs font-bold text-green-950">Password</label><div className="relative"><LockKeyhole className="absolute left-3 top-3 h-4 w-4 text-green-700" /><input id="login-password" type="password" required value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-xl border border-green-100 bg-green-50/40 py-2.5 pl-10 pr-3 text-sm text-green-950 outline-none" /></div></div>
              {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-700">{error}</div>}
              <button type="submit" disabled={isSubmitting} className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-700 px-4 py-3 text-sm font-extrabold text-white shadow-lg shadow-green-700/20 transition hover:bg-green-800 disabled:opacity-60">{isSubmitting ? 'Signing in...' : 'Sign in'} <ArrowRight className="h-4 w-4" /></button>
            </form>
            <div className="mt-6 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-[11px] leading-4 text-amber-900"><span className="font-extrabold">Demo:</span><span>Administrator `admin123`, Supervisor `supervisor123`, Field Operator `field123`.</span></div>
          </section>
        </div>
      </div>
    </main>
  );
}
