const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function uploadFile(file: File): Promise<import('@/types').UploadResponse> {
  const form = new FormData();
  form.append('file', file);

  const res = await fetch(`${API_BASE}/api/upload`, {
    method: 'POST',
    body: form,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Upload failed');
  }

  return res.json();
}

export async function listFiles(): Promise<{ files: import('@/types').UploadedFile[] }> {
  const res = await fetch(`${API_BASE}/api/files`);

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'List files failed');
  }

  return res.json();
}

export async function getProfile(fileId: string): Promise<import('@/types').ProfileResponse> {
  const res = await fetch(`${API_BASE}/api/profile/${fileId}`);

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Profile fetch failed');
  }

  return res.json();
}

export async function getDashboard(fileId: string): Promise<import('@/types').DashboardResponse> {
  const res = await fetch(`${API_BASE}/api/dashboard/${fileId}`);

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Dashboard fetch failed');
  }

  return res.json();
}

export async function* streamChat(
  fileId: string,
  question: string
): AsyncGenerator<string, void, unknown> {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_id: fileId, question }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Chat request failed');
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const raw = line.slice(6).trim();
        if (!raw) continue;
        try {
          const parsed = JSON.parse(raw) as {
            content?: string;
            done?: boolean;
            error?: string;
          };
          if (parsed.error) throw new Error(parsed.error);
          if (parsed.done) return;
          if (parsed.content) yield parsed.content;
        } catch (e) {
          if (e instanceof Error && e.message !== raw) throw e;
        }
      }
    }
  }
}

// ============================================================================
// PHASE 2: PIPELINE API FUNCTIONS
// ============================================================================

export async function executePipeline(
  nodes: import('@/types').PipelineNode[],
  edges: import('@/types').PipelineEdge[],
  fileId: string
): Promise<import('@/types').PipelineExecutionResult> {
  const res = await fetch(`${API_BASE}/api/pipeline/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nodes, edges, file_id: fileId }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Pipeline execution failed');
  }

  return res.json();
}

export async function previewPipeline(
  nodes: import('@/types').PipelineNode[],
  edges: import('@/types').PipelineEdge[],
  fileId: string,
  sampleSize: number = 100
): Promise<import('@/types').PipelinePreviewResponse> {
  const res = await fetch(`${API_BASE}/api/pipeline/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nodes, edges, file_id: fileId, sample_size: sampleSize }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Pipeline preview failed');
  }

  return res.json();
}

export async function savePipeline(
  name: string,
  description: string,
  fileId: string,
  nodes: import('@/types').PipelineNode[],
  edges: import('@/types').PipelineEdge[]
): Promise<{ id: string; name: string; message: string; created_at: string }> {
  const res = await fetch(`${API_BASE}/api/pipeline/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description, file_id: fileId, nodes, edges }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Pipeline save failed');
  }

  return res.json();
}

export async function listSavedPipelines(
  fileId?: string
): Promise<{ pipelines: import('@/types').Pipeline[]; total: number }> {
  const params = fileId ? `?file_id=${fileId}` : '';
  const res = await fetch(`${API_BASE}/api/pipeline/saved${params}`);

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'List pipelines failed');
  }

  return res.json();
}

// ============================================================================
// PHASE 2: CLEANER AGENT API FUNCTIONS
// ============================================================================

export async function analyzeCleanerSuggestions(
  fileId: string
): Promise<import('@/types').CleanerAnalysisResponse> {
  const res = await fetch(`${API_BASE}/api/agents/cleaner/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_id: fileId }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Cleaner analysis failed');
  }

  return res.json();
}

export async function applyCleanerSuggestions(
  fileId: string,
  suggestions: string[],
  autoFix: boolean = false
): Promise<import('@/types').CleanerApplyResponse> {
  const res = await fetch(`${API_BASE}/api/agents/cleaner/apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_id: fileId, suggestions, auto_fix: autoFix }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Cleaner apply failed');
  }

  return res.json();
}

// ============================================================================
// PHASE 2: ANALYST AGENT API FUNCTIONS
// ============================================================================

export async function generateAnalystInsights(
  fileId: string
): Promise<import('@/types').AnalystInsightsResponse> {
  const res = await fetch(`${API_BASE}/api/agents/analyst/insights`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_id: fileId }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Analyst insights failed');
  }

  return res.json();
}

// ============================================================================
// PHASE 2: REPORTER AGENT API FUNCTIONS
// ============================================================================

export async function generateReport(
  fileId: string,
  title: string,
  sections: string[],
  pipelineId?: string,
  includeCharts: boolean = true
): Promise<import('@/types').ReporterGenerateResponse> {
  const res = await fetch(`${API_BASE}/api/agents/reporter/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      file_id: fileId,
      pipeline_id: pipelineId,
      title,
      sections,
      include_charts: includeCharts,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Report generation failed');
  }

  return res.json();
}

// ============================================================================
// PHASE 2: PREDICTOR AGENT API FUNCTIONS
// ============================================================================

export async function trainPredictorModel(
  fileId: string,
  targetColumn: string,
  features: string[],
  modelType: string = 'classification',
  testSize: number = 0.2,
  randomState: number = 42
): Promise<import('@/types').PredictorTrainResponse> {
  const res = await fetch(`${API_BASE}/api/agents/predictor/train`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      file_id: fileId,
      target_column: targetColumn,
      features,
      model_type: modelType,
      test_size: testSize,
      random_state: randomState,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Model training failed');
  }

  return res.json();
}

export async function makePrediction(
  modelId: string,
  inputData: Record<string, unknown>[]
): Promise<import('@/types').PredictorPredictResponse> {
  const res = await fetch(`${API_BASE}/api/agents/predictor/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model_id: modelId, input_data: inputData }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Prediction failed');
  }

  return res.json();
}

// ============================================================================
// PHASE 2: COLLABORATION API FUNCTIONS
// ============================================================================

export async function addComment(
  resourceType: string,
  resourceId: string,
  author: string,
  content: string
): Promise<{ id: string; resource_type: string; resource_id: string; message: string }> {
  const res = await fetch(`${API_BASE}/api/collaboration/comment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resource_type: resourceType, resource_id: resourceId, author, content }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Comment failed');
  }

  return res.json();
}

export async function getComments(
  resourceType: string,
  resourceId: string
): Promise<import('@/types').CollaborationState> {
  const res = await fetch(`${API_BASE}/api/collaboration/comments/${resourceType}/${resourceId}`);

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Fetch comments failed');
  }

  return res.json();
}

export async function shareResource(
  resourceType: string,
  resourceId: string,
  sharedBy: string,
  sharedWith: string[],
  permission: string = 'view'
): Promise<{ id: string; message: string; shared_at: string }> {
  const res = await fetch(`${API_BASE}/api/collaboration/share`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      resource_type: resourceType,
      resource_id: resourceId,
      shared_by: sharedBy,
      shared_with: sharedWith,
      permission,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Share failed');
  }

  return res.json();
}

export async function logActivity(
  user: string,
  action: string,
  resourceType: string,
  resourceId: string,
  details?: Record<string, unknown>
): Promise<{ id: string; message: string }> {
  const res = await fetch(`${API_BASE}/api/collaboration/activity`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      details,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Log activity failed');
  }

  return res.json();
}

export async function getActivities(
  resourceType?: string,
  resourceId?: string,
  limit: number = 50
): Promise<{ activities: import('@/types').Activity[]; total: number }> {
  const params = new URLSearchParams();
  if (resourceType) params.append('resource_type', resourceType);
  if (resourceId) params.append('resource_id', resourceId);
  params.append('limit', limit.toString());

  const res = await fetch(`${API_BASE}/api/collaboration/activities?${params}`);

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Fetch activities failed');
  }

  return res.json();
}

export function createCollaborationWebSocket(pipelineId: string): WebSocket {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsBase = process.env.NEXT_PUBLIC_WS_URL || `${protocol}//${window.location.host}`;
  return new WebSocket(`${wsBase}/api/ws/collaboration/${pipelineId}`);
}

