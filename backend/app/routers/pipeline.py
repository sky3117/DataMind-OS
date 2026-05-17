import logging
import re
import time
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

import pandas as pd
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

from app.config import UPLOAD_DIR
from app.services.pipeline_executor import PipelineExecutor

logger = logging.getLogger(__name__)
router = APIRouter()

_SAFE_ID_PATTERN = re.compile(r"^[A-Za-z0-9._-]+$")


class PipelineNodeConfig(BaseModel):
    operation: str
    parameters: Dict[str, Any]
    description: Optional[str] = None


class PipelineNode(BaseModel):
    id: str
    type: str
    label: str
    config: PipelineNodeConfig
    position: Optional[Dict[str, float]] = None
    data: Optional[Dict[str, Any]] = None


class PipelineEdge(BaseModel):
    id: str
    source: str
    target: str
    data: Optional[Dict[str, Any]] = None


class PipelineExecuteRequest(BaseModel):
    nodes: List[PipelineNode]
    edges: List[PipelineEdge]
    file_id: str


class PipelinePreviewRequest(BaseModel):
    nodes: List[PipelineNode]
    edges: List[PipelineEdge]
    file_id: str
    sample_size: int = 100


class PipelineSaveRequest(BaseModel):
    name: str
    description: str
    file_id: str
    nodes: List[PipelineNode]
    edges: List[PipelineEdge]


_pipelines: Dict[str, Dict[str, Any]] = {}
_pipeline_counter = 0


def _resolve_file(file_id: str) -> Path:
    if not _SAFE_ID_PATTERN.fullmatch(file_id):
        raise HTTPException(status_code=400, detail="Invalid file ID")

    upload_root = Path(UPLOAD_DIR).resolve()
    if not upload_root.exists() or not upload_root.is_dir():
        raise HTTPException(status_code=404, detail="Upload directory not found")

    matching_dirs = [p for p in upload_root.iterdir() if p.is_dir() and p.name == file_id]
    if not matching_dirs:
        raise HTTPException(status_code=404, detail="File not found")
    file_dir = matching_dirs[0]

    try:
        file_dir.resolve().relative_to(upload_root)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid file ID")

    files = [p for p in file_dir.iterdir() if p.is_file()]
    if not files:
        raise HTTPException(status_code=404, detail="No files found")

    return files[0]


def _load_dataframe(file_id: str) -> pd.DataFrame:
    file_path = _resolve_file(file_id)
    ext = file_path.suffix.lower()

    try:
        if ext == ".csv":
            return pd.read_csv(file_path)
        if ext in {".xlsx", ".xls"}:
            return pd.read_excel(file_path)
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}")
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Error loading file: {exc}")
        raise HTTPException(status_code=500, detail="Error loading file")


def _save_result_csv(df: pd.DataFrame) -> str:
    result_file_id = str(uuid.uuid4())
    result_dir = Path(UPLOAD_DIR) / result_file_id
    result_dir.mkdir(parents=True, exist_ok=False)
    output_path = result_dir / "data.csv"
    df.to_csv(output_path, index=False)
    return result_file_id


@router.post("/pipeline/execute")
async def execute_pipeline(request: PipelineExecuteRequest):
    """Execute pipeline and persist output CSV for download/reuse."""
    try:
        start_time = time.time()

        df = _load_dataframe(request.file_id)

        executor = PipelineExecutor()
        nodes = [node.model_dump() for node in request.nodes]
        edges = [edge.model_dump() for edge in request.edges]

        result = await executor.execute_pipeline(nodes, edges, df)
        if not result.get("success"):
            raise HTTPException(status_code=400, detail=result.get("error", "Pipeline execution failed"))

        if executor.last_output_df is None:
            raise HTTPException(status_code=500, detail="Pipeline produced no output")

        cleaned_file_id = _save_result_csv(executor.last_output_df)
        execution_time_ms = int((time.time() - start_time) * 1000)

        return {
            **result,
            "execution_id": f"exec_{int(time.time() * 1000)}",
            "execution_time_ms": execution_time_ms,
            "cleaned_file_id": cleaned_file_id,
            "cleaned_filename": "data.csv",
            "download_url": f"/api/pipeline/download/{cleaned_file_id}",
            "source_file_id": request.file_id,
        }

    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Pipeline execution error: {exc}")
        raise HTTPException(status_code=500, detail="Pipeline execution failed")


@router.get("/pipeline/download/{file_id}")
async def download_pipeline_result(file_id: str):
    """Download generated pipeline result CSV by file id."""
    file_path = _resolve_file(file_id)
    return FileResponse(
        path=file_path,
        media_type="text/csv",
        filename=file_path.name,
    )


@router.post("/pipeline/preview")
async def preview_pipeline(request: PipelinePreviewRequest):
    """Preview pipeline execution with sample data."""
    try:
        start_time = time.time()

        df = _load_dataframe(request.file_id)
        sample_df = df.head(request.sample_size)

        executor = PipelineExecutor()
        nodes = [node.model_dump() for node in request.nodes]
        edges = [edge.model_dump() for edge in request.edges]

        result = await executor.execute_pipeline(nodes, edges, sample_df)
        if not result.get("success"):
            raise HTTPException(status_code=400, detail=result.get("error", "Pipeline preview failed"))

        execution_time_ms = int((time.time() - start_time) * 1000)

        return {
            "preview_data": result.get("preview", []),
            "row_count": result.get("row_count", 0),
            "execution_time_ms": execution_time_ms,
            "nodes_executed": list(result.get("node_results", {}).keys()),
        }

    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Pipeline preview error: {exc}")
        raise HTTPException(status_code=500, detail="Pipeline preview failed")


@router.get("/pipeline/saved")
async def list_saved_pipelines(file_id: Optional[str] = None):
    """List saved pipelines, optionally filtered by file_id."""
    try:
        if file_id:
            pipelines = [p for p in _pipelines.values() if p["file_id"] == file_id]
        else:
            pipelines = list(_pipelines.values())

        return {
            "pipelines": pipelines,
            "total": len(pipelines),
        }
    except Exception as exc:
        logger.error(f"Error listing pipelines: {exc}")
        raise HTTPException(status_code=500, detail="Failed to list pipelines")


@router.post("/pipeline/save")
async def save_pipeline(request: PipelineSaveRequest):
    """Save pipeline metadata in memory."""
    try:
        global _pipeline_counter
        _pipeline_counter += 1
        pipeline_id = f"pipeline_{_pipeline_counter}"

        pipeline_obj = {
            "id": pipeline_id,
            "name": request.name,
            "description": request.description,
            "file_id": request.file_id,
            "nodes": [node.model_dump() for node in request.nodes],
            "edges": [edge.model_dump() for edge in request.edges],
            "created_at": pd.Timestamp.now().isoformat(),
            "updated_at": pd.Timestamp.now().isoformat(),
            "status": "saved",
        }

        _pipelines[pipeline_id] = pipeline_obj

        return {
            "id": pipeline_id,
            "name": request.name,
            "message": "Pipeline saved successfully",
            "created_at": pipeline_obj["created_at"],
        }

    except Exception as exc:
        logger.error(f"Error saving pipeline: {exc}")
        raise HTTPException(status_code=500, detail="Failed to save pipeline")
