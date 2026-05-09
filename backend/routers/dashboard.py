"""
Dashboard router — overview stats
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
from database import get_db
from models import Campaign, CampaignStatus, Lead, LeadStatus, EmailEvent, EventType, EmailDraft, Mailbox
from routers.auth_router import get_current_user

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("")
def dashboard_overview(db: Session = Depends(get_db), _=Depends(get_current_user)):
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    tomorrow = today + timedelta(days=1)

    active_campaigns = db.query(func.count(Campaign.id)).filter(
        Campaign.status == CampaignStatus.active
    ).scalar() or 0

    total_leads = db.query(func.count(Lead.id)).scalar() or 0

    sent_today = db.query(func.count(EmailEvent.id)).filter(
        EmailEvent.event_type == EventType.sent,
        EmailEvent.timestamp >= today,
        EmailEvent.timestamp < tomorrow,
    ).scalar() or 0

    total_sent = db.query(func.count(EmailEvent.id)).filter(
        EmailEvent.event_type == EventType.sent
    ).scalar() or 0
    total_opened = db.query(func.count(EmailEvent.id)).filter(
        EmailEvent.event_type == EventType.opened
    ).scalar() or 0
    total_replied = db.query(func.count(EmailEvent.id)).filter(
        EmailEvent.event_type == EventType.replied
    ).scalar() or 0
    total_bounced = db.query(func.count(EmailEvent.id)).filter(
        EmailEvent.event_type == EventType.bounced
    ).scalar() or 0

    pending_approvals = db.query(func.count(EmailDraft.id)).filter(
        EmailDraft.approved == False
    ).scalar() or 0

    replied_today = db.query(func.count(EmailEvent.id)).filter(
        EmailEvent.event_type == EventType.replied,
        EmailEvent.timestamp >= today,
    ).scalar() or 0

    mailboxes_active = db.query(func.count(Mailbox.id)).filter(
        Mailbox.is_active == True,
        Mailbox.oauth_refresh_token_enc.isnot(None),
    ).scalar() or 0

    bounce_rate = round(total_bounced / total_sent * 100, 1) if total_sent else 0

    return {
        "active_campaigns": active_campaigns,
        "total_leads": total_leads,
        "sent_today": sent_today,
        "total_sent": total_sent,
        "open_rate": round(total_opened / total_sent * 100, 1) if total_sent else 0,
        "reply_rate": round(total_replied / total_sent * 100, 1) if total_sent else 0,
        "bounce_rate": bounce_rate,
        "bounce_alert": bounce_rate > 2.0,
        "pending_approvals": pending_approvals,
        "replied_today": replied_today,
        "mailboxes_connected": mailboxes_active,
    }
