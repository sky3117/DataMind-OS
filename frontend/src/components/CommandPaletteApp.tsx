'use client';

import React, { useState, useEffect } from 'react';
import { CommandPalette, Command, useCommandPalette } from '@/components/CommandPalette';
import { useRouter } from 'next/navigation';
import {
  Home,
  Upload,
  Zap,
  Bot,
  MessageSquare,
  Users,
  Settings,
  FileText,
} from 'lucide-react';

export function CommandPaletteApp() {
  const router = useRouter();
  const { isOpen, open, close } = useCommandPalette();

  const commands: Command[] = [
    // Navigation
    {
      id: 'nav-home',
      label: 'Go to Home',
      description: 'Return to the home page',
      category: 'Navigation',
      shortcut: '⌘U',
      action: () => router.push('/'),
    },
    {
      id: 'nav-pipeline',
      label: 'Go to Pipeline',
      description: 'Open the visual pipeline builder',
      category: 'Navigation',
      shortcut: '⌘P',
      action: () => router.push('/pipeline'),
    },
    {
      id: 'nav-agents',
      label: 'Go to Agents',
      description: 'Access AI data agents',
      category: 'Navigation',
      shortcut: '⌘A',
      action: () => router.push('/agents'),
    },
    {
      id: 'nav-chat',
      label: 'Open AI Chat',
      description: 'Chat with your data',
      category: 'Navigation',
      shortcut: '⌘/',
      action: () => router.push('/'),
    },
    {
      id: 'nav-collaborate',
      label: 'Go to Collaboration',
      description: 'Work with your team',
      category: 'Navigation',
      action: () => router.push('/collaborate'),
    },
    {
      id: 'nav-settings',
      label: 'Open Settings',
      description: 'Manage your preferences',
      category: 'Navigation',
      action: () => router.push('/settings'),
    },

    // Actions
    {
      id: 'action-command-palette',
      label: 'Open Command Palette',
      description: 'Search for commands',
      category: 'Actions',
      shortcut: '⌘K',
      action: () => open(),
    },
  ];

  return (
    <CommandPalette
      commands={commands}
      isOpen={isOpen}
      onClose={close}
    />
  );
}
