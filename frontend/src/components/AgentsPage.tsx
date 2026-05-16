'use client';

import React, { useState, useEffect } from 'react';
import { Brain, RefreshCw, Download, Sparkles } from 'lucide-react';

interface AgentsPageProps {
  fileId?: string;
}

export default function AgentsPage({ fileId }: AgentsPageProps) {
  const [activeAgent, setActiveAgent] = useState<string>('cleaner');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any | null>(null);

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Brain className="text-blue-600" size={32} />
            AI Agents
          </h1>
          <p className="text-gray-600 mt-2">
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
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-blue-300'
              }`}
            >
              <div className="text-3xl mb-2">{agent.icon}</div>
              <h3 className="font-semibold text-gray-900">{agent.name}</h3>
              <p className="text-xs text-gray-600 mt-1">{agent.description}</p>
            </button>
          ))}
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">
              {agents.find((a) => a.id === activeAgent)?.name}
            </h2>
            <button
              onClick={runAgent}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
            >
              <Sparkles size={16} />
              {loading ? 'Processing...' : 'Run Agent'}
            </button>
          </div>

          {results && (
            <div className="bg-gray-50 rounded p-4 max-h-96 overflow-y-auto">
              <pre className="text-xs font-mono whitespace-pre-wrap break-words">
                {JSON.stringify(results, null, 2)}
              </pre>
            </div>
          )}

          {!results && !loading && (
            <p className="text-gray-500 text-center py-8">
              Click "Run Agent" to analyze your data
            </p>
          )}

          {loading && (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="animate-spin text-blue-600" size={24} />
              <span className="ml-2 text-gray-600">Processing...</span>
            </div>
          )}
        </div>

        {results && (
          <button className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
            <Download size={16} />
            Download Results
          </button>
        )}
      </div>
    </div>
  );
}
