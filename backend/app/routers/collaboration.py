from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import logging
import json
from datetime import datetime

logger = logging.getLogger(__name__)
router = APIRouter()


class CommentRequest(BaseModel):
    resource_type: str
    resource_id: str
    author: str
    content: str


class ShareRequest(BaseModel):
    resource_type: str
    resource_id: str
    shared_by: str
    shared_with: List[str]
    permission: str = "view"


class ActivityLogRequest(BaseModel):
    user: str
    action: str
    resource_type: str
    resource_id: str
    details: Optional[Dict[str, Any]] = None


_comments: Dict[str, List[Dict[str, Any]]] = {}
_activities: List[Dict[str, Any]] = []
_shares: List[Dict[str, Any]] = []
_active_connections: List[WebSocket] = []


@router.post("/collaboration/comment")
async def add_comment(request: CommentRequest):
    """Add a comment to a resource."""
    try:
        resource_key = f"{request.resource_type}_{request.resource_id}"

        if resource_key not in _comments:
            _comments[resource_key] = []

        comment = {
            "id": f"comment_{len(_comments[resource_key])}",
            "author": request.author,
            "content": request.content,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
            "resolved": False,
            "replies": [],
        }

        _comments[resource_key].append(comment)

        return {
            "id": comment["id"],
            "resource_type": request.resource_type,
            "resource_id": request.resource_id,
            "message": "Comment added successfully",
        }

    except Exception as e:
        logger.error(f"Error adding comment: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/collaboration/comments/{resource_type}/{resource_id}")
async def get_comments(resource_type: str, resource_id: str):
    """Get comments for a resource."""
    try:
        resource_key = f"{resource_type}_{resource_id}"
        comments = _comments.get(resource_key, [])

        return {
            "resource_type": resource_type,
            "resource_id": resource_id,
            "comments": comments,
            "total": len(comments),
        }

    except Exception as e:
        logger.error(f"Error fetching comments: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/collaboration/share")
async def share_resource(request: ShareRequest):
    """Share a resource with other users."""
    try:
        share = {
            "id": f"share_{len(_shares)}",
            "resource_type": request.resource_type,
            "resource_id": request.resource_id,
            "shared_by": request.shared_by,
            "shared_with": request.shared_with,
            "permission": request.permission,
            "shared_at": datetime.utcnow().isoformat(),
            "expires_at": None,
        }

        _shares.append(share)

        return {
            "id": share["id"],
            "message": f"Resource shared with {len(request.shared_with)} user(s)",
            "shared_at": share["shared_at"],
        }

    except Exception as e:
        logger.error(f"Error sharing resource: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/collaboration/activity")
async def log_activity(request: ActivityLogRequest):
    """Log a collaboration activity."""
    try:
        activity = {
            "id": f"activity_{len(_activities)}",
            "user": request.user,
            "action": request.action,
            "resource_type": request.resource_type,
            "resource_id": request.resource_id,
            "timestamp": datetime.utcnow().isoformat(),
            "details": request.details or {},
        }

        _activities.append(activity)

        return {
            "id": activity["id"],
            "message": "Activity logged successfully",
        }

    except Exception as e:
        logger.error(f"Error logging activity: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/collaboration/activities")
async def get_activities(
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    limit: int = 50,
):
    """Get collaboration activities."""
    try:
        activities = _activities

        if resource_type:
            activities = [a for a in activities if a["resource_type"] == resource_type]

        if resource_id:
            activities = [a for a in activities if a["resource_id"] == resource_id]

        activities = sorted(
            activities, key=lambda x: x["timestamp"], reverse=True
        )[:limit]

        return {
            "activities": activities,
            "total": len(activities),
        }

    except Exception as e:
        logger.error(f"Error fetching activities: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.websocket("/ws/collaboration/{pipeline_id}")
async def websocket_collaboration(websocket: WebSocket, pipeline_id: str):
    """WebSocket endpoint for real-time collaboration."""
    await websocket.accept()
    _active_connections.append(websocket)

    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)

            broadcast_message = {
                "type": message.get("type", "update"),
                "pipeline_id": pipeline_id,
                "data": message.get("data"),
                "timestamp": datetime.utcnow().isoformat(),
            }

            for connection in _active_connections:
                try:
                    await connection.send_json(broadcast_message)
                except Exception as e:
                    logger.error(f"Error broadcasting to connection: {str(e)}")

    except WebSocketDisconnect:
        _active_connections.remove(websocket)
        logger.info(f"WebSocket disconnected for pipeline {pipeline_id}")
    except Exception as e:
        logger.error(f"WebSocket error: {str(e)}")
        _active_connections.remove(websocket)


@router.get("/collaboration/active-users/{pipeline_id}")
async def get_active_users(pipeline_id: str):
    """Get active users for a pipeline."""
    try:
        return {
            "pipeline_id": pipeline_id,
            "active_users": ["user1", "user2"],
            "connection_count": len(_active_connections),
        }

    except Exception as e:
        logger.error(f"Error fetching active users: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
