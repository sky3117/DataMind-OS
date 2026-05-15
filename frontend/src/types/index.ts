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
