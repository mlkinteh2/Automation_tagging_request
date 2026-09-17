'use client';

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { getDefaultPath, isPathAllowed } from '@/lib/access';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, isLoading, role } = useAuth();
  const isLoginPage = pathname === '/login';

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated && !isLoginPage) {
      router.replace('/login');
    } else if (isAuthenticated && isLoginPage) {
      router.replace(getDefaultPath(role));
    } else if (isAuthenticated && !isPathAllowed(role, pathname)) {
      router.replace(getDefaultPath(role));
    }
  }, [isAuthenticated, isLoading, isLoginPage, pathname, role, router]);

  if (isLoginPage) return <>{children}</>;
  if (isLoading || !isAuthenticated) return <div className="min-h-screen bg-white" />;

  return (
    <div className="flex min-h-screen flex-row overflow-x-hidden">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
