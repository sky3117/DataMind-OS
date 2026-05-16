from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from typing import List, Dict, Any, Optional
from typing import Literal
from pathlib import Path
from app.config import UPLOAD_DIR
import pandas as pd
import logging
import asyncio

from app.services.agents.cleaner import CleanerAgent
from app.services.agents.analyst import AnalystAgent
from app.services.agents.reporter import ReporterAgent
from app.services.agents.predictor import PredictorAgent

logger = logging.getLogger(__name__)
router = APIRouter()


class CleanerAnalyzeRequest(BaseModel):
    file_id: str


class CleanerApplyRequest(BaseModel):
    file_id: str
    suggestions: List[str]
    auto_fix: bool = False


class AnalystInsightsRequest(BaseModel):
    file_id: str


class ReporterGenerateRequest(BaseModel):
    file_id: str
    pipeline_id: Optional[str] = None
    title: str
    sections: List[str]
    include_charts: bool = True


class PredictorTrainRequest(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    file_id: str
    target_column: str
    features: List[str] = Field(min_length=1)
    model_type: Literal["classification", "regression"] = "classification"
    test_size: float = Field(default=0.2, gt=0.0, lt=1.0)
    random_state: int = 42


class PredictorPredictRequest(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    model_id: str
    input_data: List[Dict[str, Any]] = Field(min_length=1)


def _load_dataframe(file_id: str) -> pd.DataFrame:
    """Load dataframe from uploaded file."""
    # Validate file_id to prevent directory traversal
    if ".." in file_id or "/" in file_id or "\\" in file_id:
        raise HTTPException(status_code=400, detail="Invalid file ID")
    
    file_dir = Path(UPLOAD_DIR) / file_id
    
    # Ensure the resolved path is still within UPLOAD_DIR
    try:
        file_dir.resolve().relative_to(Path(UPLOAD_DIR).resolve())
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid file ID")
    
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
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error loading file: {str(e)}")
        raise HTTPException(status_code=500, detail="Error loading file")


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
        logger.error(f"Cleaner analysis error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/agents/cleaner/apply")
async def apply_cleaner(request: CleanerApplyRequest):
    """Apply cleaning actions to dataset."""
    try:
        df = _load_dataframe(request.file_id)

        result = await CleanerAgent.apply_cleaning(df, request.suggestions, request.auto_fix)

        return {
            "file_id": request.file_id,
            "actions_applied": result["actions_applied"],
            "rows_affected": result["rows_affected"],
            "new_health_score": result["new_health_score"],
            "message": "Cleaning applied successfully",
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Cleaner apply error: {str(e)}")
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
        logger.error(f"Analyst insights error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/agents/reporter/generate")
async def generate_report(request: ReporterGenerateRequest):
    """Generate PDF report."""
    try:
        df = _load_dataframe(request.file_id)

        result = await ReporterAgent.generate_report(
            title=request.title,
            sections=request.sections,
            include_charts=request.include_charts,
            analysis_data={},
        )

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Reporter generation error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/agents/predictor/train")
async def train_predictor(request: PredictorTrainRequest):
    """Train a predictive model."""
    try:
        df = _load_dataframe(request.file_id)

        result = await PredictorAgent.train_model(
            df=df,
            target_column=request.target_column,
            features=request.features,
            model_type=request.model_type,
            test_size=request.test_size,
            random_state=request.random_state,
        )

        return result

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Predictor training error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/agents/predictor/predict")
async def make_prediction(request: PredictorPredictRequest):
    """Make predictions with a trained model."""
    try:
        result = await PredictorAgent.make_predictions(
            model_id=request.model_id,
            input_data=request.input_data,
        )

        return result

    except ValueError as e:
        if "not found" in str(e):
            raise HTTPException(status_code=404, detail=str(e))
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Predictor prediction error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
