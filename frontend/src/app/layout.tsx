import type { Metadata } from 'next';
import './globals.css';
import Sidebar from '@/components/Sidebar';
import KeyboardShortcuts from '@/components/KeyboardShortcuts';
import { ToastProvider } from '@/components/Toast';

export const metadata: Metadata = {
  title: 'DataMind OS – AI Data Intelligence Platform',
  description: 'Upload, analyze, and chat with your data using AI',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-100 antialiased min-h-screen">
        <ToastProvider>
          <div className="flex">
            <Sidebar />
            <main className="flex-1 lg:ml-0">
              {children}
            </main>
          </div>
          <KeyboardShortcuts />
        </ToastProvider>
      </body>
    </html>
  );
}
