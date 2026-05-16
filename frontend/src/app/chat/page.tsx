'use client';

import { useGlobalContext } from '@/context/GlobalContext';
import ChatInterface from '@/components/ChatInterface';
import { Upload, MessageSquare, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function ChatPage() {
  const { fileId, filename } = useGlobalContext();

  if (!fileId) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12">
            <div className="w-16 h-16 bg-slate-800 rounded-xl flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="w-8 h-8 text-slate-400" />
            </div>
            <h2 className="text-xl font-semibold text-slate-200 mb-2">No file loaded</h2>
            <p className="text-sm text-slate-400 mb-6">
              Upload a file to start asking questions about your data using AI. Powered by Claude.
            </p>
            <Link
              href="/upload"
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors"
            >
              <Upload className="w-4 h-4" />
              Upload File
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div>
              <h1 className="text-2xl font-bold text-slate-100">AI Chat</h1>
              <p className="text-sm text-slate-400 mt-0.5">
                Ask questions about{' '}
                <span className="text-slate-200 font-medium">{filename}</span>
              </p>
            </div>
            <div className="flex items-center gap-2 px-3 py-1 bg-slate-800 border border-slate-700 rounded-lg">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-sm text-slate-300 font-medium truncate max-w-xs">
                {filename}
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ChatInterface fileId={fileId} filename={filename || ''} />
      </div>
    </div>
  );
}
