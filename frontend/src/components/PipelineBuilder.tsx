'use client';

import React, { useState, useCallback, useRef } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Panel,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Plus, Play, Save } from 'lucide-react';

const NODE_TYPES = [
  { id: 'source', label: 'Source', color: '#8b5cf6' },
  { id: 'filter', label: 'Filter', color: '#3b82f6' },
  { id: 'transform', label: 'Transform', color: '#10b981' },
  { id: 'aggregate', label: 'Aggregate', color: '#f59e0b' },
  { id: 'join', label: 'Join', color: '#ec4899' },
  { id: 'ai_transform', label: 'AI Transform', color: '#06b6d4' },
  { id: 'output', label: 'Output', color: '#ef4444' },
];

interface PipelineBuilderProps {
  fileId?: string;
  onPipelineChange?: (nodes: Node[], edges: Edge[]) => void;
}

const NodeComponent = ({ data, id, selected }: any) => {
  const backgroundColor = (data.color || '#8b5cf6') + (selected ? 'FF' : 'CC');
  return (
    <div
      className="px-4 py-2 rounded-lg border-2 border-solid text-white font-medium shadow-lg"
      style={{
        backgroundColor,
        borderColor: selected ? '#ffffff' : (data.color || '#8b5cf6'),
      }}
    >
      {data.label}
    </div>
  );
};

export default function PipelineBuilder({
  fileId,
  onPipelineChange,
}: PipelineBuilderProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const nodeCountRef = useRef(0);

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge(connection, eds));
    },
    [setEdges]
  );

  const addNode = useCallback(
    (type: string) => {
      nodeCountRef.current += 1;
      const nodeType = NODE_TYPES.find((t) => t.id === type);
      if (!nodeType) return;

      const newNode: Node = {
        id: `${type}_${nodeCountRef.current}`,
        type: 'default',
        data: {
          label: `${nodeType.label}`,
          nodeType: type,
          color: nodeType.color,
        },
        position: {
          x: Math.random() * 600 + 50,
          y: Math.random() * 400 + 50,
        },
      };
      setNodes((nds) => [...nds, newNode]);
    },
    [setNodes]
  );

  const executePipeline = async () => {
    if (!fileId || nodes.length === 0) {
      alert('Please upload a file and add nodes');
      return;
    }

    setIsExecuting(true);
    try {
      const { executePipeline: executeApi } = await import('@/lib/api');
      const apiNodes = nodes.map((n) => ({
        id: n.id,
        type: (n.data as any).nodeType || 'transform',
        label: (n.data as any).label,
        config: { operation: 'default', parameters: {} },
      }));
      const apiEdges = edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
      }));
      const result = await executeApi(apiNodes, apiEdges, fileId);
      alert('Pipeline executed successfully!');
    } catch (error) {
      console.error('Execution failed:', error);
      alert('Pipeline execution failed');
    } finally {
      setIsExecuting(false);
    }
  };

  const savePipeline = async () => {
    const name = prompt('Enter pipeline name:');
    if (!name) return;

    try {
      const { savePipeline: saveApi } = await import('@/lib/api');
      const apiNodes = nodes.map((n) => ({
        id: n.id,
        type: (n.data as any).nodeType || 'transform',
        label: (n.data as any).label,
        config: { operation: 'default', parameters: {} },
        position: n.position,
      }));
      const apiEdges = edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
      }));
      await saveApi(name, 'Custom Pipeline', fileId || '', apiNodes, apiEdges);
      alert('Pipeline saved successfully!');
    } catch (error) {
      console.error('Save failed:', error);
      alert('Pipeline save failed');
    }
  };

  const nodeTypes = {
    default: NodeComponent,
  };

  return (
    <div className="w-full h-full bg-slate-900 rounded-lg overflow-hidden border border-slate-800">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
      >
        <Background color="#1e293b" gap={16} />
        <Controls />

        <Panel
          position="top-left"
          className="flex flex-col gap-2 bg-slate-800/95 p-3 rounded-lg border border-slate-700 backdrop-blur-sm"
        >
          <div className="text-sm font-semibold text-slate-100 mb-2">
            Add Nodes
          </div>
          <div className="flex flex-col gap-2 max-w-xs">
            {NODE_TYPES.map((nodeType) => (
              <button
                key={nodeType.id}
                onClick={() => addNode(nodeType.id)}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white rounded-lg transition-all hover:scale-105"
                style={{
                  backgroundColor: nodeType.color,
                  opacity: 0.85,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.opacity = '1';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.opacity = '0.85';
                }}
              >
                <Plus size={16} />
                {nodeType.label}
              </button>
            ))}
          </div>
        </Panel>

        <Panel position="top-right" className="flex gap-2">
          <button
            onClick={executePipeline}
            disabled={isExecuting || nodes.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-600 text-white font-medium rounded-lg transition-colors"
          >
            <Play size={16} />
            {isExecuting ? 'Executing...' : 'Execute'}
          </button>
          <button
            onClick={savePipeline}
            disabled={nodes.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-600 text-white font-medium rounded-lg transition-colors"
          >
            <Save size={16} />
            Save
          </button>
        </Panel>

        <Panel
          position="bottom-left"
          className="bg-slate-800/95 p-3 rounded-lg border border-slate-700 text-xs text-slate-300 backdrop-blur-sm"
        >
          <div className="font-semibold mb-2">Pipeline Stats</div>
          <div>Nodes: {nodes.length}</div>
          <div>Connections: {edges.length}</div>
        </Panel>
      </ReactFlow>
    </div>
  );
}
