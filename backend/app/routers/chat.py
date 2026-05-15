import json
from pathlib import Path
from typing import AsyncGenerator

import numpy as np
import pandas as pd
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.config import UPLOAD_DIR, GROQ_API_KEY

router = APIRouter()


class ChatRequest(BaseModel):
    file_id: str
    question: str


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


def _build_dataset_context(df: pd.DataFrame) -> str:
    rows, cols = df.shape
    col_info = []
    for c in df.columns:
        s = df[c]
        dtype = str(s.dtype)
        nulls = int(s.isnull().sum())
        if pd.api.types.is_numeric_dtype(s):
            desc = s.describe()
            col_info.append(
                f"  - {c} ({dtype}): min={desc['min']:.2f}, max={desc['max']:.2f}, "
                f"mean={desc['mean']:.2f}, nulls={nulls}"
            )
        else:
            top = s.value_counts().index[:3].tolist()
            col_info.append(
                f"  - {c} ({dtype}): top_values={top}, nulls={nulls}"
            )

    sample = df.head(3).replace({np.nan: None}).to_dict(orient="records")
    sample_str = json.dumps(sample, indent=2, default=str)

    return (
        f"Dataset overview:\n"
        f"- Rows: {rows}, Columns: {cols}\n"
        f"Columns:\n" + "\n".join(col_info) + "\n\n"
        f"Sample rows (first 3):\n{sample_str}"
    )


async def _stream_groq(question: str, context: str) -> AsyncGenerator[str, None]:
    if not GROQ_API_KEY:
        yield "data: " + json.dumps({"error": "GROQ_API_KEY not configured"}) + "\n\n"
        return

    try:
        from openai import AsyncOpenAI

        client = AsyncOpenAI(
            api_key=GROQ_API_KEY,
            base_url="https://api.groq.com/openai/v1"
        )
        system_prompt = (
            "You are DataMind OS, an expert AI data analyst. "
            "You analyze datasets and answer questions clearly and concisely. "
            "Use markdown formatting for tables and lists when helpful. "
            "Be precise with numbers and statistics."
        )
        user_message = f"{context}\n\nUser question: {question}"

        stream = await client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            max_tokens=2048,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ],
            stream=True,
        )
        
        async for chunk in stream:
            if chunk.choices[0].delta.content:
                text = chunk.choices[0].delta.content
                yield "data: " + json.dumps({"content": text}) + "\n\n"

        yield "data: " + json.dumps({"done": True}) + "\n\n"
    except Exception as exc:
        yield "data: " + json.dumps({"error": "An error occurred while processing your request"}) + "\n\n"


@router.post("/chat")
async def chat(request: ChatRequest):
    df = _load_dataframe(request.file_id)
    context = _build_dataset_context(df)

    return StreamingResponse(
        _stream_groq(request.question, context),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
