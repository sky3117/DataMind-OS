'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function KeyboardShortcuts() {
  const router = useRouter();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Cmd or Ctrl key
      const isMeta = e.metaKey || e.ctrlKey;

      if (!isMeta) return;

      // Prevent default browser shortcuts
      if (e.key === 'u' || e.key === 'U') {
        e.preventDefault();
        router.push('/');
      } else if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        router.push('/pipeline');
      } else if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        router.push('/agents');
      } else if (e.key === '/' && !e.shiftKey) {
        e.preventDefault();
        // Could open command palette or chat
        router.push('/');
      } else if (e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        // Trigger command palette - you can use a context or state management here
        const event = new CustomEvent('open-command-palette');
        window.dispatchEvent(event);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [router]);

  return null;
}
