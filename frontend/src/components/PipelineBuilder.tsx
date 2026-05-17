'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, {
  addEdge,
  Background,
  Connection,
  Controls,
  Edge,
  Handle,
  MarkerType,
  MiniMap,
  Node,
  NodeProps,
  Position,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Download, Play, Plus, Save } from 'lucide-react';
import { motion } from 'framer-motion';

import { useGlobalContext } from '@/context/GlobalContext';
import { API_BASE_URL } from '@/lib/config';
import { executePipeline, getProfile } from '@/lib/api';

type NodeKind = 'source' | 'filter' | 'transform' | 'aggregate' | 'output';

type Condition = 'equals' | 'greater_than' | 'less_than' | 'contains' | 'not_null' | 'is_null';

type TransformOperation =
  | 'rename_column'
  | 'drop_column'
  | 'fill_nulls_mean'
  | 'fill_nulls_median'
  | 'fill_nulls_zero'
  | 'uppercase'
  | 'lowercase';

type AggregateFn = 'sum' | 'mean' | 'count' | 'min' | 'max';

interface PipelineBuilderProps {
  fileId?: string;
  onPipelineChange?: (nodes: Node[], edges: Edge[]) => void;
}

interface PipelineNodeData {
  label: string;
  nodeType: NodeKind;
  color: string;
  config: Record<string, unknown>;
  columns: string[];
  filename?: string;
  rowCount: number;
  colCount: number;
  outputPreview: Record<string, unknown>[];
  outputRowCount?: number;
  isExecuting?: boolean;
  onConfigChange?: (nodeId: string, patch: Record<string, unknown>) => void;
  onDownload?: () => void;
}

interface ExecutionResult {
  success: boolean;
  execution_id: string;
  execution_time_ms: number;
  rows_before: number;
  rows_after: number;
  preview: Record<string, unknown>[];
  columns: string[];
  cleaned_file_id?: string;
  download_url?: string;
  error?: string;
}

interface StoredPipeline {
  id: string;
  name: string;
  fileId?: string;
  nodes: Node[];
  edges: Edge[];
  createdAt: string;
}

const STORAGE_KEY = 'datamind:pipeline-builder:saved';
const DEPLOYMENT_VERSION = 'Deploy-Test-V2';

const NODE_META: Record<NodeKind, { label: string; color: string }> = {
  source: { label: 'Source', color: '#8b5cf6' },
  filter: { label: 'Filter', color: '#3b82f6' },
  transform: { label: 'Transform', color: '#10b981' },
  aggregate: { label: 'Aggregate', color: '#f59e0b' },
  output: { label: 'Output', color: '#ef4444' },
};

const FILTER_CONDITIONS: { label: string; value: Condition }[] = [
  { label: 'Equals', value: 'equals' },
  { label: 'Greater than', value: 'greater_than' },
  { label: 'Less than', value: 'less_than' },
  { label: 'Contains', value: 'contains' },
  { label: 'Not null', value: 'not_null' },
  { label: 'Is null', value: 'is_null' },
];

const TRANSFORM_OPS: { label: string; value: TransformOperation }[] = [
  { label: 'Rename column', value: 'rename_column' },
  { label: 'Drop column', value: 'drop_column' },
  { label: 'Fill nulls with mean', value: 'fill_nulls_mean' },
  { label: 'Fill nulls with median', value: 'fill_nulls_median' },
  { label: 'Fill nulls with 0', value: 'fill_nulls_zero' },
  { label: 'Convert to uppercase', value: 'uppercase' },
  { label: 'Convert to lowercase', value: 'lowercase' },
];

const AGG_OPS: AggregateFn[] = ['sum', 'mean', 'count', 'min', 'max'];

function getGlowingEdge() {
  return {
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 20,
      height: 20,
      color: '#22d3ee',
    },
    style: {
      stroke: '#22d3ee',
      strokeWidth: 2.5,
      filter: 'drop-shadow(0 0 8px rgba(34,211,238,0.75))',
    },
  };
}

function NodeShell({
  title,
  color,
  children,
}: {
  title: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div className="w-72 rounded-2xl border border-cyan-400/20 bg-slate-900/65 shadow-[0_0_24px_rgba(34,211,238,0.18)] backdrop-blur-xl transition-all duration-300 hover:border-cyan-300/40 hover:shadow-[0_0_38px_rgba(129,140,248,0.35)]">
      <div className="rounded-t-2xl border-b border-white/10 px-3 py-2 text-sm font-semibold text-white" style={{ backgroundColor: `${color}cc` }}>
        {title}
      </div>
      <div className="space-y-2 px-3 py-3 text-xs text-slate-200">{children}</div>
    </div>
  );
}

function SourceNode({ data }: NodeProps<PipelineNodeData>) {
  return (
    <NodeShell title={data.label || 'Source'} color={NODE_META.source.color}>
      <div className="text-slate-300">File: <span className="text-slate-100">{data.filename ?? 'No file'}</span></div>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded bg-slate-800 px-2 py-1">Rows: <b>{data.rowCount || 0}</b></div>
        <div className="rounded bg-slate-800 px-2 py-1">Cols: <b>{data.colCount || 0}</b></div>
      </div>
      <Handle type="source" position={Position.Right} className="!bg-violet-400" />
    </NodeShell>
  );
}

function FilterNode({ id, data }: NodeProps<PipelineNodeData>) {
  const config = data.config;
  const column = String(config.column ?? '');
  const condition = String(config.condition ?? 'equals');
  const value = String(config.value ?? '');

  const estimatedRows = Math.max(
    0,
    condition === 'is_null'
      ? Math.round(data.rowCount * 0.1)
      : condition === 'not_null'
      ? Math.round(data.rowCount * 0.9)
      : Math.round(data.rowCount * 0.5)
  );

  return (
    <NodeShell title="Filter" color={NODE_META.filter.color}>
      <select
        value={column}
        onChange={(e) => data.onConfigChange?.(id, { column: e.target.value })}
        className="w-full rounded border border-slate-700 bg-slate-800 px-2 py-1"
      >
        <option value="">Select column</option>
        {data.columns.map((col) => (
          <option key={col} value={col}>{col}</option>
        ))}
      </select>
      <select
        value={condition}
        onChange={(e) => data.onConfigChange?.(id, { condition: e.target.value })}
        className="w-full rounded border border-slate-700 bg-slate-800 px-2 py-1"
      >
        {FILTER_CONDITIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {condition !== 'not_null' && condition !== 'is_null' && (
        <input
          value={value}
          onChange={(e) => data.onConfigChange?.(id, { value: e.target.value })}
          placeholder="Value"
          className="w-full rounded border border-slate-700 bg-slate-800 px-2 py-1"
        />
      )}
      <div className="rounded bg-slate-800 px-2 py-1 text-slate-300">Will filter ~{estimatedRows.toLocaleString()} rows</div>
      <Handle type="target" position={Position.Left} className="!bg-blue-400" />
      <Handle type="source" position={Position.Right} className="!bg-blue-400" />
    </NodeShell>
  );
}

function TransformNode({ id, data }: NodeProps<PipelineNodeData>) {
  const config = data.config;
  const operation = String(config.operation ?? 'rename_column');
  const column = String(config.column ?? '');
  const newName = String(config.new_name ?? '');

  return (
    <NodeShell title="Transform" color={NODE_META.transform.color}>
      <select
        value={operation}
        onChange={(e) => data.onConfigChange?.(id, { operation: e.target.value })}
        className="w-full rounded border border-slate-700 bg-slate-800 px-2 py-1"
      >
        {TRANSFORM_OPS.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      <select
        value={column}
        onChange={(e) => data.onConfigChange?.(id, { column: e.target.value })}
        className="w-full rounded border border-slate-700 bg-slate-800 px-2 py-1"
      >
        <option value="">Select column</option>
        {data.columns.map((col) => (
          <option key={col} value={col}>{col}</option>
        ))}
      </select>
      {operation === 'rename_column' && (
        <input
          value={newName}
          onChange={(e) => data.onConfigChange?.(id, { new_name: e.target.value })}
          placeholder="New column name"
          className="w-full rounded border border-slate-700 bg-slate-800 px-2 py-1"
        />
      )}
      <Handle type="target" position={Position.Left} className="!bg-emerald-400" />
      <Handle type="source" position={Position.Right} className="!bg-emerald-400" />
    </NodeShell>
  );
}

function AggregateNode({ id, data }: NodeProps<PipelineNodeData>) {
  const config = data.config;
  const groupBy = String(config.group_by ?? '');
  const aggregations = (config.aggregations as Record<string, AggregateFn>) ?? {};
  const selected = Object.keys(aggregations);

  return (
    <NodeShell title="Aggregate" color={NODE_META.aggregate.color}>
      <select
        value={groupBy}
        onChange={(e) => data.onConfigChange?.(id, { group_by: e.target.value })}
        className="w-full rounded border border-slate-700 bg-slate-800 px-2 py-1"
      >
        <option value="">Group by column</option>
        {data.columns.map((col) => (
          <option key={col} value={col}>{col}</option>
        ))}
      </select>

      <div className="max-h-32 space-y-1 overflow-auto rounded border border-slate-700 bg-slate-850 p-2">
        {data.columns
          .filter((col) => col !== groupBy)
          .map((col) => {
            const isChecked = selected.includes(col);
            return (
              <div key={col} className="space-y-1 rounded bg-slate-800 p-1">
                <label className="flex items-center gap-2 text-slate-200">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => {
                      const next = { ...aggregations };
                      if (e.target.checked) {
                        next[col] = 'sum';
                      } else {
                        delete next[col];
                      }
                      data.onConfigChange?.(id, { aggregations: next });
                    }}
                  />
                  {col}
                </label>
                {isChecked && (
                  <select
                    value={aggregations[col]}
                    onChange={(e) => {
                      const next = { ...aggregations, [col]: e.target.value as AggregateFn };
                      data.onConfigChange?.(id, { aggregations: next });
                    }}
                    className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1"
                  >
                    {AGG_OPS.map((fn) => (
                      <option key={fn} value={fn}>{fn}</option>
                    ))}
                  </select>
                )}
              </div>
            );
          })}
      </div>

      <Handle type="target" position={Position.Left} className="!bg-orange-400" />
      <Handle type="source" position={Position.Right} className="!bg-orange-400" />
    </NodeShell>
  );
}

function OutputNode({ data }: NodeProps<PipelineNodeData>) {
  const rows = (data.outputPreview ?? []).slice(0, 10);
  const cols = rows.length > 0 ? Object.keys(rows[0]) : [];

  return (
    <NodeShell title="Output" color={NODE_META.output.color}>
      <div className="flex items-center justify-between">
        <span className="text-slate-300">Preview</span>
        <span className="rounded bg-slate-800 px-2 py-0.5 text-slate-100">Rows: {data.outputRowCount ?? 0}</span>
      </div>
      <div className="max-h-36 overflow-auto rounded border border-slate-700">
        {rows.length === 0 ? (
          <div className="px-2 py-3 text-slate-400">Execute pipeline to preview rows</div>
        ) : (
          <table className="min-w-full text-[10px]">
            <thead className="bg-slate-800 text-slate-300">
              <tr>
                {cols.map((col) => (
                  <th key={col} className="px-2 py-1 text-left">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={idx} className="border-t border-slate-800">
                  {cols.map((col) => (
                    <td key={`${idx}-${col}`} className="px-2 py-1 text-slate-200">
                      {String(row[col] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <button
        onClick={data.onDownload}
        disabled={!data.outputPreview?.length}
        className="w-full rounded border border-red-500/40 bg-red-600/80 px-2 py-1 text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        Download CSV
      </button>
      <Handle type="target" position={Position.Left} className="!bg-red-400" />
    </NodeShell>
  );
}

export default function PipelineBuilder({ fileId, onPipelineChange }: PipelineBuilderProps) {
  const { addNotification, setFileId, setFilename } = useGlobalContext();
  const [nodes, setNodes, onNodesChange] = useNodesState<PipelineNodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
  const [savedPipelines, setSavedPipelines] = useState<StoredPipeline[]>([]);
  const [selectedLoadKey, setSelectedLoadKey] = useState('');

  const nodeCountRef = useRef(0);
  const starterNodeInitRef = useRef(false);
  const profileRef = useRef<{ filename?: string; rowCount: number; colCount: number; columns: string[] }>({
    filename: undefined,
    rowCount: 0,
    colCount: 0,
    columns: [],
  });

  useEffect(() => {
    if (onPipelineChange) onPipelineChange(nodes, edges);
  }, [nodes, edges, onPipelineChange]);

  useEffect(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as StoredPipeline[];
      setSavedPipelines(Array.isArray(parsed) ? parsed : []);
    } catch {
      setSavedPipelines([]);
    }
  }, []);

  const updateNodeConfig = useCallback(
    (nodeId: string, patch: Record<string, unknown>) => {
      setNodes((curr) =>
        curr.map((node) => {
          if (node.id !== nodeId) return node;
          const data = node.data as PipelineNodeData;
          return {
            ...node,
            data: {
              ...data,
              config: {
                ...data.config,
                ...patch,
              },
            },
          };
        })
      );
    },
    [setNodes]
  );

  const downloadResultCsv = useCallback(() => {
    if (!executionResult?.download_url) {
      addNotification('No pipeline result available for download', 'warning');
      return;
    }
    window.open(`${API_BASE_URL}${executionResult.download_url}`, '_blank');
  }, [executionResult, addNotification]);

  useEffect(() => {
    if (starterNodeInitRef.current || nodes.length > 0) return;
    starterNodeInitRef.current = true;
    nodeCountRef.current = 1;
    setNodes([
      {
        id: 'source_1',
        type: 'source',
        position: { x: 360, y: 260 },
        data: {
          label: 'Start Pipeline',
          nodeType: 'source',
          color: NODE_META.source.color,
          config: defaultConfig('source'),
          filename: profileRef.current.filename,
          rowCount: profileRef.current.rowCount,
          colCount: profileRef.current.colCount,
          columns: profileRef.current.columns,
          outputPreview: [],
          onConfigChange: updateNodeConfig,
          onDownload: downloadResultCsv,
        },
      },
    ]);
  }, [nodes.length, setNodes, updateNodeConfig, downloadResultCsv]);

  const nodeTypes = useMemo(
    () => ({
      source: SourceNode,
      filter: FilterNode,
      transform: TransformNode,
      aggregate: AggregateNode,
      output: OutputNode,
    }),
    []
  );

  const hydrateNodes = useCallback(
    (rawNodes: Node[]) => {
      return rawNodes.map((node) => {
        const oldData = (node.data || {}) as Partial<PipelineNodeData>;
        const nodeType = (oldData.nodeType || node.type || 'transform') as NodeKind;
        const meta = NODE_META[nodeType];

        return {
          ...node,
          type: nodeType,
          data: {
            ...oldData,
            label: meta.label,
            nodeType,
            color: meta.color,
            config: oldData.config || defaultConfig(nodeType),
            columns: profileRef.current.columns,
            filename: profileRef.current.filename,
            rowCount: profileRef.current.rowCount,
            colCount: profileRef.current.colCount,
            outputPreview: oldData.outputPreview || [],
            onConfigChange: updateNodeConfig,
            onDownload: downloadResultCsv,
          } as PipelineNodeData,
        } as Node<PipelineNodeData>;
      });
    },
    [downloadResultCsv, updateNodeConfig]
  );

  useEffect(() => {
    if (!fileId) return;

    let active = true;
    setIsProfileLoading(true);

    getProfile(fileId)
      .then((profile) => {
        if (!active) return;

        profileRef.current = {
          filename: profile.filename,
          rowCount: profile.row_count,
          colCount: profile.col_count,
          columns: profile.columns.map((c) => c.name),
        };

        setNodes((curr) =>
          curr.map((node) => ({
            ...node,
            data: {
              ...(node.data as PipelineNodeData),
              filename: profile.filename,
              rowCount: profile.row_count,
              colCount: profile.col_count,
              columns: profile.columns.map((c) => c.name),
            },
          }))
        );
      })
      .catch((error) => {
        addNotification(`Failed to load profile: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
      })
      .finally(() => {
        if (active) setIsProfileLoading(false);
      });

    return () => {
      active = false;
    };
  }, [fileId, setNodes, addNotification]);

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            animated: true,
            ...getGlowingEdge(),
          },
          eds
        )
      );
      addNotification('Connection created', 'success');
    },
    [setEdges, addNotification]
  );

  const addNode = useCallback(
    (type: NodeKind) => {
      nodeCountRef.current += 1;
      const meta = NODE_META[type];
      const newNode: Node<PipelineNodeData> = {
        id: `${type}_${nodeCountRef.current}`,
        type,
        position: {
          x: 120 + (nodeCountRef.current % 3) * 280,
          y: 60 + Math.floor(nodeCountRef.current / 3) * 150,
        },
        data: {
          label: meta.label,
          nodeType: type,
          color: meta.color,
          config: defaultConfig(type),
          filename: profileRef.current.filename,
          rowCount: profileRef.current.rowCount,
          colCount: profileRef.current.colCount,
          columns: profileRef.current.columns,
          outputPreview: [],
          onConfigChange: updateNodeConfig,
          onDownload: downloadResultCsv,
        },
      };
      setNodes((curr) => [...curr, newNode]);
    },
    [setNodes, updateNodeConfig, downloadResultCsv]
  );

  const saveToLocal = useCallback(() => {
    if (nodes.length === 0) {
      addNotification('Add at least one node before saving', 'warning');
      return;
    }

    const name = window.prompt('Pipeline name');
    if (!name) return;

    const sanitizedNodes = nodes.map((node) => {
      const data = node.data as PipelineNodeData;
      const { onConfigChange: _a, onDownload: _b, ...serializable } = data;
      return { ...node, data: serializable };
    });

    const next: StoredPipeline[] = [
      {
        id: `saved_${Date.now()}`,
        name,
        fileId,
        nodes: sanitizedNodes,
        edges,
        createdAt: new Date().toISOString(),
      },
      ...savedPipelines,
    ];

    setSavedPipelines(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    addNotification('Pipeline saved locally', 'success');
  }, [nodes, edges, fileId, savedPipelines, addNotification]);

  const applyTemplate = useCallback(
    (templateKey: string) => {
      const templateNodes: Node[] = [];
      const templateEdges: Edge[] = [];

      if (templateKey === 'template:clean-nulls') {
        templateNodes.push(
          makeTemplateNode('source', { x: 60, y: 100 }),
          makeTemplateNode('transform', { x: 360, y: 100 }, { operation: 'fill_nulls_zero' }),
          makeTemplateNode('output', { x: 660, y: 100 })
        );
      } else if (templateKey === 'template:filter-export') {
        templateNodes.push(
          makeTemplateNode('source', { x: 60, y: 240 }),
          makeTemplateNode('filter', { x: 360, y: 240 }),
          makeTemplateNode('output', { x: 660, y: 240 })
        );
      } else if (templateKey === 'template:group-summary') {
        templateNodes.push(
          makeTemplateNode('source', { x: 60, y: 380 }),
          makeTemplateNode('aggregate', { x: 360, y: 380 }),
          makeTemplateNode('output', { x: 660, y: 380 })
        );
      }

      if (templateNodes.length > 1) {
        for (let i = 0; i < templateNodes.length - 1; i += 1) {
          templateEdges.push({
            id: `template-edge-${i}-${Date.now()}`,
            source: templateNodes[i].id,
            target: templateNodes[i + 1].id,
            animated: true,
            ...getGlowingEdge(),
          });
        }
      }

      setNodes(hydrateNodes(templateNodes));
      setEdges(templateEdges);
      addNotification('Template loaded', 'success');
    },
    [setNodes, setEdges, hydrateNodes, addNotification]
  );

  const loadSelectedPipeline = useCallback(() => {
    if (!selectedLoadKey) return;

    if (selectedLoadKey.startsWith('template:')) {
      applyTemplate(selectedLoadKey);
      return;
    }

    const selected = savedPipelines.find((p) => p.id === selectedLoadKey);
    if (!selected) {
      addNotification('Saved pipeline not found', 'error');
      return;
    }

    setNodes(hydrateNodes(selected.nodes));
    setEdges(
      selected.edges.map((edge) => ({
        ...edge,
        animated: true,
        ...getGlowingEdge(),
      }))
    );
    addNotification(`Loaded pipeline: ${selected.name}`, 'success');
  }, [selectedLoadKey, savedPipelines, applyTemplate, setNodes, setEdges, hydrateNodes, addNotification]);

  const execute = useCallback(async () => {
    if (!fileId) {
      addNotification('Upload a file first', 'warning');
      return;
    }
    if (nodes.length === 0) {
      addNotification('Add nodes to execute a pipeline', 'warning');
      return;
    }

    setIsExecuting(true);
    setExecutionResult(null);

    try {
      const apiNodes = nodes.map((node) => {
        const data = node.data as PipelineNodeData;
        const config = data.config || {};
        const operation = String(config.operation ?? data.nodeType);
        return {
          id: node.id,
          type: data.nodeType,
          label: data.label,
          position: node.position,
          config: {
            operation,
            parameters: config,
          },
        };
      });

      const apiEdges = edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
      }));

      const result = (await executePipeline(apiNodes, apiEdges, fileId)) as unknown as ExecutionResult;

      if (!result.success) {
        throw new Error(result.error || 'Pipeline execution failed');
      }

      setExecutionResult(result);

      setNodes((curr) =>
        curr.map((node) => {
          const data = node.data as PipelineNodeData;
          if (data.nodeType !== 'output') return node;
          return {
            ...node,
            data: {
              ...data,
              outputPreview: result.preview.slice(0, 10),
              outputRowCount: result.rows_after,
            },
          };
        })
      );

      addNotification('Pipeline executed successfully', 'success');
    } catch (error) {
      addNotification(`Execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    } finally {
      setIsExecuting(false);
    }
  }, [fileId, nodes, edges, addNotification, setNodes]);

  const saveAsNewDataset = useCallback(() => {
    if (!executionResult?.cleaned_file_id) {
      addNotification('Execute pipeline first', 'warning');
      return;
    }

    setFileId(executionResult.cleaned_file_id);
    setFilename(`pipeline-result-${executionResult.cleaned_file_id.slice(0, 8)}.csv`);
    addNotification('Saved as new active dataset', 'success');
  }, [executionResult, setFileId, setFilename, addNotification]);

  return (
    <div className="space-y-4">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="rounded-xl border border-cyan-500/20 bg-slate-900/70 p-3 backdrop-blur-md"
      >
        <div className="grid gap-2 text-xs text-slate-200 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-cyan-500/20 bg-slate-950/80 px-3 py-2">
            <div className="text-slate-400">Active File</div>
            <div className="truncate font-semibold text-cyan-200">{profileRef.current.filename || 'No file selected'}</div>
          </div>
          <div className="rounded-lg border border-indigo-500/20 bg-slate-950/80 px-3 py-2">
            <div className="text-slate-400">Node Count</div>
            <div className="font-semibold text-indigo-200">{nodes.length}</div>
          </div>
          <div className="rounded-lg border border-fuchsia-500/20 bg-slate-950/80 px-3 py-2">
            <div className="text-slate-400">Connection Count</div>
            <div className="font-semibold text-fuchsia-200">{edges.length}</div>
          </div>
          <div className="rounded-lg border border-emerald-500/30 bg-slate-950/80 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-400">Deployment</span>
              <span className="rounded-full border border-emerald-300/80 bg-emerald-500/30 px-2 py-0.5 text-[10px] font-extrabold text-emerald-100 shadow-[0_0_14px_rgba(16,185,129,0.8)]">
                Version: {DEPLOYMENT_VERSION}
              </span>
            </div>
            <div className="mt-1 font-semibold text-emerald-200">Build: CI/CD Verified</div>
          </div>
        </div>
      </motion.div>

      <div className="grid h-[720px] grid-cols-1 gap-4 lg:grid-cols-[250px_1fr]">
        <motion.div
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35, delay: 0.05 }}
          className="rounded-xl border border-cyan-500/20 bg-slate-900/70 p-4 backdrop-blur-xl"
        >
          <h3 className="mb-2 text-sm font-semibold text-slate-100">Nodes</h3>
          <div className="space-y-2">
            {(Object.keys(NODE_META) as NodeKind[]).map((nodeType) => (
              <motion.button
                key={nodeType}
                onClick={() => addNode(nodeType)}
                whileHover={{ scale: 1.02, y: -1 }}
                whileTap={{ scale: 0.98 }}
                className="flex w-full items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm font-medium text-white shadow-[0_0_14px_rgba(125,211,252,0.2)] backdrop-blur-md transition-colors hover:border-white/40"
              >
                <Plus size={14} /> {NODE_META[nodeType].label}
              </motion.button>
            ))}
          </div>

          <div className="mt-4 space-y-2 border-t border-slate-800 pt-4">
            <motion.button
              onClick={execute}
              disabled={isExecuting || !fileId || nodes.length === 0}
              whileHover={{ scale: isExecuting ? 1 : 1.01 }}
              whileTap={{ scale: isExecuting ? 1 : 0.98 }}
              className={`flex w-full items-center justify-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-[0_0_22px_rgba(99,102,241,0.85)] disabled:opacity-50 ${isExecuting ? '' : 'motion-safe:animate-[pulse_1.5s_ease-in-out_2]'}`}
            >
              <Play size={14} /> {isExecuting ? 'Executing...' : 'Execute'}
            </motion.button>

            <motion.button
              onClick={saveToLocal}
              disabled={nodes.length === 0}
              whileHover={{ scale: nodes.length === 0 ? 1 : 1.01 }}
              whileTap={{ scale: nodes.length === 0 ? 1 : 0.98 }}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              <Save size={14} /> Save
            </motion.button>

            <motion.button
              onClick={downloadResultCsv}
              disabled={!executionResult?.download_url}
              whileHover={{ scale: executionResult?.download_url ? 1.01 : 1 }}
              whileTap={{ scale: executionResult?.download_url ? 0.98 : 1 }}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              <Download size={14} /> Download CSV
            </motion.button>
          </div>

          <div className="mt-4 space-y-2 border-t border-slate-800 pt-4">
            <select
              value={selectedLoadKey}
              onChange={(e) => setSelectedLoadKey(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-2 text-xs text-slate-100"
            >
              <option value="">Load saved/template</option>
              <option value="template:clean-nulls">Template: Clean nulls</option>
              <option value="template:filter-export">Template: Filter &amp; Export</option>
              <option value="template:group-summary">Template: Group Summary</option>
              {savedPipelines.map((pipeline) => (
                <option key={pipeline.id} value={pipeline.id}>
                  Saved: {pipeline.name}
                </option>
              ))}
            </select>
            <button
              onClick={loadSelectedPipeline}
              disabled={!selectedLoadKey}
              className="w-full rounded-md bg-slate-700 px-3 py-2 text-xs font-semibold text-slate-100 disabled:opacity-50"
            >
              Load selection
            </button>
          </div>

          <div className="mt-4 rounded-md bg-slate-800 p-2 text-xs text-slate-300">
            {isProfileLoading ? 'Loading file profile...' : `Rows: ${profileRef.current.rowCount} | Cols: ${profileRef.current.colCount}`}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35, delay: 0.1 }}
          className="relative overflow-hidden rounded-xl border-2 border-cyan-300 bg-slate-900/70 shadow-[0_0_0_1px_rgba(103,232,249,0.8),0_0_28px_rgba(34,211,238,0.85),0_0_48px_rgba(217,70,239,0.55)]"
        >
          <motion.div
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              background:
                'radial-gradient(circle at 20% 20%, rgba(34,211,238,0.18), transparent 45%), radial-gradient(circle at 80% 30%, rgba(167,139,250,0.2), transparent 40%), linear-gradient(130deg, rgba(8,47,73,0.6), rgba(15,23,42,0.8), rgba(67,56,202,0.45), rgba(15,23,42,0.8))',
              backgroundSize: '250% 250%',
            }}
            animate={{ backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }}
            transition={{ duration: 16, repeat: Infinity, ease: 'linear' }}
          />
          <ReactFlowProvider>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              nodeTypes={nodeTypes}
              fitView
              deleteKeyCode={['Backspace', 'Delete']}
              className="bg-transparent"
            >
              <Background color="#334155" gap={16} />
              <MiniMap
                pannable
                zoomable
                nodeColor={() => '#22d3ee'}
                maskColor="rgba(2, 6, 23, 0.6)"
                className="!border !border-cyan-500/30 !bg-slate-900/80"
              />
              <Controls className="!border !border-cyan-500/30 !bg-slate-900/80 !backdrop-blur-md" />
            </ReactFlow>
          </ReactFlowProvider>
          {isExecuting && (
            <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-slate-950/55 backdrop-blur-sm">
              <motion.div
                className="flex items-center gap-3 rounded-xl border border-cyan-400/30 bg-slate-900/80 px-4 py-3 text-sm font-medium text-cyan-100"
                initial={{ scale: 0.96, opacity: 0.7 }}
                animate={{ scale: [0.96, 1, 0.96], opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
              >
                <motion.span
                  className="h-3 w-3 rounded-full bg-cyan-300"
                  animate={{
                    boxShadow: [
                      '0 0 0px rgba(34,211,238,0.2)',
                      '0 0 18px rgba(34,211,238,0.95)',
                      '0 0 0px rgba(34,211,238,0.2)',
                    ],
                  }}
                  transition={{ duration: 1.2, repeat: Infinity }}
                />
                Executing pipeline...
              </motion.div>
            </div>
          )}
        </motion.div>
      </div>

      {executionResult && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="space-y-3 rounded-lg border border-slate-800 bg-slate-900 p-4"
        >
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-200">
            <span className="rounded bg-slate-800 px-2 py-1">Rows: {executionResult.rows_before} → {executionResult.rows_after}</span>
            <span className="rounded bg-slate-800 px-2 py-1">Execution: {executionResult.execution_time_ms}ms</span>
            <button
              onClick={downloadResultCsv}
              className="rounded bg-indigo-600 px-3 py-1 text-white"
            >
              Download cleaned CSV
            </button>
            <button
              onClick={saveAsNewDataset}
              className="rounded bg-emerald-600 px-3 py-1 text-white"
            >
              Save as new dataset
            </button>
          </div>

          <div className="max-h-72 overflow-auto rounded border border-slate-800">
            {executionResult.preview.length === 0 ? (
              <div className="p-3 text-sm text-slate-400">No result rows</div>
            ) : (
              <table className="min-w-full text-xs">
                <thead className="bg-slate-800 text-slate-300">
                  <tr>
                    {executionResult.columns.map((col) => (
                      <th key={col} className="px-3 py-2 text-left">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {executionResult.preview.map((row, idx) => (
                    <tr key={idx} className="border-t border-slate-800">
                      {executionResult.columns.map((col) => (
                        <td key={`${idx}-${col}`} className="px-3 py-2 text-slate-200">
                          {String(row[col] ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}

function defaultConfig(type: NodeKind): Record<string, unknown> {
  if (type === 'filter') return { column: '', condition: 'equals', value: '' };
  if (type === 'transform') return { operation: 'rename_column', column: '', new_name: '' };
  if (type === 'aggregate') return { group_by: '', aggregations: {} };
  return { operation: type };
}

function makeTemplateNode(
  nodeType: NodeKind,
  position: { x: number; y: number },
  configOverride: Record<string, unknown> = {}
): Node {
  const meta = NODE_META[nodeType];
  return {
    id: `${nodeType}_template_${Math.random().toString(36).slice(2, 9)}`,
    type: nodeType,
    position,
    data: {
      label: meta.label,
      nodeType,
      color: meta.color,
      config: { ...defaultConfig(nodeType), ...configOverride },
      outputPreview: [],
      rowCount: 0,
      colCount: 0,
      columns: [],
    },
  };
}
