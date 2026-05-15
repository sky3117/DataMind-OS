import type { Metadata } from 'next';
import './globals.css';

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
        {children}
      </body>
    </html>
  );
}
