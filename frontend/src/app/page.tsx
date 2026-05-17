'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGlobalContext } from '@/context/GlobalContext';
import FileUploader from '@/components/FileUploader';
import { Brain, Upload, BarChart3, MessageSquare, LayoutDashboard, ChevronRight, FileText, Clock } from 'lucide-react';
import type { UploadResponse } from '@/types';
import { listFiles } from '@/lib/api';
import Link from 'next/link';

// Display last 5 files in recent uploads section
const RECENT_FILES_DISPLAY_COUNT = 5;
// Delay before navigation to allow users to see success message (notification auto-dismisses at 3000ms)
const NAVIGATION_DELAY_MS = 2000;

export default function HomePage() {
  const router = useRouter();
  const { fileId, filename, uploadedFiles, setUploadedFiles } = useGlobalContext();
  const [isLoadingFiles, setIsLoadingFiles] = useState(true);

  useEffect(() => {
    const loadFiles = async () => {
      try {
        const response = await listFiles();
        setUploadedFiles(response.files);
      } catch (err) {
        console.error('Failed to load files:', err);
      } finally {
        setIsLoadingFiles(false);
      }
    };

    loadFiles();
  }, [setUploadedFiles]);

  const handleUpload = (response: UploadResponse) => {
    setTimeout(() => router.push('/profile'), NAVIGATION_DELAY_MS);
  };

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <Brain className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="text-lg font-bold text-slate-100">DataMind OS</span>
              </div>
            </div>

            {fileId && (
              <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-slate-300 font-medium truncate max-w-48">
                  {filename}
                </span>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero */}
        {!fileId && (
          <div className="text-center mb-12">
            <h1 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-4">
              AI-Powered Data Intelligence
            </h1>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              Upload your dataset and instantly get deep insights, AI-powered analysis, 
              build visual pipelines, and collaborate with your team.
            </p>
          </div>
        )}

        {/* Main content area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          {/* Upload section */}
          <div className="lg:col-span-2">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-slate-200">Upload Dataset</h2>
              <p className="text-sm text-slate-500 mt-1">
                Supports CSV, XLSX, and XLS files up to 50MB
              </p>
            </div>
            <FileUploader onUpload={handleUpload} />
          </div>

          {/* Quick actions */}
          <div className="space-y-4">
            {[
              {
                icon: BarChart3,
                label: 'Profile',
                href: '/profile',
                disabled: !fileId,
                description: 'View data quality',
              },
              {
                icon: MessageSquare,
                label: 'AI Chat',
                href: '/chat',
                disabled: !fileId,
                description: 'Ask questions',
              },
              {
                icon: LayoutDashboard,
                label: 'Dashboard',
                href: '/dashboard',
                disabled: !fileId,
                description: 'View charts',
              },
            ].map(({ icon: Icon, label, href, disabled, description }) => (
              <Link
                key={label}
                href={href}
                className={`block p-4 rounded-xl border transition-all ${
                  disabled
                    ? 'bg-slate-900/50 border-slate-800 text-slate-500 cursor-not-allowed opacity-50'
                    : 'bg-slate-900 border-slate-800 hover:border-indigo-600 text-slate-200 hover:text-indigo-400'
                }`}
              >
                <Icon className="w-5 h-5 mb-2" />
                <p className="font-medium text-sm">{label}</p>
                <p className="text-xs text-slate-500 mt-1">{description}</p>
              </Link>
            ))}
          </div>
        </div>

        {/* Features grid */}
        {!fileId && (
          <div className="mb-12">
            <h3 className="text-lg font-semibold text-slate-200 mb-4">Powerful Features</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                {
                  icon: BarChart3,
                  title: 'Deep Profiling',
                  desc: 'Automatic column analysis, null counts, outliers, and health scoring',
                },
                {
                  icon: MessageSquare,
                  title: 'AI Chat',
                  desc: 'Ask natural language questions powered by Claude',
                },
                {
                  icon: LayoutDashboard,
                  title: 'Auto Dashboard',
                  desc: 'Beautiful charts generated automatically from your data',
                },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                  <Icon className="w-6 h-6 text-indigo-400 mb-3" />
                  <h3 className="text-sm font-semibold text-slate-200 mb-1">{title}</h3>
                  <p className="text-xs text-slate-500">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent uploads */}
        {uploadedFiles.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
                <Clock className="w-5 h-5 text-slate-400" />
                Recent Uploads
              </h3>
              <span className="text-sm text-slate-500">Last {RECENT_FILES_DISPLAY_COUNT} files</span>
            </div>
            <div className="space-y-2">
              {uploadedFiles.slice(0, RECENT_FILES_DISPLAY_COUNT).map((file) => (
                <div
                  key={file.file_id}
                  className="flex items-center justify-between p-4 bg-slate-900 border border-slate-800 rounded-lg hover:border-indigo-600 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="w-5 h-5 text-slate-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-200 truncate">
                        {file.filename}
                      </p>
                      <p className="text-xs text-slate-500">
                        {(file.size_bytes / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-600 shrink-0" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
