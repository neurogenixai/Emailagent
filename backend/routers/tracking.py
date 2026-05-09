"""
Tracking pixel endpoint — records email opens
"""
import io
import struct
import zlib
from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.orm import Session
from datetime import datetime
from database import get_db
from models import EmailEvent, EventType, Lead, LeadStatus

router = APIRouter(prefix="/track", tags=["Tracking"])

# Minimal 1×1 transparent PNG
_PNG_BYTES = (
    b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01'
    b'\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0c'
    b'IDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00'
    b'\x00IEND\xaeB`\x82'
)


@router.get("/open/{lead_id}/{step}")
def track_open(lead_id: str, step: int, db: Session = Depends(get_db)):
    """
    Tracking pixel endpoint.
    Called when recipient opens the email (image loads).
    Records the 'opened' event for the lead.
    """
    # Check if already recorded (don't double-count)
    existing = db.query(EmailEvent).filter(
        EmailEvent.lead_id == lead_id,
        EmailEvent.event_type == EventType.opened,
        EmailEvent.metadata_["step"].as_string() == str(step) if db.bind.dialect.name != "sqlite" else True,
    ).first()

    if not existing:
        db.add(EmailEvent(
            lead_id=lead_id,
            event_type=EventType.opened,
            timestamp=datetime.utcnow(),
            metadata_={"step": step},
        ))
        db.commit()

    return Response(content=_PNG_BYTES, media_type="image/png", headers={
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
    })
