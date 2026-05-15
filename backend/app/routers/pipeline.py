import time
from fastapi import APIRouter, HTTPException, File, UploadFile
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from pathlib import Path
from app.config import UPLOAD_DIR
import pandas as pd
import logging
import asyncio

from app.services.pipeline_executor import PipelineExecutor

logger = logging.getLogger(__name__)
router = APIRouter()


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


_pipelines = {}
_pipeline_counter = 0


def _load_dataframe(file_id: str) -> pd.DataFrame:
    """Load dataframe from uploaded file."""
    file_dir = Path(UPLOAD_DIR) / file_id
    if not file_dir.exists():
        raise HTTPException(status_code=404, detail="File not found")

    files = list(file_dir.iterdir())
    if not files:
        raise HTTPException(status_code=404, detail="No files found")

    file_path = files[0]
    ext = file_path.suffix.lower()

    try:
        if ext in [".csv"]:
            return pd.read_csv(file_path)
        elif ext in [".xlsx", ".xls"]:
            return pd.read_excel(file_path)
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}")
    except Exception as e:
        logger.error(f"Error loading file: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error loading file: {str(e)}")


@router.post("/pipeline/execute")
async def execute_pipeline(request: PipelineExecuteRequest):
    """Execute a pipeline with the given nodes and edges."""
    try:
        start_time = time.time()

        df = _load_dataframe(request.file_id)

        executor = PipelineExecutor()
        nodes = [node.model_dump() for node in request.nodes]
        edges = [edge.model_dump() for edge in request.edges]

        result = await executor.execute_pipeline(nodes, edges, df)

        execution_time_ms = int((time.time() - start_time) * 1000)
        result["execution_id"] = f"exec_{int(time.time() * 1000)}"
        result["execution_time_ms"] = execution_time_ms

        return result

    except Exception as e:
        logger.error(f"Pipeline execution error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


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

        execution_time_ms = int((time.time() - start_time) * 1000)

        return {
            "preview_data": result.get("output_data", []),
            "row_count": result.get("row_count", 0),
            "execution_time_ms": execution_time_ms,
            "nodes_executed": list(result.get("node_results", {}).keys()),
        }

    except Exception as e:
        logger.error(f"Pipeline preview error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


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
    except Exception as e:
        logger.error(f"Error listing pipelines: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/pipeline/save")
async def save_pipeline(request: PipelineSaveRequest):
    """Save a pipeline."""
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

    except Exception as e:
        logger.error(f"Error saving pipeline: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
