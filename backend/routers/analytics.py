"""
Analytics router — KPIs, charts, per-mailbox, per-sequence stats
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from typing import Optional
from datetime import datetime, timedelta
from database import get_db
from models import Lead, LeadStatus, EmailEvent, EventType, EmailSequence, MailboxRotationLog, Campaign
from routers.auth_router import get_current_user

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/overview")
def overview(campaign_id: Optional[str] = None, db: Session = Depends(get_db), _=Depends(get_current_user)):
    def _q(model, *filters):
        q = db.query(func.count(model.id))
        for f in filters:
            q = q.filter(f)
        return q.scalar() or 0

    extra_lead = [Lead.campaign_id == campaign_id] if campaign_id else []
    extra_ev = [EmailEvent.lead_id.in_(
        db.query(Lead.id).filter(Lead.campaign_id == campaign_id)
    )] if campaign_id else []

    total_leads = _q(Lead, *extra_lead)
    contacted = _q(Lead, Lead.status != LeadStatus.new, *extra_lead)
    replied = _q(Lead, Lead.status == LeadStatus.replied, *extra_lead)
    bounced = _q(Lead, Lead.status == LeadStatus.bounced, *extra_lead)

    sent = _q(EmailEvent, EmailEvent.event_type == EventType.sent, *extra_ev)
    opened = _q(EmailEvent, EmailEvent.event_type == EventType.opened, *extra_ev)

    return {
        "total_leads": total_leads,
        "contacted": contacted,
        "replied": replied,
        "bounced": bounced,
        "emails_sent": sent,
        "emails_opened": opened,
        "reply_rate": round(replied / sent * 100, 1) if sent else 0,
        "open_rate": round(opened / sent * 100, 1) if sent else 0,
        "bounce_rate": round(bounced / sent * 100, 1) if sent else 0,
        "bounce_alert": (bounced / sent * 100 > 2) if sent else False,
    }


@router.get("/sequence-performance")
def sequence_performance(campaign_id: Optional[str] = None, db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Replies per sequence step."""
    results = []
    step_labels = ["Intro", "Follow-up 1", "Follow-up 2", "Follow-up 3"]
    for step in range(4):
        # Count leads that replied, whose last sequence step was `step`
        # Approximation: count email_events of type replied matched with sequence step
        q = db.query(func.count(EmailSequence.id)).filter(
            EmailSequence.step == step,
            EmailSequence.status == "sent",
        )
        if campaign_id:
            q = q.join(Lead, Lead.id == EmailSequence.lead_id).filter(Lead.campaign_id == campaign_id)
        sent = q.scalar() or 0

        replied_q = db.query(func.count(Lead.id)).filter(
            Lead.status == LeadStatus.replied,
        )
        if campaign_id:
            replied_q = replied_q.filter(Lead.campaign_id == campaign_id)
        replied = replied_q.scalar() or 0

        results.append({
            "step": step,
            "label": step_labels[step] if step < 4 else f"Step {step}",
            "sent": sent,
            "replied": replied,
            "reply_rate": round(replied / sent * 100, 1) if sent else 0,
        })
    return results


@router.get("/mailbox-performance")
def mailbox_performance(db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Per-mailbox reply and send stats."""
    rows = db.query(
        MailboxRotationLog.mailbox,
        func.count(MailboxRotationLog.id).label("sent")
    ).group_by(MailboxRotationLog.mailbox).all()

    result = []
    for row in rows:
        mailbox = row.mailbox
        sent = row.sent
        # Count replies from this mailbox
        replied = db.query(func.count(EmailEvent.id)).filter(
            EmailEvent.event_type == EventType.replied,
            EmailEvent.mailbox == mailbox,
        ).scalar() or 0
        result.append({
            "mailbox": mailbox,
            "sent": sent,
            "replied": replied,
            "reply_rate": round(replied / sent * 100, 1) if sent else 0,
        })
    return sorted(result, key=lambda x: x["reply_rate"], reverse=True)


@router.get("/open-rate-trend")
def open_rate_trend(days: int = Query(30, ge=7, le=90), db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Daily open rate for the last N days."""
    result = []
    now = datetime.utcnow()
    for i in range(days):
        day = now - timedelta(days=days - 1 - i)
        day_start = day.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day.replace(hour=23, minute=59, second=59)
        sent = db.query(func.count(EmailEvent.id)).filter(
            EmailEvent.event_type == EventType.sent,
            EmailEvent.timestamp >= day_start,
            EmailEvent.timestamp <= day_end,
        ).scalar() or 0
        opened = db.query(func.count(EmailEvent.id)).filter(
            EmailEvent.event_type == EventType.opened,
            EmailEvent.timestamp >= day_start,
            EmailEvent.timestamp <= day_end,
        ).scalar() or 0
        result.append({
            "date": day.strftime("%Y-%m-%d"),
            "sent": sent,
            "opened": opened,
            "open_rate": round(opened / sent * 100, 1) if sent else 0,
        })
    return result


@router.get("/recent-replies")
def recent_replies(limit: int = Query(10, ge=1, le=50), db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Live feed of recent replies."""
    events = db.query(EmailEvent).filter(
        EmailEvent.event_type == EventType.replied
    ).order_by(EmailEvent.timestamp.desc()).limit(limit).all()

    result = []
    for e in events:
        lead = db.query(Lead).filter(Lead.id == e.lead_id).first()
        result.append({
            "id": e.id,
            "lead_email": lead.email if lead else "",
            "lead_name": f"{lead.first_name or ''} {lead.last_name or ''}".strip() if lead else "",
            "lead_company": lead.company_name if lead else "",
            "mailbox": e.mailbox,
            "timestamp": e.timestamp.isoformat(),
        })
    return result
