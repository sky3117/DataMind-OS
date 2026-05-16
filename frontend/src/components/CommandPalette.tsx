'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, X, ArrowRight } from 'lucide-react';

export interface Command {
  id: string;
  label: string;
  description?: string;
  category?: string;
  action: () => void;
  shortcut?: string;
}

interface CommandPaletteProps {
  commands?: Command[];
  isOpen?: boolean;
  onClose?: () => void;
}

export function CommandPalette({
  commands = [],
  isOpen = false,
  onClose,
}: CommandPaletteProps) {
  const [open, setOpen] = useState(isOpen);
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Calculate filtered commands early so it can be used in useEffect
  const filteredCommands = commands.filter(
    (cmd) =>
      cmd.label.toLowerCase().includes(search.toLowerCase()) ||
      (cmd.description?.toLowerCase().includes(search.toLowerCase()) ?? false)
  );

  useEffect(() => {
    setOpen(isOpen);
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(!open);
      }
      if (!open) return;

      if (e.key === 'Escape') {
        setOpen(false);
        onClose?.();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % filteredCommands.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) =>
          i - 1 < 0 ? filteredCommands.length - 1 : i - 1
        );
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action();
          setOpen(false);
          setSearch('');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, search, selectedIndex, filteredCommands, onClose]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={() => {
          setOpen(false);
          onClose?.();
        }}
      />

      {/* Command Palette */}
      <div className="fixed top-0 left-0 right-0 z-50 flex items-start justify-center pt-20">
        <div className="w-full max-w-2xl bg-slate-900 rounded-lg border border-slate-700 shadow-2xl overflow-hidden">
          {/* Search Input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-700">
            <Search size={18} className="text-slate-400" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Type a command..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSelectedIndex(0);
              }}
              className="flex-1 bg-transparent text-slate-100 placeholder-slate-500 focus:outline-none text-lg"
            />
            <button
              onClick={() => {
                setOpen(false);
                onClose?.();
              }}
              className="text-slate-400 hover:text-slate-200"
            >
              <X size={20} />
            </button>
          </div>

          {/* Commands List */}
          <div className="max-h-96 overflow-y-auto">
            {filteredCommands.length === 0 ? (
              <div className="px-4 py-8 text-center text-slate-400">
                No commands found
              </div>
            ) : (
              filteredCommands.map((cmd, index) => (
                <button
                  key={cmd.id}
                  onClick={() => {
                    cmd.action();
                    setOpen(false);
                    setSearch('');
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`w-full px-4 py-3 flex items-center justify-between transition-colors border-b border-slate-800 last:border-b-0 ${
                    index === selectedIndex
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-900 text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <div className="text-left">
                    <div className="font-medium">{cmd.label}</div>
                    {cmd.description && (
                      <div className="text-xs text-slate-400 mt-1">
                        {cmd.description}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {cmd.shortcut && (
                      <span className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded">
                        {cmd.shortcut}
                      </span>
                    )}
                    <ArrowRight size={16} />
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-slate-700 bg-slate-900/50 text-xs text-slate-400">
            <div className="flex gap-4">
              <span>↑↓ Navigate</span>
              <span>↵ Select</span>
              <span>esc Close</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export function useCommandPalette() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleEvent = () => {
      setIsOpen(true);
    };

    window.addEventListener('open-command-palette', handleEvent);
    return () => window.removeEventListener('open-command-palette', handleEvent);
  }, []);

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
  };
}
