"""
Timeline router — calendar view of scheduled emails
"""
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta
from database import get_db
from models import EmailSequence, Lead, Campaign
from routers.auth_router import get_current_user

router = APIRouter(prefix="/timeline", tags=["Timeline"])


@router.get("")
def get_timeline(
    campaign_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    """Calendar data — date → list of scheduled/sent emails."""
    now = datetime.utcnow()
    start = datetime.strptime(start_date, "%Y-%m-%d") if start_date else now - timedelta(days=7)
    end = datetime.strptime(end_date, "%Y-%m-%d") if end_date else now + timedelta(days=30)

    q = db.query(EmailSequence).filter(
        EmailSequence.scheduled_at >= start,
        EmailSequence.scheduled_at <= end,
    )
    if campaign_id:
        q = q.join(Lead, Lead.id == EmailSequence.lead_id).filter(Lead.campaign_id == campaign_id)

    sequences = q.order_by(EmailSequence.scheduled_at).all()

    # Group by date
    by_date: dict = {}
    step_labels = ["Intro", "Follow-up 1", "Follow-up 2", "Follow-up 3"]
    for seq in sequences:
        if not seq.scheduled_at:
            continue
        date_key = seq.scheduled_at.strftime("%Y-%m-%d")
        lead = db.query(Lead).filter(Lead.id == seq.lead_id).first()
        entry = {
            "id": seq.id,
            "step": seq.step,
            "label": step_labels[seq.step] if seq.step < 4 else f"Step {seq.step}",
            "status": seq.status,
            "from_mailbox": seq.from_mailbox,
            "lead_email": lead.email if lead else "",
            "lead_name": f"{lead.first_name or ''} {lead.last_name or ''}".strip() if lead else "",
            "lead_company": lead.company_name if lead else "",
        }
        by_date.setdefault(date_key, {"date": date_key, "items": [], "counts": {}})
        by_date[date_key]["items"].append(entry)
        label = step_labels[seq.step] if seq.step < 4 else f"Step {seq.step}"
        by_date[date_key]["counts"][label] = by_date[date_key]["counts"].get(label, 0) + 1

    return sorted(by_date.values(), key=lambda x: x["date"])


class RescheduleBody(BaseModel):
    new_date: str  # YYYY-MM-DD


@router.patch("/{seq_id}/reschedule")
def reschedule(seq_id: str, data: RescheduleBody, db: Session = Depends(get_db), _=Depends(get_current_user)):
    seq = db.query(EmailSequence).filter(EmailSequence.id == seq_id).first()
    if not seq:
        raise HTTPException(404, "Sequence not found")
    if seq.status == "sent":
        raise HTTPException(400, "Cannot reschedule already sent email")
    try:
        new_dt = datetime.strptime(data.new_date, "%Y-%m-%d")
        if seq.scheduled_at:
            new_dt = new_dt.replace(hour=seq.scheduled_at.hour, minute=seq.scheduled_at.minute)
    except ValueError:
        raise HTTPException(400, "Invalid date format")
    seq.scheduled_at = new_dt
    db.commit()
    return {"ok": True, "new_date": data.new_date}
