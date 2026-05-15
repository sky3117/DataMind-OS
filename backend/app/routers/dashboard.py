import math
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from fastapi import APIRouter, HTTPException

from app.config import UPLOAD_DIR

router = APIRouter()


def _load_dataframe(file_id: str) -> pd.DataFrame:
    dest_dir = Path(UPLOAD_DIR) / file_id
    if not dest_dir.exists():
        raise HTTPException(status_code=404, detail="File not found")
    files = list(dest_dir.iterdir())
    if not files:
        raise HTTPException(status_code=404, detail="File not found")
    path = files[0]
    ext = path.suffix.lstrip(".").lower()
    if ext == "csv":
        return pd.read_csv(path)
    elif ext in ("xlsx", "xls"):
        return pd.read_excel(path)
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}")


def _safe(val: Any) -> Any:
    if isinstance(val, float) and (math.isnan(val) or math.isinf(val)):
        return None
    if isinstance(val, (np.integer,)):
        return int(val)
    if isinstance(val, (np.floating,)):
        v = float(val)
        return None if (math.isnan(v) or math.isinf(v)) else v
    return val


@router.get("/dashboard/{file_id}")
async def get_dashboard(file_id: str):
    df = _load_dataframe(file_id)
    charts: list[dict] = []

    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    categorical_cols = df.select_dtypes(include=["object", "category"]).columns.tolist()

    # Bar chart: distribution of first numeric column
    for nc in numeric_cols[:2]:
        hist_counts, bin_edges = np.histogram(df[nc].dropna(), bins=10)
        bar_data = [
            {
                "label": f"{_safe(bin_edges[i]):.1f}–{_safe(bin_edges[i+1]):.1f}",
                "value": int(hist_counts[i]),
            }
            for i in range(len(hist_counts))
        ]
        charts.append({
            "id": f"bar_{nc}",
            "type": "bar",
            "title": f"Distribution of {nc}",
            "data": bar_data,
            "x_key": "label",
            "y_key": "value",
        })

    # Pie chart: top categories for first categorical column
    for cc in categorical_cols[:2]:
        top = df[cc].value_counts().head(8)
        pie_data = [
            {"name": str(k), "value": int(v)}
            for k, v in top.items()
        ]
        charts.append({
            "id": f"pie_{cc}",
            "type": "pie",
            "title": f"Top values in {cc}",
            "data": pie_data,
        })

    # Line chart: numeric column over index (first numeric)
    if numeric_cols:
        nc = numeric_cols[0]
        sample = df[nc].dropna().head(50)
        line_data = [
            {"index": int(i), "value": _safe(v)}
            for i, v in enumerate(sample)
        ]
        charts.append({
            "id": f"line_{nc}",
            "type": "line",
            "title": f"Trend of {nc}",
            "data": line_data,
            "x_key": "index",
            "y_key": "value",
        })

    # Summary stats card data
    summary = {}
    for nc in numeric_cols[:4]:
        desc = df[nc].describe()
        summary[nc] = {
            "mean": _safe(desc.get("mean")),
            "min": _safe(desc.get("min")),
            "max": _safe(desc.get("max")),
            "std": _safe(desc.get("std")),
        }

    return {
        "file_id": file_id,
        "row_count": len(df),
        "col_count": len(df.columns),
        "charts": charts,
        "summary": summary,
    }
