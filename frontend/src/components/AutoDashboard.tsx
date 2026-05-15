'use client';

import { useEffect, useState } from 'react';
import { getDashboard } from '@/lib/api';
import type { DashboardResponse, Chart as ChartType, ChartDataPoint } from '@/types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import { Loader2, XCircle, BarChart2 } from 'lucide-react';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#14b8a6'];

interface DashboardProps {
  fileId: string;
}

function ChartCard({ chart }: { chart: ChartType }) {
  const data = chart.data as ChartDataPoint[];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
      <h3 className="text-sm font-semibold text-slate-300 mb-4">{chart.title}</h3>

      {chart.type === 'bar' && (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis
              dataKey={chart.x_key ?? 'label'}
              tick={{ fill: '#64748b', fontSize: 10 }}
              angle={-30}
              textAnchor="end"
            />
            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }}
              labelStyle={{ color: '#94a3b8' }}
              itemStyle={{ color: '#6366f1' }}
            />
            <Bar dataKey={chart.y_key ?? 'value'} fill="#6366f1" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}

      {chart.type === 'pie' && (
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              outerRadius={80}
              dataKey="value"
              nameKey="name"
              label={({ name, percent }) =>
                `${String(name).slice(0, 10)}… ${(percent * 100).toFixed(0)}%`
              }
              labelLine={false}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }}
              itemStyle={{ color: '#94a3b8' }}
            />
            <Legend wrapperStyle={{ fontSize: 11, color: '#64748b' }} />
          </PieChart>
        </ResponsiveContainer>
      )}

      {chart.type === 'line' && (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey={chart.x_key ?? 'index'} tick={{ fill: '#64748b', fontSize: 10 }} />
            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }}
              labelStyle={{ color: '#94a3b8' }}
              itemStyle={{ color: '#6366f1' }}
            />
            <Line
              type="monotone"
              dataKey={chart.y_key ?? 'value'}
              stroke="#6366f1"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export default function AutoDashboard({ fileId }: DashboardProps) {
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getDashboard(fileId)
      .then(setDashboard)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, [fileId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 gap-3 text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
        <span>Generating dashboard…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 p-6 rounded-xl bg-red-950/20 border border-red-800/50 text-red-400">
        <XCircle className="w-5 h-5 shrink-0" />
        <p>{error}</p>
      </div>
    );
  }

  if (!dashboard) return null;

  const summaryEntries = Object.entries(dashboard.summary);

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Stats */}
      {summaryEntries.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {summaryEntries.map(([col, stats]) => (
            <div key={col} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <BarChart2 className="w-4 h-4 text-indigo-400" />
                <p className="text-xs text-slate-500 font-medium truncate">{col}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  ['Min', stats.min],
                  ['Max', stats.max],
                  ['Mean', stats.mean],
                  ['Std', stats.std],
                ].map(([label, val]) => (
                  <div key={String(label)} className="bg-slate-800/60 rounded p-1.5">
                    <p className="text-slate-500">{label}</p>
                    <p className="text-slate-300 font-mono">
                      {val != null
                        ? Number(val).toLocaleString(undefined, { maximumFractionDigits: 2 })
                        : '—'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Charts */}
      {dashboard.charts.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {dashboard.charts.map((chart) => (
            <ChartCard key={chart.id} chart={chart} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-slate-500">
          <BarChart2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No charts available for this dataset</p>
          <p className="text-xs mt-1">Try uploading a dataset with numeric or categorical columns</p>
        </div>
      )}
    </div>
  );
}
