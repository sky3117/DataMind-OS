'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  BarChart2,
  Brain,
  CheckCircle,
  ChevronDown,
  Copy,
  Download,
  ExternalLink,
  FileText,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Type,
  Waves,
  Zap,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type {
  AnalystInsightsResponse,
  CleanerAnalysisResponse,
  CleanerSuggestion,
  Insight,
  PredictorTrainResponse,
  PredictorPredictResponse,
  ReporterGenerateResponse,
} from '@/types';
import { useGlobalContext } from '@/context/GlobalContext';
import { API_BASE_URL } from '@/lib/config';

interface AgentsPageProps {
  fileId?: string;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const Spinner = ({ size = 20 }: { size?: number }) => (
  <RefreshCw className="animate-spin text-indigo-400" size={size} />
);

const Badge = ({
  value,
  label,
  color = 'indigo',
}: {
  value: string | number;
  label: string;
  color?: 'indigo' | 'emerald' | 'amber' | 'red';
}) => {
  const colorMap: Record<string, string> = {
    indigo: 'bg-indigo-900/60 text-indigo-300 border-indigo-700',
    emerald: 'bg-emerald-900/60 text-emerald-300 border-emerald-700',
    amber: 'bg-amber-900/60 text-amber-300 border-amber-700',
    red: 'bg-red-900/60 text-red-300 border-red-700',
  };
  return (
    <div className={`rounded-lg border px-4 py-3 text-center ${colorMap[color]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs opacity-75 mt-0.5">{label}</div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Data Cleaner UI
// ---------------------------------------------------------------------------

const severityClasses: Record<CleanerSuggestion['severity'], string> = {
  high: 'bg-red-500/20 text-red-300 border border-red-500/40',
  medium: 'bg-amber-500/20 text-amber-300 border border-amber-500/40',
  low: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40',
};

const issueIcons: Record<CleanerSuggestion['issue_type'], React.ElementType> = {
  missing_values: Waves,
  duplicates: Copy,
  outliers: AlertTriangle,
  inconsistent_format: Type,
};

const issueLabels: Record<CleanerSuggestion['issue_type'], string> = {
  missing_values: 'Missing Values',
  duplicates: 'Duplicates',
  outliers: 'Outliers',
  inconsistent_format: 'Inconsistent Format',
};

const fixMethodsByType: Record<CleanerSuggestion['issue_type'], string[]> = {
  missing_values: ['mean', 'median', 'mode', 'ffill', 'drop'],
  duplicates: ['remove'],
  outliers: ['drop', 'cap', 'keep'],
  inconsistent_format: ['strip'],
};

function CleanerPanel({
  fileId,
  result,
  onRefresh,
}: {
  fileId: string;
  result: CleanerAnalysisResponse;
  onRefresh: () => void;
}) {
  const { addNotification } = useGlobalContext();
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
  const [skippedIds, setSkippedIds] = useState<Set<string>>(new Set());
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [selectedActions, setSelectedActions] = useState<Record<string, string>>({});
  const [openDropdowns, setOpenDropdowns] = useState<Set<string>>(new Set());
  const [cleanedFileId, setCleanedFileId] = useState<string | null>(null);

  const suggestions = result.suggestions;
  const appliedCount = appliedIds.size;
  const totalCount = suggestions.length;
  const colsAffected = new Set(suggestions.map((s) => s.column)).size;
  const progressPct = totalCount > 0 ? Math.round((appliedCount / totalCount) * 100) : 0;

  const defaultAction = (s: CleanerSuggestion) =>
    fixMethodsByType[s.issue_type]?.[0] ?? 'drop';

  const getAction = (s: CleanerSuggestion) =>
    selectedActions[s.id] ?? defaultAction(s);

  const handleApply = async (s: CleanerSuggestion) => {
    const action = getAction(s);
    setApplyingId(s.id);
    try {
      const api = await import('@/lib/api');
      const res = await api.applyCleanerSuggestions(fileId, s.id, action);
      setAppliedIds((prev) => new Set([...prev, s.id]));
      setCleanedFileId(res.cleaned_file_id);
      addNotification(
        `Fixed: ${issueLabels[s.issue_type]} in '${s.column}' (${res.before_rows}→${res.after_rows} rows)`,
        'success'
      );
    } catch (err) {
      addNotification(
        `Failed to apply fix: ${err instanceof Error ? err.message : 'Unknown error'}`,
        'error'
      );
    } finally {
      setApplyingId(null);
    }
  };

  const toggleDropdown = (id: string) =>
    setOpenDropdowns((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const downloadCleaned = () => {
    const fid = cleanedFileId ?? fileId;
    window.open(`${API_BASE_URL}/api/download/${fid}`, '_blank');
  };

  // Group by issue type
  const groups: Record<string, CleanerSuggestion[]> = {};
  for (const s of suggestions) {
    const key = issueLabels[s.issue_type];
    groups[key] = groups[key] ?? [];
    groups[key].push(s);
  }

  return (
    <div className="space-y-6">
      {/* Summary bar */}
      <div className="flex flex-wrap gap-3 items-center bg-slate-800/50 border border-slate-700 rounded-lg p-4">
        <div className="text-sm text-slate-300">
          <span className="text-slate-100 font-semibold">{totalCount}</span> total issues
        </div>
        <div className="h-4 w-px bg-slate-600" />
        <div className="text-sm text-slate-300">
          <span className="text-slate-100 font-semibold">{colsAffected}</span> columns affected
        </div>
        <div className="h-4 w-px bg-slate-600" />
        <div className="text-sm text-slate-300">
          Health:{' '}
          <span
            className={`font-semibold ${
              result.overall_health_score > 70
                ? 'text-emerald-400'
                : result.overall_health_score > 40
                ? 'text-amber-400'
                : 'text-red-400'
            }`}
          >
            {result.overall_health_score}%
          </span>
        </div>
        <button
          onClick={onRefresh}
          className="ml-auto text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1"
        >
          <RefreshCw size={12} /> Re-analyze
        </button>
      </div>

      {/* Progress bar */}
      {totalCount > 0 && (
        <div>
          <div className="flex justify-between text-xs text-slate-400 mb-1">
            <span>
              {appliedCount} of {totalCount} fixes applied
            </span>
            <span>{progressPct}%</span>
          </div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {suggestions.length === 0 && (
        <div className="text-center py-8 text-emerald-400 flex flex-col items-center gap-2">
          <CheckCircle size={32} />
          <span className="font-semibold">No issues detected — your data looks clean!</span>
        </div>
      )}

      {/* Issue groups */}
      {Object.entries(groups).map(([groupName, items]) => (
        <div key={groupName}>
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-2">
            {groupName} ({items.length})
          </h3>
          <div className="space-y-3">
            {items.map((s) => {
              const IssueIcon = issueIcons[s.issue_type];
              const isApplied = appliedIds.has(s.id);
              const isSkipped = skippedIds.has(s.id);
              const isProcessed = isApplied || isSkipped;
              const isApplying = applyingId === s.id;
              const methods = fixMethodsByType[s.issue_type] ?? ['drop'];
              const currentAction = getAction(s);
              const isOpen = openDropdowns.has(s.id);

              return (
                <div
                  key={s.id}
                  className={`rounded-lg border p-4 transition-all ${
                    isApplied
                      ? 'border-emerald-700/50 bg-emerald-950/20 opacity-70'
                      : isSkipped
                      ? 'border-slate-700/50 bg-slate-900/30 opacity-50'
                      : 'border-slate-700 bg-slate-900'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {isApplied ? (
                        <CheckCircle className="text-emerald-400" size={18} />
                      ) : (
                        <IssueIcon className="text-indigo-300" size={18} />
                      )}
                      <h4 className="font-semibold text-slate-100">
                        {s.column}
                      </h4>
                      {isApplied && (
                        <span className="text-xs bg-emerald-900/60 text-emerald-300 border border-emerald-700 px-2 py-0.5 rounded-full">
                          Fixed!
                        </span>
                      )}
                      {isSkipped && (
                        <span className="text-xs bg-slate-800 text-slate-500 border border-slate-700 px-2 py-0.5 rounded-full">
                          Skipped
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">
                        {s.affected_rows} rows
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${severityClasses[s.severity]}`}
                      >
                        {s.severity}
                      </span>
                    </div>
                  </div>

                  <p className="mt-2 text-sm text-slate-300">{s.description}</p>

                  {!isProcessed && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {/* Fix method dropdown */}
                      <div className="relative">
                        <button
                          onClick={() => toggleDropdown(s.id)}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs bg-slate-800 border border-slate-600 text-slate-200 rounded hover:bg-slate-700"
                        >
                          <span className="capitalize">{currentAction}</span>
                          <ChevronDown size={12} />
                        </button>
                        {isOpen && (
                          <div className="absolute z-10 top-full mt-1 left-0 bg-slate-800 border border-slate-600 rounded shadow-lg min-w-max">
                            {methods.map((m) => (
                              <button
                                key={m}
                                onClick={() => {
                                  setSelectedActions((prev) => ({ ...prev, [s.id]: m }));
                                  toggleDropdown(s.id);
                                }}
                                className={`block w-full text-left px-3 py-1.5 text-xs capitalize hover:bg-slate-700 ${
                                  m === currentAction ? 'text-indigo-300' : 'text-slate-200'
                                }`}
                              >
                                {m}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => handleApply(s)}
                        disabled={isApplying}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-indigo-600 border border-indigo-500/50 text-white rounded hover:bg-indigo-500 disabled:opacity-50"
                      >
                        {isApplying ? <Spinner size={12} /> : <Sparkles size={12} />}
                        {isApplying ? 'Applying…' : 'Apply Fix'}
                      </button>

                      <button
                        onClick={() =>
                          setSkippedIds((prev) => new Set([...prev, s.id]))
                        }
                        className="px-3 py-1.5 text-xs bg-slate-800 border border-slate-700 text-slate-400 rounded hover:bg-slate-700"
                      >
                        Skip
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {appliedCount > 0 && (
        <button
          onClick={downloadCleaned}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-700 border border-emerald-600 text-white text-sm rounded hover:bg-emerald-600"
        >
          <Download size={14} />
          Download Cleaned Data
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Analyst UI
// ---------------------------------------------------------------------------

const insightTypeIcons: Record<string, React.ElementType> = {
  correlation: BarChart2,
  trend: TrendingUp,
  anomaly: AlertTriangle,
  distribution: Waves,
  recommendation: Zap,
};

const insightTypeColors: Record<string, string> = {
  correlation: 'text-blue-400',
  trend: 'text-purple-400',
  anomaly: 'text-red-400',
  distribution: 'text-cyan-400',
  recommendation: 'text-yellow-400',
};

const confidenceBadgeColor = (c: number) => {
  if (c >= 0.8) return 'bg-emerald-900/60 text-emerald-300 border-emerald-700';
  if (c >= 0.6) return 'bg-amber-900/60 text-amber-300 border-amber-700';
  return 'bg-red-900/60 text-red-300 border-red-700';
};

function InsightMiniChart({ insight }: { insight: Insight }) {
  const cd = insight.chart_data;
  if (!cd || !Array.isArray(cd.data) || cd.data.length === 0) return null;

  if (cd.type === 'bar') {
    const data = cd.data as Array<{ name?: string; value?: number }>;
    return (
      <div className="mt-3 h-28">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 2, right: 4, bottom: 2, left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 9 }} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 9 }} />
            <Tooltip
              contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 4 }}
              labelStyle={{ color: '#e2e8f0', fontSize: 11 }}
              itemStyle={{ color: '#a5b4fc', fontSize: 11 }}
            />
            <Bar dataKey="value" fill="#6366f1" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (cd.type === 'line') {
    const data = cd.data as Array<{ index?: number; value?: number }>;
    const sample = data.filter((_, i) => i % Math.max(1, Math.floor(data.length / 40)) === 0);
    return (
      <div className="mt-3 h-28">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={sample} margin={{ top: 2, right: 4, bottom: 2, left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="index" tick={{ fill: '#94a3b8', fontSize: 9 }} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 9 }} />
            <Tooltip
              contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 4 }}
              labelStyle={{ color: '#e2e8f0', fontSize: 11 }}
              itemStyle={{ color: '#818cf8', fontSize: 11 }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#818cf8"
              dot={false}
              strokeWidth={1.5}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return null;
}

function AnalystPanel({ result }: { result: AnalystInsightsResponse }) {
  const groups: Record<string, Insight[]> = {};
  for (const ins of result.insights) {
    const key = ins.insight_type.charAt(0).toUpperCase() + ins.insight_type.slice(1) + 's';
    groups[key] = groups[key] ?? [];
    groups[key].push(ins);
  }

  return (
    <div className="space-y-6">
      {result.key_findings.length > 0 && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-slate-300 mb-2">Key Findings</h3>
          <ul className="space-y-1">
            {result.key_findings.map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                <span className="text-indigo-400 mt-0.5">•</span>
                {f}
              </li>
            ))}
          </ul>
        </div>
      )}

      {Object.entries(groups).map(([groupName, insights]) => (
        <div key={groupName}>
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">
            {groupName} ({insights.length})
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {insights.map((ins) => {
              const Icon = insightTypeIcons[ins.insight_type] ?? Sparkles;
              const iconColor = insightTypeColors[ins.insight_type] ?? 'text-indigo-400';
              const confPct = Math.round(ins.confidence * 100);
              return (
                <div
                  key={ins.id}
                  className="bg-slate-900 border border-slate-700 rounded-lg p-4"
                >
                  <div className="flex items-start gap-2 justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className={iconColor} size={16} />
                      <h4 className="font-semibold text-slate-100 text-sm">{ins.title}</h4>
                    </div>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full border whitespace-nowrap ${confidenceBadgeColor(ins.confidence)}`}
                    >
                      {confPct}%
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-400 leading-relaxed">{ins.description}</p>
                  <InsightMiniChart insight={ins} />
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {result.insights.length === 0 && (
        <p className="text-slate-400 text-center py-6">
          No insights could be generated for this dataset.
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reporter UI
// ---------------------------------------------------------------------------

function ReporterPanel({ result }: { result: ReporterGenerateResponse }) {
  const reportUrl = `${API_BASE_URL}${result.html_url}`;

  return (
    <div className="space-y-4">
      {/* Preview card */}
      <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="w-10 h-10 rounded-lg bg-indigo-900 flex items-center justify-center flex-shrink-0">
          <FileText className="text-indigo-300" size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-100 truncate">{result.title}</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Generated {new Date(result.generated_at).toLocaleString()}
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <a
            href={reportUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 border border-indigo-500/50 text-white text-xs rounded hover:bg-indigo-500"
          >
            <ExternalLink size={12} />
            View Report
          </a>
          <a
            href={reportUrl}
            download={`${result.report_id}.html`}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 border border-slate-600 text-slate-200 text-xs rounded hover:bg-slate-600"
          >
            <Download size={12} />
            Download HTML
          </a>
        </div>
      </div>

      {/* iframe preview */}
      <div className="rounded-lg border border-slate-700 overflow-hidden">
        <div className="bg-slate-800 px-3 py-1.5 text-xs text-slate-400 border-b border-slate-700">
          Report Preview
        </div>
        <iframe
          src={reportUrl}
          className="w-full h-[480px] bg-white"
          title="Report Preview"
          sandbox="allow-same-origin"
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Predictor UI
// ---------------------------------------------------------------------------

type PredictorStep = 'configure' | 'trained' | 'predicted';

function PredictorPanel({ fileId }: { fileId: string }) {
  const { addNotification } = useGlobalContext();
  const [step, setStep] = useState<PredictorStep>('configure');
  const [columns, setColumns] = useState<string[]>([]);
  const [loadingCols, setLoadingCols] = useState(false);
  const [targetColumn, setTargetColumn] = useState('');
  const [modelType, setModelType] = useState<'linear_regression' | 'random_forest'>('random_forest');
  const [training, setTraining] = useState(false);
  const [trainResult, setTrainResult] = useState<PredictorTrainResponse | null>(null);
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [predicting, setPredicting] = useState(false);
  const [predictResult, setPredictResult] = useState<PredictorPredictResponse | null>(null);

  // Fetch columns on mount
  useEffect(() => {
    setLoadingCols(true);
    import('@/lib/api')
      .then((api) => api.getPredictorColumns(fileId))
      .then((res) => setColumns(res.columns))
      .catch((e) => addNotification(`Failed to load columns: ${e.message}`, 'error'))
      .finally(() => setLoadingCols(false));
  }, [fileId, addNotification]);

  const handleTrain = async () => {
    if (!targetColumn) {
      addNotification('Please select a target column', 'warning');
      return;
    }
    setTraining(true);
    try {
      const api = await import('@/lib/api');
      const res = await api.trainPredictorModel(fileId, targetColumn, modelType);
      setTrainResult(res);
      setStep('trained');
      // Initialise input fields for feature columns
      const init: Record<string, string> = {};
      for (const col of res.columns_used) {
        init[col] = '';
      }
      setInputValues(init);
      addNotification('Model trained successfully!', 'success');
    } catch (e) {
      addNotification(`Training failed: ${e instanceof Error ? e.message : 'Unknown'}`, 'error');
    } finally {
      setTraining(false);
    }
  };

  const handlePredict = async () => {
    if (!trainResult) return;
    const vals: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(inputValues)) {
      const num = parseFloat(v);
      vals[k] = isNaN(num) ? v : num;
    }
    setPredicting(true);
    try {
      const api = await import('@/lib/api');
      const res = await api.makePrediction(trainResult.model_id, vals);
      setPredictResult(res);
      setStep('predicted');
    } catch (e) {
      addNotification(`Prediction failed: ${e instanceof Error ? e.message : 'Unknown'}`, 'error');
    } finally {
      setPredicting(false);
    }
  };

  const featureImportanceData = trainResult
    ? Object.entries(trainResult.feature_importance)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, value]) => ({ name, value: parseFloat((value * 100).toFixed(1)) }))
    : [];

  return (
    <div className="space-y-6">
      {/* Step 1: Configure */}
      <div className="bg-slate-900 border border-slate-700 rounded-lg p-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center">1</span>
          Select Target Column &amp; Model
        </h3>
        {loadingCols ? (
          <div className="flex items-center gap-2 text-slate-400">
            <Spinner size={16} /> Loading columns…
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Target column to predict</label>
              <select
                value={targetColumn}
                onChange={(e) => setTargetColumn(e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 text-slate-200 text-sm rounded px-3 py-2 focus:outline-none focus:border-indigo-500"
              >
                <option value="">— select column —</option>
                {columns.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Model type</label>
              <div className="flex gap-3">
                {(['random_forest', 'linear_regression'] as const).map((m) => (
                  <label key={m} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      value={m}
                      checked={modelType === m}
                      onChange={() => setModelType(m)}
                      className="accent-indigo-500"
                    />
                    <span className="text-sm text-slate-300 capitalize">
                      {m.replace('_', ' ')}
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <button
              onClick={handleTrain}
              disabled={training || !targetColumn}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 border border-indigo-500/50 text-white text-sm rounded hover:bg-indigo-500 disabled:opacity-50"
            >
              {training ? <Spinner size={14} /> : <Sparkles size={14} />}
              {training ? 'Training…' : 'Train Model'}
            </button>
          </div>
        )}
      </div>

      {/* Step 2: Training results */}
      {trainResult && (
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-xs flex items-center justify-center">2</span>
            Training Results
            <span className="text-xs bg-emerald-900/60 text-emerald-300 border border-emerald-700 px-2 py-0.5 rounded-full ml-auto">
              Model Ready!
            </span>
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <Badge value={`${(trainResult.accuracy * 100).toFixed(1)}%`} label="Accuracy (R²)" color="indigo" />
            <Badge value={trainResult.r2_score.toFixed(3)} label="R² Score" color="emerald" />
            <Badge value={trainResult.rmse.toFixed(3)} label="RMSE" color="amber" />
            <Badge value={trainResult.training_samples} label="Training Rows" color="indigo" />
          </div>
          {featureImportanceData.length > 0 && (
            <div>
              <h4 className="text-xs text-slate-400 mb-2 font-medium">Feature Importance (%)</h4>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={featureImportanceData}
                    layout="vertical"
                    margin={{ top: 2, right: 24, bottom: 2, left: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 9 }} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fill: '#94a3b8', fontSize: 9 }}
                      width={90}
                    />
                    <Tooltip
                      contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 4 }}
                      labelStyle={{ color: '#e2e8f0', fontSize: 11 }}
                      itemStyle={{ color: '#a5b4fc', fontSize: 11 }}
                      formatter={(v: number) => [`${v}%`, 'Importance']}
                    />
                    <Bar dataKey="value" fill="#818cf8" radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 3: Make prediction */}
      {trainResult && (
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center">3</span>
            Make a Prediction
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
            {trainResult.columns_used.map((col) => (
              <div key={col}>
                <label className="block text-xs text-slate-400 mb-1">{col}</label>
                <input
                  type="text"
                  value={inputValues[col] ?? ''}
                  onChange={(e) =>
                    setInputValues((prev) => ({ ...prev, [col]: e.target.value }))
                  }
                  placeholder="Enter value"
                  className="w-full bg-slate-800 border border-slate-600 text-slate-200 text-sm rounded px-3 py-1.5 focus:outline-none focus:border-indigo-500"
                />
              </div>
            ))}
          </div>
          <button
            onClick={handlePredict}
            disabled={predicting}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 border border-indigo-500/50 text-white text-sm rounded hover:bg-indigo-500 disabled:opacity-50"
          >
            {predicting ? <Spinner size={14} /> : <Zap size={14} />}
            {predicting ? 'Predicting…' : 'Predict'}
          </button>

          {predictResult && (
            <div className="mt-4 bg-slate-800/70 border border-indigo-700/50 rounded-lg p-4 text-center">
              <p className="text-xs text-slate-400 mb-1">Predicted value</p>
              <p className="text-4xl font-bold text-indigo-300">
                {predictResult.prediction.toLocaleString()}
              </p>
              <p className="text-xs text-slate-500 mt-2">
                90% confidence interval:{' '}
                <span className="text-slate-300">
                  [{predictResult.confidence_interval[0].toLocaleString()},{' '}
                  {predictResult.confidence_interval[1].toLocaleString()}]
                </span>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main AgentsPage
// ---------------------------------------------------------------------------

export default function AgentsPage({ fileId }: AgentsPageProps) {
  const { addNotification } = useGlobalContext();
  const [activeAgent, setActiveAgent] = useState('cleaner');
  const [loading, setLoading] = useState(false);
  const [cleanerResult, setCleanerResult] = useState<CleanerAnalysisResponse | null>(null);
  const [analystResult, setAnalystResult] = useState<AnalystInsightsResponse | null>(null);
  const [reporterResult, setReporterResult] = useState<ReporterGenerateResponse | null>(null);

  const agents = [
    { id: 'cleaner', name: 'Data Cleaner', icon: '🧹', description: 'Analyze and fix data quality issues' },
    { id: 'analyst', name: 'Analyst', icon: '📊', description: 'Generate insights from your data' },
    { id: 'reporter', name: 'Reporter', icon: '📄', description: 'Create professional HTML reports' },
    { id: 'predictor', name: 'Predictor', icon: '🤖', description: 'Build predictive models' },
  ];

  const runAgent = useCallback(async () => {
    if (!fileId) {
      addNotification('Please upload a file first', 'warning');
      return;
    }
    setLoading(true);
    try {
      const api = await import('@/lib/api');
      switch (activeAgent) {
        case 'cleaner': {
          const r = await api.analyzeCleanerSuggestions(fileId);
          setCleanerResult(r);
          break;
        }
        case 'analyst': {
          const r = await api.generateAnalystInsights(fileId);
          setAnalystResult(r);
          break;
        }
        case 'reporter': {
          const r = await api.generateReport(fileId, 'Data Analysis Report', true);
          setReporterResult(r);
          break;
        }
        case 'predictor':
          // Predictor manages its own state
          break;
        default:
          break;
      }
    } catch (err) {
      addNotification(
        `Agent failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
        'error'
      );
    } finally {
      setLoading(false);
    }
  }, [activeAgent, fileId, addNotification]);

  const hasResult =
    (activeAgent === 'cleaner' && cleanerResult !== null) ||
    (activeAgent === 'analyst' && analystResult !== null) ||
    (activeAgent === 'reporter' && reporterResult !== null);

  const showRunButton = activeAgent !== 'predictor';

  return (
    <div className="space-y-6">
      {/* Agent tabs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {agents.map((agent) => (
          <button
            key={agent.id}
            onClick={() => setActiveAgent(agent.id)}
            className={`p-4 rounded-lg border-2 text-left transition-all ${
              activeAgent === agent.id
                ? 'border-indigo-500 bg-indigo-950/40'
                : 'border-slate-700 bg-slate-900 hover:border-indigo-400/60'
            }`}
          >
            <div className="text-2xl mb-1">{agent.icon}</div>
            <h3 className="font-semibold text-slate-100 text-sm">{agent.name}</h3>
            <p className="text-xs text-slate-400 mt-0.5 leading-snug">{agent.description}</p>
          </button>
        ))}
      </div>

      {/* Agent panel */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg shadow-lg">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <h2 className="text-lg font-semibold text-slate-100">
            {agents.find((a) => a.id === activeAgent)?.name}
          </h2>
          {showRunButton && (
            <button
              onClick={runAgent}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 border border-indigo-500/50 text-white text-sm rounded hover:bg-indigo-500 disabled:opacity-50"
            >
              {loading ? <Spinner size={14} /> : <Sparkles size={14} />}
              {loading ? 'Processing…' : 'Run Agent'}
            </button>
          )}
        </div>

        <div className="p-5">
          {/* Loading state */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Spinner size={32} />
              <span className="text-slate-400 text-sm">Analyzing your data…</span>
              <div className="w-48 h-1 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 animate-pulse" style={{ width: '60%' }} />
              </div>
            </div>
          )}

          {/* Results */}
          {!loading && activeAgent === 'cleaner' && cleanerResult && (
            <CleanerPanel
              fileId={fileId!}
              result={cleanerResult}
              onRefresh={runAgent}
            />
          )}

          {!loading && activeAgent === 'analyst' && analystResult && (
            <AnalystPanel result={analystResult} />
          )}

          {!loading && activeAgent === 'reporter' && reporterResult && (
            <ReporterPanel result={reporterResult} />
          )}

          {!loading && activeAgent === 'predictor' && fileId && (
            <PredictorPanel fileId={fileId} />
          )}

          {/* Empty state */}
          {!loading && !hasResult && activeAgent !== 'predictor' && (
            <div className="text-center py-10 text-slate-500">
              <Brain className="mx-auto mb-3 text-slate-600" size={36} />
              <p className="text-sm">Click &quot;Run Agent&quot; to analyze your data</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
