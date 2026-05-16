import os
import uuid
import shutil
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from app.config import UPLOAD_DIR, MAX_FILE_SIZE_MB, ALLOWED_EXTENSIONS
from datetime import datetime, timezone

router = APIRouter()

os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    ext = Path(file.filename or "").suffix.lstrip(".").lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type '.{ext}' not allowed. Allowed types: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    file_id = str(uuid.uuid4())
    dest_dir = Path(UPLOAD_DIR) / file_id
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest_path = dest_dir / f"data.{ext}"

    size = 0
    max_bytes = MAX_FILE_SIZE_MB * 1024 * 1024
    with open(dest_path, "wb") as out:
        while chunk := await file.read(1024 * 1024):
            size += len(chunk)
            if size > max_bytes:
                shutil.rmtree(dest_dir, ignore_errors=True)
                raise HTTPException(
                    status_code=413,
                    detail=f"File exceeds maximum size of {MAX_FILE_SIZE_MB}MB",
                )
            out.write(chunk)

    return JSONResponse(
        content={
            "file_id": file_id,
            "filename": file.filename,
            "extension": ext,
            "size_bytes": size,
            "message": "File uploaded successfully",
        }
    )


@router.get("/files/{file_id}")
async def get_file_info(file_id: str):
    dest_dir = Path(UPLOAD_DIR) / file_id
    if not dest_dir.exists():
        raise HTTPException(status_code=404, detail="File not found")

    files = list(dest_dir.iterdir())
    if not files:
        raise HTTPException(status_code=404, detail="File not found")

    f = files[0]
    return {
        "file_id": file_id,
        "filename": f.name,
        "size_bytes": f.stat().st_size,
    }


@router.get("/files")
async def list_files():
    upload_path = Path(UPLOAD_DIR)
    if not upload_path.exists():
        return {"files": []}
    
    files_data = []
    
    for file_dir in sorted(
        upload_path.iterdir(), 
        key=lambda p: p.stat().st_mtime, 
        reverse=True
    )[:50]:
        if not file_dir.is_dir():
            continue
            
        data_files = list(file_dir.iterdir())
        if not data_files:
            continue
            
        data_file = data_files[0]
        file_stat = data_file.stat()
        
        # Convert file modification time to UTC ISO format timestamp
        created_at = datetime.fromtimestamp(file_stat.st_mtime, tz=timezone.utc).isoformat()
        
        files_data.append({
            "file_id": file_dir.name,
            "filename": data_file.name,
            "size_bytes": file_stat.st_size,
            "created_at": created_at,
        })
    
    return {"files": files_data}

