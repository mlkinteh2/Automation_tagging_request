'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { ArrowRight, LockKeyhole, Mail, ShieldCheck, UserRound, Wrench } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const adminLogin = process.env.NEXT_PUBLIC_ADMIN_USERNAME || 'Admin';
  const fieldOperatorLogin = process.env.NEXT_PUBLIC_FIELD_OPERATOR_USERNAME || 'field';
  const [accountType, setAccountType] = useState<'administrator' | 'field-operator'>('administrator');
  const [email, setEmail] = useState(adminLogin);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    const result = login(email, password);
    if (!result.success) {
      setError(result.message || 'Access is restricted to the configured administrator and field operator accounts.');
      setIsSubmitting(false);
      return;
    }
    router.replace('/dashboard');
  };

  const selectAccount = (type: 'administrator' | 'field-operator') => {
    setAccountType(type);
    setEmail(type === 'administrator' ? adminLogin : fieldOperatorLogin);
    setPassword('');
    setError('');
  };

  return (
    <main className="login-page min-h-screen bg-white px-4 py-8 sm:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-3xl border border-green-100 bg-white shadow-[0_24px_70px_rgba(13,115,48,0.14)] lg:grid-cols-[0.9fr_1.1fr]">
          <section className="login-hero flex flex-col justify-between bg-green-700 p-8 text-white sm:p-12">
            <div>
              <Image src="/hispeedcity-logo.svg" alt="Hi speedcity" width={210} height={58} priority className="h-auto w-[210px] brightness-0 invert" />
              <div className="mt-8 max-w-sm"><div className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-green-100">Parking Operations</div><h1 className="text-4xl font-black leading-tight text-white sm:text-5xl">Reserved parking, clearly managed.</h1><p className="mt-5 text-sm leading-6 text-green-50">A secure workspace for parking assignments, parker records, and field signboard operations.</p></div>
            </div>
            <div className="mt-12 flex items-center gap-3 text-xs font-semibold text-green-50"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-green-900/30"><UserRound className="h-4 w-4" /></div> Administrator and Field Operator access</div>
          </section>

          <section className="p-6 sm:p-10">
            <div className="mb-8"><div className="text-xs font-bold uppercase tracking-[0.18em] text-green-700">RPSMAS workspace</div><h2 className="mt-2 text-3xl font-black text-green-950">Sign in</h2><p className="mt-2 text-sm text-slate-500">Choose your authorized system account to continue.</p></div>

            <div className="mb-6 rounded-2xl border border-green-200 bg-green-50 p-4">
              <div className="flex items-center gap-2 text-green-800">
                <ShieldCheck className="h-4 w-4" />
                <span className="text-xs font-extrabold uppercase tracking-[0.12em]">Two authorized users</span>
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-600">Access is limited to the configured Administrator and Field Operator accounts.</p>
            </div>

            <div className="mb-6 grid grid-cols-2 gap-3">
              <button type="button" onClick={() => selectAccount('administrator')} className={`rounded-xl border p-3 text-left transition ${accountType === 'administrator' ? 'border-green-600 bg-green-50' : 'border-slate-200 bg-white hover:border-green-300'}`}>
                <UserRound className={`h-5 w-5 ${accountType === 'administrator' ? 'text-green-700' : 'text-slate-400'}`} />
                <span className="mt-2 block text-xs font-extrabold text-green-950">Administrator</span>
                <span className="mt-1 block text-[11px] text-slate-500">Full system access</span>
              </button>
              <button type="button" onClick={() => selectAccount('field-operator')} className={`rounded-xl border p-3 text-left transition ${accountType === 'field-operator' ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-white hover:border-blue-300'}`}>
                <Wrench className={`h-5 w-5 ${accountType === 'field-operator' ? 'text-blue-700' : 'text-slate-400'}`} />
                <span className="mt-2 block text-xs font-extrabold text-green-950">Field Operator</span>
                <span className="mt-1 block text-[11px] text-slate-500">Tag operations access</span>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div><label htmlFor="login-username" className="mb-1.5 block text-xs font-bold text-green-950">Username</label><div className="relative"><Mail className="absolute left-3 top-3 h-4 w-4 text-green-700" /><input id="login-username" type="text" required value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-xl border border-green-100 bg-green-50/40 py-2.5 pl-10 pr-3 text-sm text-green-950 outline-none" /></div></div>
              <div><label htmlFor="login-password" className="mb-1.5 block text-xs font-bold text-green-950">Password</label><div className="relative"><LockKeyhole className="absolute left-3 top-3 h-4 w-4 text-green-700" /><input id="login-password" type="password" required value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-xl border border-green-100 bg-green-50/40 py-2.5 pl-10 pr-3 text-sm text-green-950 outline-none" /></div></div>
              {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-700">{error}</div>}
              <button type="submit" disabled={isSubmitting} className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-700 px-4 py-3 text-sm font-extrabold text-white shadow-lg shadow-green-700/20 transition hover:bg-green-800 disabled:opacity-60">{isSubmitting ? 'Signing in...' : 'Sign in'} <ArrowRight className="h-4 w-4" /></button>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}
