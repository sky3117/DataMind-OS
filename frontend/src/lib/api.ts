import { API_BASE_URL, WS_BASE_URL } from './config';

const API_BASE = API_BASE_URL;

// Configuration
const DEFAULT_TIMEOUT_MS = 30000; // 30 seconds
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const BACKOFF_MULTIPLIER = 2;
const MAX_ACTIVITIES_LIMIT = 100;

// Utility: Create a timeout promise
function createTimeoutPromise(ms: number): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Request timeout after ${ms}ms`)), ms)
  );
}

// Utility: Exponential backoff delay
function getBackoffDelay(attempt: number): number {
  return RETRY_DELAY_MS * Math.pow(BACKOFF_MULTIPLIER, attempt - 1);
}

// Utility: Check if error is retryable
function isRetryableError(error: Error): boolean {
  const message = error.message.toLowerCase();
  return (
    message.includes('timeout') ||
    message.includes('network') ||
    message.includes('503') ||
    message.includes('429')
  );
}

// Utility: Enhanced fetch with timeout and retry
async function fetchWithTimeoutAndRetry(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
  maxRetries: number = MAX_RETRIES,
  onProgress?: (progress: number) => void
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Create an abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        return response;
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // If not retryable or last attempt, throw
      if (!isRetryableError(lastError) || attempt === maxRetries) {
        throw lastError;
      }

      // Wait before retrying with exponential backoff
      const delay = getBackoffDelay(attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error('Unknown error');
}

export async function uploadFile(
  file: File,
  onProgress?: (progress: number) => void
): Promise<import('@/types').UploadResponse> {
  // Validate file before upload
  if (!file.name) {
    throw new Error('File name is required');
  }

  const maxSizeMB = 50;
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    throw new Error(`File size must be less than ${maxSizeMB}MB. Got ${(file.size / 1024 / 1024).toFixed(2)}MB`);
  }

  if (file.size === 0) {
    throw new Error('File is empty');
  }

  // Create FormData
  const form = new FormData();
  form.append('file', file);

  try {
    const res = await fetchWithTimeoutAndRetry(
      `${API_BASE}/api/upload`,
      {
        method: 'POST',
        body: form,
      },
      DEFAULT_TIMEOUT_MS,
      MAX_RETRIES,
      onProgress
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      const detail = typeof err === 'object' && err !== null && 'detail' in err
        ? String(err.detail)
        : `Upload failed with status ${res.status}`;
      throw new Error(detail);
    }

    return res.json();
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Upload failed: Unknown error');
  }
}

export async function listFiles(): Promise<{ files: import('@/types').UploadedFile[] }> {
  try {
    const res = await fetchWithTimeoutAndRetry(
      `${API_BASE}/api/files`,
      { method: 'GET' },
      DEFAULT_TIMEOUT_MS
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      const detail = typeof err === 'object' && err !== null && 'detail' in err
        ? String(err.detail)
        : `Failed to list files with status ${res.status}`;
      throw new Error(detail);
    }

    return res.json();
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to list files: Unknown error');
  }
}

export async function getProfile(fileId: string): Promise<import('@/types').ProfileResponse> {
  if (!fileId) {
    throw new Error('File ID is required');
  }

  try {
    const res = await fetchWithTimeoutAndRetry(
      `${API_BASE}/api/profile/${encodeURIComponent(fileId)}`,
      { method: 'GET' },
      DEFAULT_TIMEOUT_MS
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      const detail = typeof err === 'object' && err !== null && 'detail' in err
        ? String(err.detail)
        : `Failed to fetch profile with status ${res.status}`;
      throw new Error(detail);
    }

    return res.json();
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to fetch profile: Unknown error');
  }
}

export async function getDashboard(fileId: string): Promise<import('@/types').DashboardResponse> {
  if (!fileId) {
    throw new Error('File ID is required');
  }

  try {
    const res = await fetchWithTimeoutAndRetry(
      `${API_BASE}/api/dashboard/${encodeURIComponent(fileId)}`,
      { method: 'GET' },
      DEFAULT_TIMEOUT_MS
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      const detail = typeof err === 'object' && err !== null && 'detail' in err
        ? String(err.detail)
        : `Failed to fetch dashboard with status ${res.status}`;
      throw new Error(detail);
    }

    return res.json();
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to fetch dashboard: Unknown error');
  }
}

export async function* streamChat(
  fileId: string,
  question: string
): AsyncGenerator<string, void, unknown> {
  if (!fileId) {
    throw new Error('File ID is required');
  }

  if (!question || question.trim().length === 0) {
    throw new Error('Question cannot be empty');
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS * 2); // Double timeout for streaming

    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_id: fileId, question }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        const detail = typeof err === 'object' && err !== null && 'detail' in err
          ? String(err.detail)
          : `Chat request failed with status ${res.status}`;
        throw new Error(detail);
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
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Chat request failed: Unknown error');
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
  if (!fileId) {
    throw new Error('File ID is required');
  }

  try {
    const res = await fetchWithTimeoutAndRetry(
      `${API_BASE}/api/pipeline/execute`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes, edges, file_id: fileId }),
      },
      DEFAULT_TIMEOUT_MS * 2 // Pipeline execution may take longer
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      const detail = typeof err === 'object' && err !== null && 'detail' in err
        ? String(err.detail)
        : `Pipeline execution failed with status ${res.status}`;
      throw new Error(detail);
    }

    return res.json();
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Pipeline execution failed: Unknown error');
  }
}

export async function previewPipeline(
  nodes: import('@/types').PipelineNode[],
  edges: import('@/types').PipelineEdge[],
  fileId: string,
  sampleSize: number = 100
): Promise<import('@/types').PipelinePreviewResponse> {
  if (!fileId) {
    throw new Error('File ID is required');
  }

  try {
    const res = await fetchWithTimeoutAndRetry(
      `${API_BASE}/api/pipeline/preview`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes, edges, file_id: fileId, sample_size: sampleSize }),
      },
      DEFAULT_TIMEOUT_MS
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      const detail = typeof err === 'object' && err !== null && 'detail' in err
        ? String(err.detail)
        : `Pipeline preview failed with status ${res.status}`;
      throw new Error(detail);
    }

    return res.json();
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Pipeline preview failed: Unknown error');
  }
}

export async function savePipeline(
  name: string,
  description: string,
  fileId: string,
  nodes: import('@/types').PipelineNode[],
  edges: import('@/types').PipelineEdge[]
): Promise<{ id: string; name: string; message: string; created_at: string }> {
  if (!fileId || !name) {
    throw new Error('File ID and name are required');
  }

  try {
    const res = await fetchWithTimeoutAndRetry(
      `${API_BASE}/api/pipeline/save`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, file_id: fileId, nodes, edges }),
      },
      DEFAULT_TIMEOUT_MS
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      const detail = typeof err === 'object' && err !== null && 'detail' in err
        ? String(err.detail)
        : `Pipeline save failed with status ${res.status}`;
      throw new Error(detail);
    }

    return res.json();
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Pipeline save failed: Unknown error');
  }
}

export async function listSavedPipelines(
  fileId?: string
): Promise<{ pipelines: import('@/types').Pipeline[]; total: number }> {
  try {
    const params = fileId ? `?file_id=${encodeURIComponent(fileId)}` : '';
    const res = await fetchWithTimeoutAndRetry(
      `${API_BASE}/api/pipeline/saved${params}`,
      { method: 'GET' },
      DEFAULT_TIMEOUT_MS
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      const detail = typeof err === 'object' && err !== null && 'detail' in err
        ? String(err.detail)
        : `List pipelines failed with status ${res.status}`;
      throw new Error(detail);
    }

    return res.json();
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('List pipelines failed: Unknown error');
  }
}

// ============================================================================
// PHASE 2: CLEANER AGENT API FUNCTIONS
// ============================================================================

export async function analyzeCleanerSuggestions(
  fileId: string
): Promise<import('@/types').CleanerAnalysisResponse> {
  if (!fileId) {
    throw new Error('File ID is required');
  }

  try {
    const res = await fetchWithTimeoutAndRetry(
      `${API_BASE}/api/agents/cleaner/analyze`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_id: fileId }),
      },
      DEFAULT_TIMEOUT_MS * 2
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      const detail = typeof err === 'object' && err !== null && 'detail' in err
        ? String(err.detail)
        : `Cleaner analysis failed with status ${res.status}`;
      throw new Error(detail);
    }

    return res.json();
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Cleaner analysis failed: Unknown error');
  }
}

export async function applyCleanerSuggestions(
  fileId: string,
  suggestions: string[],
  autoFix: boolean = false
): Promise<import('@/types').CleanerApplyResponse> {
  if (!fileId) {
    throw new Error('File ID is required');
  }

  try {
    const res = await fetchWithTimeoutAndRetry(
      `${API_BASE}/api/agents/cleaner/apply`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_id: fileId, suggestions, auto_fix: autoFix }),
      },
      DEFAULT_TIMEOUT_MS * 2
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      const detail = typeof err === 'object' && err !== null && 'detail' in err
        ? String(err.detail)
        : `Cleaner apply failed with status ${res.status}`;
      throw new Error(detail);
    }

    return res.json();
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Cleaner apply failed: Unknown error');
  }
}

// ============================================================================
// PHASE 2: ANALYST AGENT API FUNCTIONS
// ============================================================================

export async function generateAnalystInsights(
  fileId: string
): Promise<import('@/types').AnalystInsightsResponse> {
  if (!fileId) {
    throw new Error('File ID is required');
  }

  try {
    const res = await fetchWithTimeoutAndRetry(
      `${API_BASE}/api/agents/analyst/insights`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_id: fileId }),
      },
      DEFAULT_TIMEOUT_MS * 2
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      const detail = typeof err === 'object' && err !== null && 'detail' in err
        ? String(err.detail)
        : `Analyst insights failed with status ${res.status}`;
      throw new Error(detail);
    }

    return res.json();
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Analyst insights failed: Unknown error');
  }
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
  if (!fileId || !title) {
    throw new Error('File ID and title are required');
  }

  try {
    const res = await fetchWithTimeoutAndRetry(
      `${API_BASE}/api/agents/reporter/generate`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_id: fileId,
          pipeline_id: pipelineId,
          title,
          sections,
          include_charts: includeCharts,
        }),
      },
      DEFAULT_TIMEOUT_MS * 3 // Report generation may take longer
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      const detail = typeof err === 'object' && err !== null && 'detail' in err
        ? String(err.detail)
        : `Report generation failed with status ${res.status}`;
      throw new Error(detail);
    }

    return res.json();
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Report generation failed: Unknown error');
  }
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
  if (!fileId || !targetColumn) {
    throw new Error('File ID and target column are required');
  }

  try {
    const res = await fetchWithTimeoutAndRetry(
      `${API_BASE}/api/agents/predictor/train`,
      {
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
      },
      DEFAULT_TIMEOUT_MS * 3
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      const detail = typeof err === 'object' && err !== null && 'detail' in err
        ? String(err.detail)
        : `Model training failed with status ${res.status}`;
      throw new Error(detail);
    }

    return res.json();
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Model training failed: Unknown error');
  }
}

export async function makePrediction(
  modelId: string,
  inputData: Record<string, unknown>[]
): Promise<import('@/types').PredictorPredictResponse> {
  if (!modelId) {
    throw new Error('Model ID is required');
  }

  try {
    const res = await fetchWithTimeoutAndRetry(
      `${API_BASE}/api/agents/predictor/predict`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model_id: modelId, input_data: inputData }),
      },
      DEFAULT_TIMEOUT_MS
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      const detail = typeof err === 'object' && err !== null && 'detail' in err
        ? String(err.detail)
        : `Prediction failed with status ${res.status}`;
      throw new Error(detail);
    }

    return res.json();
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Prediction failed: Unknown error');
  }
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
  if (!resourceType || !resourceId || !author || !content) {
    throw new Error('Resource type, ID, author, and content are required');
  }

  try {
    const res = await fetchWithTimeoutAndRetry(
      `${API_BASE}/api/collaboration/comment`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resource_type: resourceType, resource_id: resourceId, author, content }),
      },
      DEFAULT_TIMEOUT_MS
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      const detail = typeof err === 'object' && err !== null && 'detail' in err
        ? String(err.detail)
        : `Add comment failed with status ${res.status}`;
      throw new Error(detail);
    }

    return res.json();
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Add comment failed: Unknown error');
  }
}

export async function getComments(
  resourceType: string,
  resourceId: string
): Promise<import('@/types').CollaborationState> {
  if (!resourceType || !resourceId) {
    throw new Error('Resource type and ID are required');
  }

  try {
    const res = await fetchWithTimeoutAndRetry(
      `${API_BASE}/api/collaboration/comments/${encodeURIComponent(resourceType)}/${encodeURIComponent(resourceId)}`,
      { method: 'GET' },
      DEFAULT_TIMEOUT_MS
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      const detail = typeof err === 'object' && err !== null && 'detail' in err
        ? String(err.detail)
        : `Fetch comments failed with status ${res.status}`;
      throw new Error(detail);
    }

    return res.json();
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Fetch comments failed: Unknown error');
  }
}

export async function shareResource(
  resourceType: string,
  resourceId: string,
  sharedBy: string,
  sharedWith: string[],
  permission: string = 'view'
): Promise<{ id: string; message: string; shared_at: string }> {
  if (!resourceType || !resourceId || !sharedBy || sharedWith.length === 0) {
    throw new Error('Resource type, ID, shared by, and shared with list are required');
  }

  try {
    const res = await fetchWithTimeoutAndRetry(
      `${API_BASE}/api/collaboration/share`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resource_type: resourceType,
          resource_id: resourceId,
          shared_by: sharedBy,
          shared_with: sharedWith,
          permission,
        }),
      },
      DEFAULT_TIMEOUT_MS
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      const detail = typeof err === 'object' && err !== null && 'detail' in err
        ? String(err.detail)
        : `Share resource failed with status ${res.status}`;
      throw new Error(detail);
    }

    return res.json();
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Share resource failed: Unknown error');
  }
}

export async function logActivity(
  user: string,
  action: string,
  resourceType: string,
  resourceId: string,
  details?: Record<string, unknown>
): Promise<{ id: string; message: string }> {
  if (!user || !action || !resourceType || !resourceId) {
    throw new Error('User, action, resource type, and resource ID are required');
  }

  try {
    const res = await fetchWithTimeoutAndRetry(
      `${API_BASE}/api/collaboration/activity`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user,
          action,
          resource_type: resourceType,
          resource_id: resourceId,
          details,
        }),
      },
      DEFAULT_TIMEOUT_MS
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      const detail = typeof err === 'object' && err !== null && 'detail' in err
        ? String(err.detail)
        : `Log activity failed with status ${res.status}`;
      throw new Error(detail);
    }

    return res.json();
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Log activity failed: Unknown error');
  }
}

export async function getActivities(
  resourceType?: string,
  resourceId?: string,
  limit: number = 50
): Promise<{ activities: import('@/types').Activity[]; total: number }> {
  try {
    const params = new URLSearchParams();
    if (resourceType) params.append('resource_type', resourceType);
    if (resourceId) params.append('resource_id', resourceId);
    params.append('limit', Math.min(limit, MAX_ACTIVITIES_LIMIT).toString());

    const res = await fetchWithTimeoutAndRetry(
      `${API_BASE}/api/collaboration/activities?${params}`,
      { method: 'GET' },
      DEFAULT_TIMEOUT_MS
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      const detail = typeof err === 'object' && err !== null && 'detail' in err
        ? String(err.detail)
        : `Fetch activities failed with status ${res.status}`;
      throw new Error(detail);
    }

    return res.json();
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Fetch activities failed: Unknown error');
  }
}

export function createCollaborationWebSocket(pipelineId: string): WebSocket {
  if (!pipelineId) {
    throw new Error('Pipeline ID is required');
  }

  return new WebSocket(`${WS_BASE_URL}/api/ws/collaboration/${encodeURIComponent(pipelineId)}`);
}

