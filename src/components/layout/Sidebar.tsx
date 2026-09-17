'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  LayoutDashboard,
  Car,
  Users,
  Wrench,
  History,
  ClipboardList,
  CheckCircle2,
  FileSpreadsheet,
  LucideIcon,
} from 'lucide-react';

interface SubNavItem {
  name: string;
  href: string;
}

interface NavItem {
  name: string;
  href?: string;
  icon: LucideIcon;
  children?: SubNavItem[];
}

export function Sidebar() {
  const pathname = usePathname();
  const { role } = useAuth();

  const adminNav: NavItem[] = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    {
      name: 'Parking Operations',
      icon: Car,
      children: [{ name: 'Parking Layout', href: '/parking/layout' }],
    },
    {
      name: 'People',
      icon: Users,
      children: [
        { name: 'Parkers', href: '/people/parkers' },
        { name: 'Companies', href: '/people/companies' },
      ],
    },
    {
      name: 'Field Operator Operations',
      icon: Wrench,
      children: [
        { name: 'Field Operator Requests', href: '/bob/requests' },
      ],
    },
    {
      name: 'Insights',
      icon: History,
      children: [
        { name: 'Activity Log', href: '/history/audit-log' },
        { name: 'Reports', href: '/reports' },
      ],
    },
    {
      name: 'Administration',
      icon: FileSpreadsheet,
      children: [
        { name: 'Parking Lots', href: '/parking/lots' },
        { name: 'Data Import', href: '/import' },
      ],
    },
  ];

  const supervisorNav: NavItem[] = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    {
      name: 'Parking Review',
      icon: Car,
      children: [{ name: 'Parking Layout', href: '/parking/layout' }],
    },
    {
      name: 'Field Operator Activity',
      icon: Wrench,
      children: [
        { name: 'Field Operator Requests', href: '/bob/requests' },
      ],
    },
    {
      name: 'Insights',
      icon: History,
      children: [
        { name: 'Activity Log', href: '/history/audit-log' },
        { name: 'Reports', href: '/reports' },
      ],
    },
  ];

  const bobNav: NavItem[] = [
    { name: 'My Tasks', href: '/bob/requests', icon: ClipboardList },
    { name: 'Completed Tasks', href: '/bob/completed', icon: CheckCircle2 },
  ];

  const navItems = role === 'ADMINISTRATOR' ? adminNav : role === 'SUPERVISOR' ? supervisorNav : bobNav;

  return (
    <aside className="brand-sidebar w-64 bg-slate-900 border-r border-slate-800 text-slate-200 min-h-screen flex flex-col flex-shrink-0">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-gradient-to-br from-emerald-950/80 to-green-900/30">
        <div>
          <Image
            src="/hispeedcity-logo.svg"
            alt="Hi speedcity"
            width={185}
            height={51}
            priority
            className="h-auto w-[185px]"
          />
          <div className="mt-2 flex items-center gap-2">
            <span className="text-sm font-extrabold tracking-[0.18em] text-orange-400">RPSMAS</span>
            <span className="h-1 w-1 rounded-full bg-orange-400"></span>
            <span className="text-[10px] text-slate-400 font-medium">Parking Operations</span>
          </div>
        </div>
      </div>

      {/* Nav Menu */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          if (item.children) {
            return (
              <div key={item.name} className="py-1">
                <div className="px-3 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <Icon className="w-4 h-4 text-blue-400" />
                  {item.name}
                </div>
                <div className="ml-4 border-l border-slate-800 pl-3 mt-1 space-y-1">
                  {item.children.map((child: SubNavItem) => {
                    const isActive = pathname === child.href;
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={`block px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                          isActive
                            ? 'bg-blue-600/20 text-blue-400 font-semibold border-l-2 border-blue-500'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                        }`}
                      >
                        {child.name}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          }

          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href || '#'}
              className={`flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white font-semibold shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div className="p-4 border-t border-slate-800 text-[11px] text-slate-500">
        <div className="flex items-center justify-between">
          <span>Status: Standalone</span>
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
        </div>
        <div className="text-[10px] text-slate-600 mt-1">DTeck PMS Integration: Disconnected</div>
      </div>
    </aside>
  );
}
