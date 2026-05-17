from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, ConfigDict
from typing import List, Dict, Any, Optional
from pathlib import Path
from app.config import UPLOAD_DIR
import pandas as pd
import logging
import os
import re

from app.services.agents.cleaner import CleanerAgent
from app.services.agents.analyst import AnalystAgent
from app.services.agents.reporter import ReporterAgent
from app.services.agents.predictor import PredictorAgent

logger = logging.getLogger(__name__)
router = APIRouter()

REPORTS_DIR = os.getenv("REPORTS_DIR", "./reports")
_SAFE_ID_PATTERN = re.compile(r"^[A-Za-z0-9._-]+$")


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

class CleanerAnalyzeRequest(BaseModel):
    file_id: str


class CleanerApplyRequest(BaseModel):
    file_id: str
    suggestion_id: str
    action: str  # mean / median / mode / ffill / drop / remove / cap / keep


class AnalystInsightsRequest(BaseModel):
    file_id: str


class ReporterGenerateRequest(BaseModel):
    file_id: str
    title: Optional[str] = "Data Analysis Report"
    include_charts: bool = True


class PredictorColumnsRequest(BaseModel):
    file_id: str


class PredictorTrainRequest(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    file_id: str
    target_column: str
    model_type: str = "random_forest"  # linear_regression | random_forest
    features: Optional[List[str]] = None
    test_size: float = 0.2
    random_state: int = 42


class PredictorPredictRequest(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    model_id: str
    input_values: Dict[str, Any]


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _resolve_file(file_id: str):
    """Return (file_dir: Path, file_path: Path) or raise HTTPException."""
    if not _SAFE_ID_PATTERN.fullmatch(file_id):
        raise HTTPException(status_code=400, detail="Invalid file ID")

    base_upload_dir = Path(UPLOAD_DIR).resolve()
    if not base_upload_dir.exists():
        raise HTTPException(status_code=404, detail="Upload directory not found")

    matching_dirs = [p for p in base_upload_dir.iterdir() if p.is_dir() and p.name == file_id]
    if not matching_dirs:
        raise HTTPException(status_code=404, detail="File not found")
    file_dir = matching_dirs[0]

    try:
        file_dir.resolve().relative_to(base_upload_dir)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid file ID")

    if not file_dir.exists():
        raise HTTPException(status_code=404, detail="File not found")

    files = [p for p in file_dir.iterdir() if p.is_file()]
    if not files:
        raise HTTPException(status_code=404, detail="No files found")

    return file_dir, files[0]


def _load_dataframe(file_id: str) -> pd.DataFrame:
    """Load dataframe from uploaded file."""
    _, file_path = _resolve_file(file_id)
    ext = file_path.suffix.lower()
    try:
        if ext == ".csv":
            return pd.read_csv(file_path)
        elif ext in [".xlsx", ".xls"]:
            return pd.read_excel(file_path)
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error loading file: {e}")
        raise HTTPException(status_code=500, detail="Error loading file")


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/agents/cleaner/analyze")
async def analyze_cleaner(request: CleanerAnalyzeRequest):
    """Analyze data quality and suggest cleaning actions."""
    try:
        df = _load_dataframe(request.file_id)
        result = await CleanerAgent.analyze_data(df)
        return {
            "analysis_id": f"analysis_{request.file_id}",
            "file_id": request.file_id,
            "suggestions": result["suggestions"],
            "overall_health_score": result["overall_health_score"],
            "recommended_actions": result["recommended_actions"],
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Cleaner analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/agents/cleaner/apply")
async def apply_cleaner(request: CleanerApplyRequest):
    """Apply a single cleaning fix to the dataset."""
    try:
        file_dir, file_path = _resolve_file(request.file_id)
        ext = file_path.suffix.lower()
        try:
            if ext == ".csv":
                df = pd.read_csv(file_path)
            elif ext in [".xlsx", ".xls"]:
                df = pd.read_excel(file_path)
            else:
                raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}")
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error loading file: {e}")

        result = await CleanerAgent.apply_fix(
            df=df,
            suggestion_id=request.suggestion_id,
            action=request.action,
            file_dir=file_dir,
            file_path=file_path,
        )
        return result
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Cleaner apply error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/agents/analyst/insights")
async def generate_insights(request: AnalystInsightsRequest):
    """Generate insights from data."""
    try:
        df = _load_dataframe(request.file_id)
        result = await AnalystAgent.generate_insights(df)
        return {
            "analysis_id": f"insights_{request.file_id}",
            "file_id": request.file_id,
            "insights": result["insights"],
            "key_findings": result["key_findings"],
            "next_questions": result["next_questions"],
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Analyst insights error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/agents/reporter/generate")
async def generate_report(request: ReporterGenerateRequest):
    """Generate an HTML report from the dataset."""
    try:
        df = _load_dataframe(request.file_id)
        result = await ReporterAgent.generate_report(
            df=df,
            file_id=request.file_id,
            title=request.title,
            include_charts=request.include_charts,
        )
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Reporter generation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/reports/{report_id}", response_class=HTMLResponse)
async def get_report(report_id: str):
    """Serve a generated HTML report."""
    if not _SAFE_ID_PATTERN.fullmatch(report_id):
        raise HTTPException(status_code=400, detail="Invalid report ID")
    reports_root = Path(REPORTS_DIR).resolve()
    report_path = next(
        (p for p in reports_root.glob("*.html") if p.is_file() and p.stem == report_id),
        None,
    )
    if report_path is None or not report_path.exists():
        raise HTTPException(status_code=404, detail="Report not found")
    return HTMLResponse(content=report_path.read_text(encoding="utf-8"))


@router.post("/agents/predictor/columns")
async def get_predictor_columns(request: PredictorColumnsRequest):
    """Return column list for target/feature selection."""
    try:
        df = _load_dataframe(request.file_id)
        columns = await PredictorAgent.get_columns(df)
        return {"file_id": request.file_id, "columns": columns}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Predictor columns error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/agents/predictor/train")
async def train_predictor(request: PredictorTrainRequest):
    """Train a predictive model (linear_regression or random_forest)."""
    try:
        df = _load_dataframe(request.file_id)
        result = await PredictorAgent.train_model(
            df=df,
            target_column=request.target_column,
            model_type=request.model_type,
            test_size=request.test_size,
            random_state=request.random_state,
            features=request.features,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Predictor training error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/agents/predictor/predict")
async def make_prediction(request: PredictorPredictRequest):
    """Make a single prediction with a trained model."""
    try:
        result = await PredictorAgent.make_predictions(
            model_id=request.model_id,
            input_values=request.input_values,
        )
        return result
    except ValueError as e:
        if "not found" in str(e).lower():
            raise HTTPException(status_code=404, detail=str(e))
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Predictor prediction error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
