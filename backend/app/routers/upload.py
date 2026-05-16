import os
import uuid
import shutil
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from app.config import UPLOAD_DIR, MAX_FILE_SIZE_MB, ALLOWED_EXTENSIONS
from datetime import datetime, timezone

MAX_RECENT_FILES = 50
MIN_FILE_SIZE_BYTES = 1  # Minimum 1 byte
CHUNK_SIZE_BYTES = 1024 * 1024  # 1MB chunks

router = APIRouter()

os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """Upload a file with comprehensive validation and error handling."""
    # Validate filename exists
    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="Filename is required",
        )
    
    # Extract and validate extension
    ext = Path(file.filename).suffix.lstrip(".").lower()
    if not ext or ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type '.{ext}' not allowed. Allowed types: {', '.join(ALLOWED_EXTENSIONS)}",
        )
    
    # Validate MIME type matches extension
    content_type = file.content_type or ""
    if not _validate_content_type(ext, content_type):
        raise HTTPException(
            status_code=400,
            detail=f"File content type does not match extension. Got: {content_type}",
        )

    file_id = str(uuid.uuid4())
    dest_dir = Path(UPLOAD_DIR) / file_id
    
    try:
        dest_dir.mkdir(parents=True, exist_ok=True)
        dest_path = dest_dir / f"data.{ext}"
        
        size = 0
        max_bytes = MAX_FILE_SIZE_MB * 1024 * 1024
        
        # Write file with proper error handling
        with open(dest_path, "wb") as out:
            while True:
                chunk = await file.read(CHUNK_SIZE_BYTES)
                if not chunk:
                    break
                    
                size += len(chunk)
                if size > max_bytes:
                    # Clean up incomplete file
                    try:
                        dest_path.unlink(missing_ok=True)
                    except Exception as e:
                        print(f"Warning: Failed to delete incomplete file: {e}")
                    raise HTTPException(
                        status_code=413,
                        detail=f"File exceeds maximum size of {MAX_FILE_SIZE_MB}MB",
                    )
                out.write(chunk)
        
        # Validate file was written
        if size < MIN_FILE_SIZE_BYTES:
            dest_path.unlink(missing_ok=True)
            raise HTTPException(
                status_code=400,
                detail="Uploaded file is empty",
            )
        
        return JSONResponse(
            content={
                "file_id": file_id,
                "filename": file.filename,
                "extension": ext,
                "size_bytes": size,
                "message": "File uploaded successfully",
            }
        )
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        # Clean up on any error
        try:
            shutil.rmtree(dest_dir, ignore_errors=True)
        except Exception as cleanup_err:
            print(f"Warning: Failed to cleanup directory {dest_dir}: {cleanup_err}")
        
        raise HTTPException(
            status_code=500,
            detail=f"File upload failed: {str(e)[:100]}",
        )
    finally:
        # Ensure file is closed
        try:
            await file.close()
        except Exception as e:
            print(f"Warning: Failed to close file: {e}")


def _validate_content_type(ext: str, content_type: str) -> bool:
    """Validate that content type matches the file extension."""
    if not content_type:
        return True  # Skip validation if no content-type provided
    
    content_type = content_type.split(";")[0].strip().lower()
    
    valid_types = {
        "csv": ["text/csv", "application/csv", "text/plain"],
        "xlsx": [
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/xlsx",
        ],
        "xls": [
            "application/vnd.ms-excel",
            "application/xls",
        ],
    }
    
    return content_type in valid_types.get(ext, [])


@router.get("/files/{file_id}")
async def get_file_info(file_id: str):
    """Get file information by file ID with validation."""
    # Validate file_id format (basic UUID check)
    if not file_id or len(file_id) < 10:
        raise HTTPException(status_code=400, detail="Invalid file ID format")
    
    dest_dir = Path(UPLOAD_DIR) / file_id
    if not dest_dir.exists():
        raise HTTPException(status_code=404, detail="File not found")

    try:
        files = list(dest_dir.iterdir())
        if not files:
            raise HTTPException(status_code=404, detail="File data not found")

        f = files[0]
        if not f.is_file():
            raise HTTPException(status_code=404, detail="Invalid file entry")
        
        return {
            "file_id": file_id,
            "filename": f.name,
            "size_bytes": f.stat().st_size,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve file info: {str(e)[:100]}",
        )


@router.get("/files")
async def list_files():
    """List recent uploaded files with error handling."""
    try:
        upload_path = Path(UPLOAD_DIR)
        if not upload_path.exists():
            return {"files": []}
        
        files_data = []
        
        # Get all directories, sorted by modification time
        try:
            dirs = sorted(
                (d for d in upload_path.iterdir() if d.is_dir()),
                key=lambda p: p.stat().st_mtime,
                reverse=True,
            )[:MAX_RECENT_FILES]
        except (OSError, PermissionError) as e:
            print(f"Warning: Failed to read upload directory: {e}")
            return {"files": []}
        
        for file_dir in dirs:
            try:
                data_files = [f for f in file_dir.iterdir() if f.is_file()]
                if not data_files:
                    continue
                
                data_file = data_files[0]
                file_stat = data_file.stat()
                
                # Convert file modification time to UTC ISO format timestamp
                created_at = datetime.fromtimestamp(
                    file_stat.st_mtime, tz=timezone.utc
                ).isoformat()
                
                files_data.append({
                    "file_id": file_dir.name,
                    "filename": data_file.name,
                    "size_bytes": file_stat.st_size,
                    "created_at": created_at,
                })
            except (OSError, PermissionError) as e:
                print(f"Warning: Failed to process file {file_dir.name}: {e}")
                continue
        
        return {"files": files_data}
        
    except Exception as e:
        print(f"Error listing files: {e}")
        return {"files": []}

