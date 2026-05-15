'use client';

import { useState } from 'react';
import FileUploader from '@/components/FileUploader';
import DataProfile from '@/components/DataProfile';
import ChatInterface from '@/components/ChatInterface';
import AutoDashboard from '@/components/AutoDashboard';
import type { UploadResponse } from '@/types';
import { Brain, Upload, BarChart3, MessageSquare, LayoutDashboard, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';

type TabId = 'upload' | 'profile' | 'chat' | 'dashboard';

const TABS: { id: TabId; label: string; icon: React.ElementType; requiresFile: boolean }[] = [
  { id: 'upload', label: 'Upload', icon: Upload, requiresFile: false },
  { id: 'profile', label: 'Profile', icon: BarChart3, requiresFile: true },
  { id: 'chat', label: 'AI Chat', icon: MessageSquare, requiresFile: true },
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, requiresFile: true },
];

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<TabId>('upload');
  const [uploadResponse, setUploadResponse] = useState<UploadResponse | null>(null);

  const handleUpload = (response: UploadResponse) => {
    setUploadResponse(response);
    setTimeout(() => setActiveTab('profile'), 800);
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
                <span className="ml-2 text-xs text-indigo-400 bg-indigo-950/50 border border-indigo-800/50 px-2 py-0.5 rounded-full">
                  MVP
                </span>
              </div>
            </div>

            {uploadResponse && (
              <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-slate-300 font-medium truncate max-w-48">
                  {uploadResponse.filename}
                </span>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero */}
        {!uploadResponse && (
          <div className="text-center mb-12">
            <h1 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-4">
              AI-Powered Data Intelligence
            </h1>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              Upload your dataset and instantly get deep insights, AI-powered analysis, and
              beautiful auto-generated dashboards.
            </p>
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-8 bg-slate-900 border border-slate-800 rounded-2xl p-1.5 w-fit">
          {TABS.map((tab, i) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const isDisabled = tab.requiresFile && !uploadResponse;

            return (
              <div key={tab.id} className="flex items-center">
                {i > 0 && (
                  <ChevronRight className="w-3.5 h-3.5 text-slate-700 mx-0.5" />
                )}
                <button
                  onClick={() => !isDisabled && setActiveTab(tab.id)}
                  disabled={isDisabled}
                  className={clsx(
                    'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all',
                    isActive
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50'
                      : isDisabled
                      ? 'text-slate-600 cursor-not-allowed'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              </div>
            );
          })}
        </div>

        {/* Tab content */}
        <div className="animate-fade-in">
          {activeTab === 'upload' && (
            <div className="max-w-2xl mx-auto">
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-slate-200">Upload Dataset</h2>
                <p className="text-sm text-slate-500 mt-1">
                  Supports CSV, XLSX, and XLS files up to 50MB
                </p>
              </div>
              <FileUploader onUpload={handleUpload} />

              {!uploadResponse && (
                <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4">
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
              )}
            </div>
          )}

          {activeTab === 'profile' && uploadResponse && (
            <div>
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-slate-200">Data Profile</h2>
                <p className="text-sm text-slate-500 mt-1">
                  Comprehensive analysis of{' '}
                  <span className="text-slate-300 font-medium">{uploadResponse.filename}</span>
                </p>
              </div>
              <DataProfile fileId={uploadResponse.file_id} />
            </div>
          )}

          {activeTab === 'chat' && uploadResponse && (
            <div>
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-slate-200">AI Chat</h2>
                <p className="text-sm text-slate-500 mt-1">
                  Ask questions about{' '}
                  <span className="text-slate-300 font-medium">{uploadResponse.filename}</span>
                </p>
              </div>
              <div className="max-w-3xl mx-auto">
                <ChatInterface
                  fileId={uploadResponse.file_id}
                  filename={uploadResponse.filename}
                />
              </div>
            </div>
          )}

          {activeTab === 'dashboard' && uploadResponse && (
            <div>
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-slate-200">Auto Dashboard</h2>
                <p className="text-sm text-slate-500 mt-1">
                  Auto-generated visualizations for{' '}
                  <span className="text-slate-300 font-medium">{uploadResponse.filename}</span>
                </p>
              </div>
              <AutoDashboard fileId={uploadResponse.file_id} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
