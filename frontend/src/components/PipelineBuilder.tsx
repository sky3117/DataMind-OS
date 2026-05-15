'use client';

import React, { useState, useCallback } from 'react';
import { Plus, Play, Save, Download, Copy } from 'lucide-react';

interface PipelineNode {
  id: string;
  type: string;
  label: string;
  position?: { x: number; y: number };
}

interface PipelineBuilderProps {
  fileId?: string;
  onPipelineChange?: (nodes: PipelineNode[], edges: any[]) => void;
}

export default function PipelineBuilder({
  fileId,
  onPipelineChange,
}: PipelineBuilderProps) {
  const [nodes, setNodes] = useState<PipelineNode[]>([]);
  const [edges, setEdges] = useState<any[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);

  const addNode = useCallback(
    (type: string) => {
      const newNode: PipelineNode = {
        id: `node_${Date.now()}`,
        type,
        label: `${type.charAt(0).toUpperCase() + type.slice(1)} Node`,
        position: { x: Math.random() * 400, y: Math.random() * 300 },
      };
      setNodes([...nodes, newNode]);
    },
    [nodes]
  );

  const removeNode = useCallback(
    (nodeId: string) => {
      setNodes(nodes.filter((n) => n.id !== nodeId));
      setEdges(edges.filter((e) => e.source !== nodeId && e.target !== nodeId));
    },
    [nodes, edges]
  );

  const executePipeline = async () => {
    if (!fileId || nodes.length === 0) {
      alert('Please upload a file and add nodes');
      return;
    }

    setIsExecuting(true);
    try {
      const { executePipeline } = await import('@/lib/api');
      const result = await executePipeline(nodes as any, edges, fileId);
      console.log('Pipeline executed:', result);
      alert('Pipeline executed successfully!');
    } catch (error) {
      console.error('Pipeline execution failed:', error);
      alert('Pipeline execution failed');
    } finally {
      setIsExecuting(false);
    }
  };

  const savePipeline = async () => {
    if (!fileId || nodes.length === 0) {
      alert('Please configure the pipeline first');
      return;
    }

    const name = prompt('Enter pipeline name:', 'My Pipeline');
    if (!name) return;

    try {
      const { savePipeline } = await import('@/lib/api');
      const result = await savePipeline(
        name,
        'Pipeline created through builder',
        fileId,
        nodes as any,
        edges
      );
      alert(`Pipeline saved: ${result.id}`);
    } catch (error) {
      console.error('Save failed:', error);
      alert('Failed to save pipeline');
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow">
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-lg font-semibold">Pipeline Builder</h2>
        <div className="flex gap-2">
          <button
            onClick={() => addNode('filter')}
            className="flex items-center gap-2 px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            <Plus size={16} />
            Add Filter
          </button>
          <button
            onClick={() => addNode('transform')}
            className="flex items-center gap-2 px-3 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            <Plus size={16} />
            Add Transform
          </button>
        </div>
      </div>

      <div className="flex-1 p-4 overflow-y-auto">
        <div className="space-y-2">
          {nodes.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              Add nodes to start building your pipeline
            </p>
          ) : (
            nodes.map((node) => (
              <div
                key={node.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded border"
              >
                <div>
                  <p className="font-medium">{node.label}</p>
                  <p className="text-xs text-gray-500">{node.type}</p>
                </div>
                <button
                  onClick={() => removeNode(node.id)}
                  className="text-red-500 hover:text-red-700"
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="flex gap-2 p-4 border-t bg-gray-50">
        <button
          onClick={executePipeline}
          disabled={isExecuting}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
        >
          <Play size={16} />
          {isExecuting ? 'Executing...' : 'Execute'}
        </button>
        <button
          onClick={savePipeline}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          <Save size={16} />
          Save
        </button>
      </div>
    </div>
  );
}
