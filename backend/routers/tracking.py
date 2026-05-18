"""
Tracking pixel endpoint — records email opens
"""
from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.orm import Session
from datetime import datetime
from database import get_db, SessionLocal
from models import EmailEvent, EventType

router = APIRouter(prefix="/track", tags=["Tracking"])

# Minimal 1×1 transparent PNG
_PNG_BYTES = (
    b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01'
    b'\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0c'
    b'IDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00'
    b'\x00IEND\xaeB`\x82'
)


@router.get("/open/{lead_id}/{step}")
def track_open(lead_id: str, step: int):
    """
    Tracking pixel endpoint.
    Called when recipient opens the email (image loads).
    Uses its own DB session so nothing can block saving the open event.
    """
    # Use a completely independent session — never fails silently
    db = SessionLocal()
    try:
        db.add(EmailEvent(
            lead_id=lead_id,
            event_type=EventType.opened,
            timestamp=datetime.utcnow(),
            metadata_={"step": step},
        ))
        db.commit()
    except Exception as e:
        db.rollback()
    finally:
        db.close()

    return Response(content=_PNG_BYTES, media_type="image/png", headers={
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
    })
