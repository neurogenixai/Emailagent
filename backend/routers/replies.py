"""
Replies router — fetch inbox events
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from models import EmailEvent, EventType, Lead, Campaign
from user_model import User
from routers.auth_router import get_current_user

router = APIRouter(prefix="/replies", tags=["Replies"])

@router.get("")
def list_replies(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    events = db.query(EmailEvent).filter(EmailEvent.event_type == EventType.replied).order_by(EmailEvent.timestamp.desc()).all()
    result = []
    for ev in events:
        lead = db.query(Lead).filter(Lead.id == ev.lead_id).first()
        if not lead:
            continue
        campaign = db.query(Campaign).filter(Campaign.id == lead.campaign_id).first()
        # Scope: clients only see replies from their own campaigns
        if current_user.role != "admin" and campaign and campaign.user_id != current_user.id:
            continue
        metadata = ev.metadata_ or {}
        result.append({
            "id": ev.id,
            "lead_id": lead.id,
            "lead_name": f"{lead.first_name or ''} {lead.last_name or ''}".strip() or lead.email,
            "lead_email": lead.email,
            "campaign_name": campaign.name if campaign else "Unknown",
            "mailbox": ev.mailbox,
            "subject": metadata.get("subject", "No Subject"),
            "body": metadata.get("body", "No content snippet available"),
            "timestamp": ev.timestamp.isoformat() if ev.timestamp else None
        })
    return result

@router.post("/poll-now")
def trigger_poll_now(current_user: User = Depends(get_current_user)):
    """Manually trigger the IMAP polling process in a background thread."""
    import threading
    from services.imap_poller import poll_replies
    
    t = threading.Thread(target=poll_replies, daemon=True)
    t.start()
    return {"ok": True, "message": "Polling triggered. Check back in 30 seconds."}
