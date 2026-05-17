// ============================================================================
// GLOBAL CONTEXT TYPES
// ============================================================================

export interface Notification {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  timestamp: number;
}

export interface UploadedFile {
  file_id: string;
  filename: string;
  size_bytes: number;
  created_at: string;
}

export interface GlobalContextType {
  fileId: string | null;
  filename: string | null;
  fileMetadata: Record<string, unknown> | null;
  uploadedFiles: UploadedFile[];
  activeTab: string;
  notifications: Notification[];
  setFileId: (fileId: string | null) => void;
  setFilename: (filename: string | null) => void;
  setFileMetadata: (metadata: Record<string, unknown> | null) => void;
  setUploadedFiles: (files: UploadedFile[]) => void;
  setActiveTab: (tab: string) => void;
  addNotification: (message: string, type: Notification['type']) => void;
  removeNotification: (id: string) => void;
}

// ============================================================================
// PHASE 1: UPLOAD & PROFILE TYPES
// ============================================================================

export interface UploadResponse {
  file_id: string;
  filename: string;
  extension: string;
  size_bytes: number;
  message: string;
}

export interface ColumnStat {
  mean?: number | null;
  std?: number | null;
  min?: number | null;
  max?: number | null;
  q25?: number | null;
  q50?: number | null;
  q75?: number | null;
}

export interface TopValue {
  value: string;
  count: number;
}

export interface ColumnInfo {
  name: string;
  dtype: string;
  null_count: number;
  null_pct: number;
  unique_count: number;
  stats?: ColumnStat;
  outlier_count?: number;
  top_values?: TopValue[];
}

export interface ProfileResponse {
  file_id: string;
  filename: string;
  row_count: number;
  col_count: number;
  duplicate_rows: number;
  health_score: number;
  columns: ColumnInfo[];
  sample_data: Record<string, unknown>[];
  duckdb_stats: Record<string, { corr_with_first?: number | null }>;
}

export interface ChartDataPoint {
  label?: string;
  name?: string;
  value: number;
  index?: number;
}

export interface Chart {
  id: string;
  type: 'bar' | 'pie' | 'line';
  title: string;
  data: ChartDataPoint[];
  x_key?: string;
  y_key?: string;
}

export interface DashboardResponse {
  file_id: string;
  row_count: number;
  col_count: number;
  charts: Chart[];
  summary: Record<string, {
    mean: number | null;
    min: number | null;
    max: number | null;
    std: number | null;
  }>;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// ============================================================================
// PHASE 2: PIPELINE TYPES
// ============================================================================

export type PipelineNodeType = 
  | 'source' 
  | 'filter' 
  | 'transform' 
  | 'aggregate' 
  | 'join' 
  | 'ai_transform' 
  | 'output';

export interface PipelineNodeConfig {
  operation: string;
  parameters: Record<string, unknown>;
  description?: string;
}

export interface PipelineNode {
  id: string;
  type: PipelineNodeType;
  label: string;
  config: PipelineNodeConfig;
  position?: { x: number; y: number };
  data?: Record<string, unknown>;
}

export interface PipelineEdge {
  id: string;
  source: string;
  target: string;
  data?: Record<string, unknown>;
}

export interface Pipeline {
  id: string;
  name: string;
  description: string;
  file_id: string;
  nodes: PipelineNode[];
  edges: PipelineEdge[];
  created_at: string;
  updated_at: string;
  status: 'draft' | 'saved' | 'published';
}

export interface PipelineExecutionResult {
  execution_id: string;
  pipeline_id?: string;
  success?: boolean;
  status: 'running' | 'completed' | 'failed';
  rows_before?: number;
  rows_after?: number;
  preview?: Record<string, unknown>[];
  columns?: string[];
  cleaned_file_id?: string;
  cleaned_filename?: string;
  download_url?: string;
  output_data?: Record<string, unknown>[];
  row_count?: number;
  execution_time_ms: number;
  error?: string;
  node_results: Record<string, {
    status: 'pending' | 'running' | 'completed' | 'failed';
    output_rows?: number;
    error?: string;
  }>;
}

export interface PipelinePreviewRequest {
  nodes: PipelineNode[];
  edges: PipelineEdge[];
  file_id: string;
  sample_size?: number;
}

export interface PipelinePreviewResponse {
  preview_data: Record<string, unknown>[];
  row_count: number;
  execution_time_ms: number;
  nodes_executed: string[];
}

// ============================================================================
// PHASE 2: AGENT TYPES
// ============================================================================

export interface CleanerSuggestion {
  id: string;
  column: string;
  issue_type: 'missing_values' | 'duplicates' | 'outliers' | 'inconsistent_format';
  description: string;
  severity: 'low' | 'medium' | 'high';
  suggested_action: string;
  affected_rows: number;
  confidence: number;
}

export interface CleanerAnalysisResponse {
  analysis_id: string;
  file_id: string;
  suggestions: CleanerSuggestion[];
  overall_health_score: number;
  recommended_actions: string[];
}

export interface CleanerApplyRequest {
  file_id: string;
  suggestion_id: string;
  action: string;
}

export interface CleanerApplyResponse {
  success: boolean;
  before_rows: number;
  after_rows: number;
  cleaned_file_id: string;
}

export interface Insight {
  id: string;
  title: string;
  description: string;
  insight_type: 'trend' | 'anomaly' | 'correlation' | 'distribution' | 'recommendation';
  confidence: number;
  chart_data?: {
    type: 'bar' | 'line' | 'scatter';
    data: Array<Record<string, unknown>>;
    x?: string;
    y?: string;
  };
}

export interface AnalystInsightsResponse {
  analysis_id: string;
  file_id: string;
  insights: Insight[];
  key_findings: string[];
  next_questions: string[];
}

export interface ReporterGenerateRequest {
  file_id: string;
  title?: string;
  include_charts?: boolean;
}

export interface ReporterGenerateResponse {
  report_id: string;
  html_url: string;
  generated_at: string;
  title: string;
}

export interface PredictorColumnsResponse {
  file_id: string;
  columns: string[];
}

export interface PredictorTrainRequest {
  file_id: string;
  target_column: string;
  model_type: 'linear_regression' | 'random_forest';
  features?: string[];
  test_size?: number;
  random_state?: number;
}

export interface PredictorTrainResponse {
  model_id: string;
  model_type: string;
  accuracy: number;
  r2_score: number;
  rmse: number;
  feature_importance: Record<string, number>;
  columns_used: string[];
  training_samples: number;
  message: string;
}

export interface PredictorPredictRequest {
  model_id: string;
  input_values: Record<string, unknown>;
}

export interface PredictorPredictResponse {
  model_id: string;
  prediction: number;
  confidence_interval: [number, number];
}

// ============================================================================
// PHASE 2: COLLABORATION TYPES
// ============================================================================

export interface Comment {
  id: string;
  author: string;
  content: string;
  created_at: string;
  updated_at?: string;
  resolved: boolean;
  replies?: Comment[];
}

export interface Activity {
  id: string;
  user: string;
  action: 'view' | 'edit' | 'comment' | 'share' | 'execute';
  resource_type: 'pipeline' | 'dataset' | 'report';
  resource_id: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

export interface SharedDataset {
  id: string;
  dataset_id: string;
  shared_by: string;
  shared_with: string[];
  permission: 'view' | 'edit' | 'admin';
  shared_at: string;
  expires_at?: string;
}

export interface CollaborationState {
  pipeline_id?: string;
  active_users: string[];
  comments: Comment[];
  activities: Activity[];
  cursor_positions: Record<string, { x: number; y: number }>;
}
