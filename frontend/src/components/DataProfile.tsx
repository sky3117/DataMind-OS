'use client';

import { useEffect, useState } from 'react';
import { getProfile } from '@/lib/api';
import type { ProfileResponse, ColumnInfo } from '@/types';
import {
  Activity,
  Database,
  AlertTriangle,
  Copy,
  BarChart2,
  Hash,
  Type,
  Loader2,
  XCircle,
} from 'lucide-react';
import { clsx } from 'clsx';

interface DataProfileProps {
  fileId: string;
}

function HealthBadge({ score }: { score: number }) {
  const color =
    score >= 80 ? 'text-emerald-400 bg-emerald-950/50 border-emerald-800' :
    score >= 60 ? 'text-yellow-400 bg-yellow-950/50 border-yellow-800' :
    'text-red-400 bg-red-950/50 border-red-800';

  return (
    <span className={clsx('px-3 py-1 rounded-full text-sm font-semibold border', color)}>
      {score}%
    </span>
  );
}

function ProgressBar({ value, max, color = 'indigo' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  const barColor = {
    indigo: 'bg-indigo-500',
    red: 'bg-red-500',
    emerald: 'bg-emerald-500',
    yellow: 'bg-yellow-500',
  }[color] ?? 'bg-indigo-500';

  return (
    <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
      <div
        className={clsx('h-full rounded-full transition-all duration-500', barColor)}
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
  );
}

function ColumnCard({ col, rowCount }: { col: ColumnInfo; rowCount: number }) {
  const isNumeric = !!col.stats;
  const nullColor = col.null_pct > 20 ? 'red' : col.null_pct > 5 ? 'yellow' : 'emerald';

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col gap-3 hover:border-slate-700 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {isNumeric ? (
            <Hash className="w-4 h-4 text-indigo-400 shrink-0" />
          ) : (
            <Type className="w-4 h-4 text-purple-400 shrink-0" />
          )}
          <span className="text-sm font-semibold text-slate-200 truncate">{col.name}</span>
        </div>
        <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded font-mono shrink-0">
          {col.dtype}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-slate-800/60 rounded-lg p-2">
          <p className="text-slate-500">Unique</p>
          <p className="text-slate-200 font-semibold">{col.unique_count.toLocaleString()}</p>
        </div>
        <div className="bg-slate-800/60 rounded-lg p-2">
          <p className="text-slate-500">Nulls</p>
          <p className={clsx('font-semibold', {
            'text-red-400': col.null_pct > 20,
            'text-yellow-400': col.null_pct > 5 && col.null_pct <= 20,
            'text-emerald-400': col.null_pct <= 5,
          })}>
            {col.null_count} ({col.null_pct}%)
          </p>
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-xs text-slate-500">
          <span>Null rate</span>
          <span>{col.null_pct}%</span>
        </div>
        <ProgressBar value={col.null_count} max={rowCount} color={nullColor} />
      </div>

      {isNumeric && col.stats && (
        <div className="grid grid-cols-3 gap-1 text-xs">
          {[
            ['Min', col.stats.min],
            ['Mean', col.stats.mean],
            ['Max', col.stats.max],
          ].map(([label, val]) => (
            <div key={String(label)} className="bg-slate-800/60 rounded p-1.5 text-center">
              <p className="text-slate-500">{label}</p>
              <p className="text-slate-300 font-mono">
                {val != null ? Number(val).toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}
              </p>
            </div>
          ))}
        </div>
      )}

      {col.outlier_count !== undefined && col.outlier_count > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-amber-400">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>{col.outlier_count} outlier{col.outlier_count !== 1 ? 's' : ''} detected</span>
        </div>
      )}

      {col.top_values && col.top_values.length > 0 && (
        <div className="space-y-1">
          {col.top_values.slice(0, 3).map((tv) => (
            <div key={tv.value} className="flex items-center gap-2 text-xs">
              <span className="text-slate-400 truncate flex-1">{tv.value}</span>
              <span className="text-slate-500 shrink-0">{tv.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DataProfile({ fileId }: DataProfileProps) {
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getProfile(fileId)
      .then(setProfile)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load profile'))
      .finally(() => setLoading(false));
  }, [fileId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 gap-3 text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
        <span>Analyzing dataset…</span>
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

  if (!profile) return null;

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Rows', value: profile.row_count.toLocaleString(), icon: Database, color: 'text-indigo-400' },
          { label: 'Columns', value: profile.col_count.toLocaleString(), icon: BarChart2, color: 'text-purple-400' },
          { label: 'Duplicates', value: profile.duplicate_rows.toLocaleString(), icon: Copy, color: 'text-amber-400' },
          { label: 'Health', value: <HealthBadge score={profile.health_score} />, icon: Activity, color: 'text-emerald-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Icon className={clsx('w-4 h-4', color)} />
              <span className="text-xs text-slate-500 uppercase tracking-wide">{label}</span>
            </div>
            <div className="text-xl font-bold text-slate-100">{value}</div>
          </div>
        ))}
      </div>

      {/* Column cards */}
      <div>
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
          Column Analysis
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {profile.columns.map((col) => (
            <ColumnCard key={col.name} col={col} rowCount={profile.row_count} />
          ))}
        </div>
      </div>

      {/* Sample data */}
      {profile.sample_data.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
            Sample Data
          </h3>
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-900 border-b border-slate-800">
                  {Object.keys(profile.sample_data[0]).map((k) => (
                    <th key={k} className="px-4 py-3 text-left text-slate-400 font-medium whitespace-nowrap">
                      {k}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {profile.sample_data.map((row, i) => (
                  <tr key={i} className={clsx('border-b border-slate-800/50', i % 2 === 0 ? 'bg-slate-950' : 'bg-slate-900/50')}>
                    {Object.values(row).map((val, j) => (
                      <td key={j} className="px-4 py-2 text-slate-300 whitespace-nowrap">
                        {val === null || val === undefined ? (
                          <span className="text-slate-600 italic">null</span>
                        ) : (
                          String(val)
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
