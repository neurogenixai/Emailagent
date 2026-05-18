"""
Leads router — table, filters, lead history
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Optional
from database import get_db
from models import Lead, LeadStatus, EmailEvent, EmailDraft, EmailSequence, Campaign
from user_model import User
from routers.auth_router import get_current_user

router = APIRouter(prefix="/leads", tags=["Leads"])


def _serialize_lead(lead: Lead) -> dict:
    return {
        "id": lead.id,
        "email": lead.email,
        "first_name": lead.first_name,
        "last_name": lead.last_name,
        "full_name": f"{lead.first_name or ''} {lead.last_name or ''}".strip(),
        "company_name": lead.company_name,
        "company_description": lead.company_description,
        "job_title": lead.job_title,
        "linkedin_url": lead.linkedin_url,
        "why_fit": lead.why_fit,
        "custom_fields": lead.custom_fields,
        "status": lead.status,
        "campaign_id": lead.campaign_id,
        "created_at": lead.created_at.isoformat() if lead.created_at else None,
        "updated_at": lead.updated_at.isoformat() if lead.updated_at else None,
    }


@router.get("")
def list_leads(
    campaign_id: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Lead)
    if current_user.role != "admin":
        # Clients only see leads from their own campaigns
        client_campaign_ids = [c.id for c in db.query(Campaign.id).filter(Campaign.user_id == current_user.id).all()]
        q = q.filter(Lead.campaign_id.in_(client_campaign_ids))
    if campaign_id:
        q = q.filter(Lead.campaign_id == campaign_id)
    if status:
        try:
            q = q.filter(Lead.status == LeadStatus(status))
        except ValueError:
            pass
    if search:
        term = f"%{search}%"
        q = q.filter(or_(
            Lead.email.ilike(term),
            Lead.first_name.ilike(term),
            Lead.last_name.ilike(term),
            Lead.company_name.ilike(term),
        ))
    total = q.count()
    leads = q.order_by(Lead.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "leads": [_serialize_lead(l) for l in leads],
    }


@router.get("/{lead_id}")
def get_lead(lead_id: str, db: Session = Depends(get_db), _=Depends(get_current_user)):
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(404, "Lead not found")
    data = _serialize_lead(lead)

    # Attach history
    events = db.query(EmailEvent).filter(EmailEvent.lead_id == lead_id).order_by(EmailEvent.timestamp.desc()).all()
    data["events"] = [
        {"id": e.id, "type": e.event_type, "mailbox": e.mailbox, "timestamp": e.timestamp.isoformat()}
        for e in events
    ]

    drafts = db.query(EmailDraft).filter(EmailDraft.lead_id == lead_id).order_by(EmailDraft.step).all()
    data["drafts"] = [
        {
            "id": d.id, "step": d.step, "subject": d.subject,
            "body": d.edited_body or d.body, "approved": d.approved,
            "ai_score": d.ai_score, "rewritten": d.rewritten,
        }
        for d in drafts
    ]

    sequences = db.query(EmailSequence).filter(EmailSequence.lead_id == lead_id).order_by(EmailSequence.step).all()
    data["sequences"] = [
        {
            "step": s.step, "status": s.status,
            "scheduled_at": s.scheduled_at.isoformat() if s.scheduled_at else None,
            "sent_at": s.sent_at.isoformat() if s.sent_at else None,
            "from_mailbox": s.from_mailbox,
        }
        for s in sequences
    ]

    return data


@router.get("/activity/all")
def leads_activity(
    campaign_id: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Rich activity table: per-lead open, sent, bounce, reply, not-sent details."""
    from sqlalchemy import or_
    from models import SequenceStatus, EventType

    q = db.query(Lead)
    if current_user.role != "admin":
        client_campaign_ids = [c.id for c in db.query(Campaign).filter(Campaign.user_id == current_user.id).all()]
        q = q.filter(Lead.campaign_id.in_(client_campaign_ids))
    if campaign_id:
        q = q.filter(Lead.campaign_id == campaign_id)
    if search:
        term = f"%{search}%"
        q = q.filter(or_(
            Lead.email.ilike(term),
            Lead.first_name.ilike(term),
            Lead.last_name.ilike(term),
            Lead.company_name.ilike(term),
        ))

    leads = q.order_by(Lead.created_at.desc()).limit(200).all()
    result = []

    step_labels = {0: "Intro", 1: "Follow-up 1", 2: "Follow-up 2", 3: "Follow-up 3"}

    for lead in leads:
        events = db.query(EmailEvent).filter(EmailEvent.lead_id == lead.id).all()
        events_by_type = {}
        for ev in events:
            # SQLAlchemy Enum column returns the Enum instance. We need its string value.
            event_key = ev.event_type.value if hasattr(ev.event_type, "value") else str(ev.event_type).replace("EventType.", "")
            events_by_type.setdefault(event_key, []).append(ev)

        # Open events
        open_events = events_by_type.get("opened", [])
        first_open = min(open_events, key=lambda e: e.timestamp) if open_events else None

        # Reply events
        reply_events = events_by_type.get("replied", [])
        first_reply = min(reply_events, key=lambda e: e.timestamp) if reply_events else None

        # Bounce events
        bounce_events = events_by_type.get("bounced", [])
        first_bounce = min(bounce_events, key=lambda e: e.timestamp) if bounce_events else None

        # Per-step sequence data
        sequences = db.query(EmailSequence).filter(EmailSequence.lead_id == lead.id).order_by(EmailSequence.step).all()
        steps_data = []
        for seq in sequences:
            # Find the sent event for this step
            sent_ev = next(
                (e for e in events_by_type.get("sent", [])
                 if e.metadata_ and str(e.metadata_.get("step")) == str(seq.step)),
                None
            )
            steps_data.append({
                "step": seq.step,
                "label": step_labels.get(seq.step, f"Step {seq.step}"),
                "status": seq.status,
                "scheduled_at": seq.scheduled_at.isoformat() if seq.scheduled_at else None,
                "sent_at": seq.sent_at.isoformat() if seq.sent_at else None,
                "from_mailbox": seq.from_mailbox,
                "failed_reason": (seq.status == "failed") and "Send error — check mailbox connection" or None,
            })

        result.append({
            "id": lead.id,
            "full_name": f"{lead.first_name or ''} {lead.last_name or ''}".strip() or lead.email,
            "email": lead.email,
            "company_name": lead.company_name or "—",
            "job_title": lead.job_title or "—",
            "status": lead.status,
            "campaign_id": lead.campaign_id,
            "created_at": lead.created_at.isoformat() if lead.created_at else None,
            # Open tracking
            "opened": bool(open_events),
            "opened_at": first_open.timestamp.isoformat() if first_open else None,
            "open_count": len(open_events),
            # Reply tracking
            "replied": bool(reply_events),
            "replied_at": first_reply.timestamp.isoformat() if first_reply else None,
            # Bounce tracking
            "bounced": bool(bounce_events),
            "bounced_at": first_bounce.timestamp.isoformat() if first_bounce else None,
            "bounce_reason": first_bounce.metadata_.get("reason", "") if first_bounce and first_bounce.metadata_ else None,
            # Per-step breakdown
            "steps": steps_data,
        })

    return {"leads": result, "total": len(result)}

