import json
import math
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import duckdb
from fastapi import APIRouter, HTTPException

from app.config import UPLOAD_DIR

router = APIRouter()


def _load_dataframe(file_id: str) -> tuple[pd.DataFrame, str]:
    dest_dir = Path(UPLOAD_DIR) / file_id
    if not dest_dir.exists():
        raise HTTPException(status_code=404, detail="File not found")

    files = list(dest_dir.iterdir())
    if not files:
        raise HTTPException(status_code=404, detail="File not found")

    path = files[0]
    ext = path.suffix.lstrip(".").lower()

    if ext == "csv":
        df = pd.read_csv(path)
    elif ext in ("xlsx", "xls"):
        df = pd.read_excel(path)
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}")

    return df, path.name


def _safe_value(val: Any) -> Any:
    if isinstance(val, float) and (math.isnan(val) or math.isinf(val)):
        return None
    if isinstance(val, (np.integer,)):
        return int(val)
    if isinstance(val, (np.floating,)):
        v = float(val)
        return None if (math.isnan(v) or math.isinf(v)) else v
    if isinstance(val, (np.bool_,)):
        return bool(val)
    return val


def _serialize(obj: Any) -> Any:
    if isinstance(obj, dict):
        return {k: _serialize(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_serialize(v) for v in obj]
    return _safe_value(obj)


def _compute_health_score(df: pd.DataFrame) -> float:
    total_cells = df.shape[0] * df.shape[1]
    if total_cells == 0:
        return 0.0
    null_ratio = df.isnull().sum().sum() / total_cells
    dup_ratio = df.duplicated().sum() / max(len(df), 1)
    score = max(0.0, 1.0 - null_ratio * 0.7 - dup_ratio * 0.3)
    return round(score * 100, 1)


@router.get("/profile/{file_id}")
async def profile_file(file_id: str):
    df, filename = _load_dataframe(file_id)

    row_count = len(df)
    col_count = len(df.columns)
    duplicate_rows = int(df.duplicated().sum())
    health_score = _compute_health_score(df)

    columns: list[dict] = []
    for col in df.columns:
        series = df[col]
        dtype_str = str(series.dtype)
        null_count = int(series.isnull().sum())
        null_pct = round(null_count / row_count * 100, 1) if row_count else 0.0
        unique_count = int(series.nunique())

        col_info: dict[str, Any] = {
            "name": col,
            "dtype": dtype_str,
            "null_count": null_count,
            "null_pct": null_pct,
            "unique_count": unique_count,
        }

        if pd.api.types.is_numeric_dtype(series):
            desc = series.describe()
            col_info["stats"] = {
                "mean": _safe_value(desc.get("mean")),
                "std": _safe_value(desc.get("std")),
                "min": _safe_value(desc.get("min")),
                "max": _safe_value(desc.get("max")),
                "q25": _safe_value(desc.get("25%")),
                "q50": _safe_value(desc.get("50%")),
                "q75": _safe_value(desc.get("75%")),
            }
            # IQR-based outlier detection
            q1 = series.quantile(0.25)
            q3 = series.quantile(0.75)
            iqr = q3 - q1
            outliers = series[(series < q1 - 1.5 * iqr) | (series > q3 + 1.5 * iqr)]
            col_info["outlier_count"] = int(len(outliers))
        elif pd.api.types.is_string_dtype(series) or pd.api.types.is_object_dtype(series):
            top_vals = series.value_counts().head(5)
            col_info["top_values"] = [
                {"value": str(k), "count": int(v)}
                for k, v in top_vals.items()
            ]

        columns.append(col_info)

    # Sample data (first 5 rows)
    sample_rows = df.head(5).replace({np.nan: None})
    sample_data = json.loads(sample_rows.to_json(orient="records"))

    # DuckDB quick query for extra stats
    try:
        con = duckdb.connect()
        con.register("df", df)
        numeric_cols = [c["name"] for c in columns if "stats" in c]
        duckdb_stats: dict = {}
        for nc in numeric_cols[:3]:  # limit to first 3 numeric for speed
            res = con.execute(
                f'SELECT corr("{nc}", "{numeric_cols[0]}") as corr FROM df'
            ).fetchone()
            if res:
                duckdb_stats[nc] = {"corr_with_first": _safe_value(res[0])}
        con.close()
    except Exception:
        duckdb_stats = {}

    result = {
        "file_id": file_id,
        "filename": filename,
        "row_count": row_count,
        "col_count": col_count,
        "duplicate_rows": duplicate_rows,
        "health_score": health_score,
        "columns": columns,
        "sample_data": sample_data,
        "duckdb_stats": duckdb_stats,
    }

    return _serialize(result)
