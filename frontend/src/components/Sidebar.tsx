'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Upload,
  BarChart3,
  Zap,
  Bot,
  MessageSquare,
  LayoutDashboard,
  Users,
  Settings,
  ChevronDown,
  Menu,
  X,
  Brain,
} from 'lucide-react';
import { clsx } from 'clsx';

interface SidebarItem {
  icon?: React.ElementType;
  label?: string;
  href?: string;
  shortcut?: string;
  divider?: boolean;
}

const SIDEBAR_ITEMS: SidebarItem[] = [
  { icon: Home, label: 'Home', href: '/' },
  { icon: Upload, label: 'Upload', href: '/upload', shortcut: '⌘U' },
  { icon: BarChart3, label: 'Profile', href: '/profile' },
  { divider: true },
  { icon: Zap, label: 'Pipeline', href: '/pipeline', shortcut: '⌘P' },
  { icon: Bot, label: 'Agents', href: '/agents', shortcut: '⌘A' },
  { icon: MessageSquare, label: 'AI Chat', href: '/chat', shortcut: '⌘/' },
  { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard' },
  { icon: Users, label: 'Collaborate', href: '/collaborate' },
  { divider: true },
  { icon: Settings, label: 'Settings', href: '/settings' },
];

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };

  const isActive = (href?: string) => {
    if (!href) return false;
    return pathname === href || pathname.startsWith(href + '/');
  };

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={toggleSidebar}
        className="fixed top-4 left-4 z-50 lg:hidden p-2 hover:bg-slate-800 rounded-lg text-slate-300"
      >
        {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed left-0 top-0 h-screen bg-slate-900/95 border-r border-slate-800 w-64 flex flex-col z-40 transition-transform duration-300 lg:relative lg:translate-x-0 lg:bg-slate-900',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-6 border-b border-slate-800">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-100">DataMind</div>
            <div className="text-xs text-indigo-400">OS</div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-6 space-y-1">
          {SIDEBAR_ITEMS.map((item, idx) => {
            if (item.divider) {
              return (
                <div
                  key={`divider-${idx}`}
                  className="h-px bg-slate-800 my-4"
                />
              );
            }

            const Icon = item.icon;
            const active = isActive(item.href);

            return (
              <Link
                key={item.label}
                href={item.href || '#'}
                onClick={() => setIsOpen(false)}
                className={clsx(
                  'flex items-center justify-between gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all',
                  active
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                )}
              >
                <div className="flex items-center gap-3">
                  {Icon && <Icon className="w-4 h-4" />}
                  <span>{item.label}</span>
                </div>
                {item.shortcut && (
                  <span className="text-xs text-slate-500">{item.shortcut}</span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800">
          <p className="text-xs text-slate-500">
            DataMind OS <span className="text-indigo-400">Phase 2</span>
          </p>
        </div>
      </aside>
    </>
  );
}
