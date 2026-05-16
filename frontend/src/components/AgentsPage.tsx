'use client';

import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Brain,
  Copy,
  Download,
  RefreshCw,
  Sparkles,
  Type,
  Waves,
} from 'lucide-react';
import type { CleanerAnalysisResponse, CleanerSuggestion } from '@/types';

interface AgentsPageProps {
  fileId?: string;
}

export default function AgentsPage({ fileId }: AgentsPageProps) {
  const [activeAgent, setActiveAgent] = useState<string>('cleaner');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<unknown | null>(null);
  const [applyingSuggestionId, setApplyingSuggestionId] = useState<string | null>(null);
  const [suggestionStatus, setSuggestionStatus] = useState<Record<string, 'applied' | 'skipped'>>({});

  const agents = [
    {
      id: 'cleaner',
      name: 'Data Cleaner',
      icon: '🧹',
      description: 'Analyze and fix data quality issues',
    },
    {
      id: 'analyst',
      name: 'Analyst',
      icon: '📊',
      description: 'Generate insights from your data',
    },
    {
      id: 'reporter',
      name: 'Reporter',
      icon: '📄',
      description: 'Create professional reports',
    },
    {
      id: 'predictor',
      name: 'Predictor',
      icon: '🤖',
      description: 'Build predictive models',
    },
  ];

  const runAgent = async () => {
    if (!fileId) {
      alert('Please upload a file first');
      return;
    }

    setLoading(true);
    setSuggestionStatus({});
    try {
      const api = await import('@/lib/api');

      let result;
      switch (activeAgent) {
        case 'cleaner':
          result = await api.analyzeCleanerSuggestions(fileId);
          break;
        case 'analyst':
          result = await api.generateAnalystInsights(fileId);
          break;
        case 'reporter':
          result = await api.generateReport(
            fileId,
            'Analysis Report',
            ['summary', 'analysis', 'insights']
          );
          break;
        case 'predictor':
          alert('Predictor requires additional configuration');
          return;
        default:
          return;
      }

      setResults(result);
    } catch (error) {
      console.error('Agent execution failed:', error);
      alert('Agent execution failed');
    } finally {
      setLoading(false);
    }
  };

  const isCleanerResult = (value: unknown): value is CleanerAnalysisResponse => {
    if (!value || typeof value !== 'object') return false;
    return Array.isArray((value as CleanerAnalysisResponse).suggestions);
  };

  const severityClasses: Record<CleanerSuggestion['severity'], string> = {
    high: 'bg-red-500/20 text-red-300 border border-red-500/40',
    medium: 'bg-amber-500/20 text-amber-300 border border-amber-500/40',
    low: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40',
  };

  const issueLabels: Record<CleanerSuggestion['issue_type'], string> = {
    missing_values: 'Missing Values',
    duplicates: 'Duplicates',
    outliers: 'Outliers',
    inconsistent_format: 'Inconsistent Format',
  };

  const issueIcons: Record<CleanerSuggestion['issue_type'], React.ElementType> = {
    missing_values: Waves,
    duplicates: Copy,
    outliers: AlertTriangle,
    inconsistent_format: Type,
  };

  const handleApplyFix = async (suggestionId: string) => {
    if (!fileId) return;
    setApplyingSuggestionId(suggestionId);
    try {
      const api = await import('@/lib/api');
      await api.applyCleanerSuggestions(fileId, [suggestionId], true);
      setSuggestionStatus((prev) => ({ ...prev, [suggestionId]: 'applied' }));
    } catch (error) {
      console.error('Failed to apply cleaner suggestion:', error);
      alert('Failed to apply suggestion');
    } finally {
      setApplyingSuggestionId(null);
    }
  };

  const cleanerResults = isCleanerResult(results) ? results : null;

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-100 flex items-center gap-3">
            <Brain className="text-blue-600" size={32} />
            AI Agents
          </h1>
          <p className="text-slate-300 mt-2">
            Harness the power of specialized AI agents to analyze, clean, and derive insights from your data
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {agents.map((agent) => (
            <button
              key={agent.id}
              onClick={() => setActiveAgent(agent.id)}
              className={`p-4 rounded-lg border-2 transition-all text-left ${
                activeAgent === agent.id
                  ? 'border-indigo-500 bg-indigo-950/30'
                  : 'border-slate-700 bg-slate-900 text-slate-200 hover:border-indigo-400'
              }`}
            >
              <div className="text-3xl mb-2">{agent.icon}</div>
              <h3 className="font-semibold text-slate-100">{agent.name}</h3>
              <p className="text-xs text-slate-300 mt-1">{agent.description}</p>
            </button>
          ))}
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-slate-100">
              {agents.find((a) => a.id === activeAgent)?.name}
            </h2>
            <button
              onClick={runAgent}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 border border-blue-500/50 text-slate-100 rounded hover:bg-blue-500 disabled:bg-slate-700 disabled:border-slate-600 disabled:text-slate-400"
            >
              <Sparkles size={16} />
              {loading ? 'Processing...' : 'Run Agent'}
            </button>
          </div>

          {results && (
            <div className="bg-slate-900 border border-slate-800 rounded p-4 max-h-96 overflow-y-auto">
              {activeAgent === 'cleaner' && cleanerResults ? (
                <div className="space-y-4">
                  <p className="text-sm text-slate-300">
                    Health Score: <span className="text-slate-100 font-semibold">{cleanerResults.overall_health_score}</span>
                  </p>
                  {cleanerResults.suggestions.length === 0 ? (
                    <p className="text-slate-300">No cleaning suggestions found.</p>
                  ) : (
                    cleanerResults.suggestions.map((suggestion) => {
                      const IssueIcon = issueIcons[suggestion.issue_type] ?? AlertTriangle;
                      const status = suggestionStatus[suggestion.id];
                      const isApplied = status === 'applied';
                      const isSkipped = status === 'skipped';

                      return (
                        <div
                          key={suggestion.id}
                          className="rounded-lg bg-slate-900 border border-slate-700 p-4 text-slate-200"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <IssueIcon className="text-indigo-300" size={18} />
                              <h3 className="font-semibold text-slate-100">
                                {issueLabels[suggestion.issue_type]} • {suggestion.column}
                              </h3>
                            </div>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${severityClasses[suggestion.severity]}`}>
                              {suggestion.severity}
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-slate-300">{suggestion.description}</p>
                          <code className="mt-3 block rounded bg-slate-800 text-slate-200 px-3 py-2 text-xs">
                            Suggested fix: {suggestion.suggested_action}
                          </code>
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <button
                              onClick={() => handleApplyFix(suggestion.id)}
                              disabled={isApplied || isSkipped || applyingSuggestionId === suggestion.id}
                              className="px-3 py-1.5 text-xs font-medium rounded bg-blue-600 border border-blue-500/50 text-slate-100 hover:bg-blue-500 disabled:bg-slate-700 disabled:border-slate-600 disabled:text-slate-400"
                            >
                              {isApplied ? 'Applied' : applyingSuggestionId === suggestion.id ? 'Applying...' : 'Apply Fix'}
                            </button>
                            <button
                              onClick={() =>
                                setSuggestionStatus((prev) => ({ ...prev, [suggestion.id]: 'skipped' }))
                              }
                              disabled={isApplied || isSkipped}
                              className="px-3 py-1.5 text-xs font-medium rounded bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700 disabled:bg-slate-800/70 disabled:text-slate-500"
                            >
                              {isSkipped ? 'Skipped' : 'Skip'}
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              ) : (
                <pre className="bg-slate-800 text-slate-200 rounded p-3 text-xs font-mono whitespace-pre-wrap break-words">
                  {JSON.stringify(results, null, 2)}
                </pre>
              )}
            </div>
          )}

          {!results && !loading && (
            <p className="text-slate-300 text-center py-8">
              Click &quot;Run Agent&quot; to analyze your data
            </p>
          )}

          {loading && (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="animate-spin text-blue-600" size={24} />
              <span className="ml-2 text-slate-300">Processing...</span>
            </div>
          )}
        </div>

        {results && (
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 border border-blue-500/50 text-slate-100 rounded hover:bg-blue-500">
            <Download size={16} />
            Download Results
          </button>
        )}
      </div>
    </div>
  );
}
