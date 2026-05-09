"""
Approval Queue router
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from database import get_db
from models import EmailDraft, Lead, Campaign, EmailSequence, SequenceStatus
from routers.auth_router import get_current_user

router = APIRouter(prefix="/approval", tags=["Approval"])


class EditBody(BaseModel):
    subject: Optional[str] = None
    body: str


@router.get("/queue")
def get_queue(campaign_id: Optional[str] = None, db: Session = Depends(get_db), _=Depends(get_current_user)):
    """All drafted emails waiting for approval."""
    q = db.query(EmailDraft).filter(EmailDraft.approved == False)
    if campaign_id:
        q = q.filter(EmailDraft.campaign_id == campaign_id)
    drafts = q.order_by(EmailDraft.created_at.asc()).all()

    result = []
    for d in drafts:
        lead = db.query(Lead).filter(Lead.id == d.lead_id).first()
        seq = db.query(EmailSequence).filter(
            EmailSequence.lead_id == d.lead_id,
            EmailSequence.step == d.step
        ).first()
        result.append({
            "id": d.id,
            "lead_id": d.lead_id,
            "campaign_id": d.campaign_id,
            "step": d.step,
            "step_label": ["Intro", "Follow-up 1", "Follow-up 2", "Follow-up 3"][d.step] if d.step < 4 else f"Step {d.step}",
            "subject": d.subject,
            "body": d.edited_body or d.body,
            "ai_score": d.ai_score,
            "rewritten": d.rewritten,
            "approved": d.approved,
            "scheduled_at": seq.scheduled_at.isoformat() if seq and seq.scheduled_at else None,
            "lead": {
                "email": lead.email if lead else "",
                "full_name": f"{lead.first_name or ''} {lead.last_name or ''}".strip() if lead else "",
                "company_name": lead.company_name if lead else "",
                "job_title": lead.job_title if lead else "",
            } if lead else {},
        })
    return {"total": len(result), "items": result}


@router.patch("/{draft_id}/edit")
def edit_draft(draft_id: str, data: EditBody, db: Session = Depends(get_db), _=Depends(get_current_user)):
    draft = db.query(EmailDraft).filter(EmailDraft.id == draft_id).first()
    if not draft:
        raise HTTPException(404, "Draft not found")
    draft.edited_body = data.body
    if data.subject:
        draft.subject = data.subject
    db.commit()
    return {"ok": True}


@router.patch("/{draft_id}/approve")
def approve_one(draft_id: str, db: Session = Depends(get_db), _=Depends(get_current_user)):
    draft = db.query(EmailDraft).filter(EmailDraft.id == draft_id).first()
    if not draft:
        raise HTTPException(404, "Draft not found")
    draft.approved = True
    draft.approved_at = datetime.utcnow()
    db.commit()
    return {"ok": True}


@router.post("/approve-all")
def approve_all(campaign_id: str, db: Session = Depends(get_db), _=Depends(get_current_user)):
    drafts = db.query(EmailDraft).filter(
        EmailDraft.campaign_id == campaign_id,
        EmailDraft.approved == False
    ).all()
    now = datetime.utcnow()
    count = 0
    for d in drafts:
        d.approved = True
        d.approved_at = now
        count += 1
    db.commit()
    return {"ok": True, "approved": count}


@router.patch("/{draft_id}/reject")
def reject_draft(draft_id: str, db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Reject and trigger redraft via Claude."""
    draft = db.query(EmailDraft).filter(EmailDraft.id == draft_id).first()
    if not draft:
        raise HTTPException(404, "Draft not found")

    # Regenerate in background
    try:
        from services.claude_ai import regenerate_draft
        import threading
        t = threading.Thread(target=regenerate_draft, args=(draft_id,), daemon=True)
        t.start()
    except Exception:
        pass

    return {"ok": True, "message": "Redraft triggered"}


@router.post("/regenerate-all")
def regenerate_all_pending(campaign_id: str, db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Regenerate ALL pending (unapproved) drafts AND generate drafts for leads with none."""
    from models import Lead
    import threading

    # Part 1: regenerate existing pending drafts
    drafts = db.query(EmailDraft).filter(
        EmailDraft.campaign_id == campaign_id,
        EmailDraft.approved == False
    ).all()

    from services.claude_ai import regenerate_draft, generate_drafts_for_leads
    queued = 0
    for d in drafts:
        try:
            t = threading.Thread(target=regenerate_draft, args=(d.id,), daemon=True)
            t.start()
            queued += 1
        except Exception:
            pass

    # Part 2: generate drafts for leads that have NO drafts yet
    all_lead_ids = [r[0] for r in db.query(Lead.id).filter(Lead.campaign_id == campaign_id).all()]
    leads_with_drafts = {r[0] for r in db.query(EmailDraft.lead_id).filter(EmailDraft.campaign_id == campaign_id).all()}
    missing_lead_ids = [lid for lid in all_lead_ids if lid not in leads_with_drafts]

    if missing_lead_ids:
        try:
            t = threading.Thread(target=generate_drafts_for_leads, args=(missing_lead_ids, campaign_id), daemon=True)
            t.start()
            queued += len(missing_lead_ids)
        except Exception:
            pass

    total_msg = f"Queued {queued} action(s). Check Approval Queue in ~30 seconds."
    if not queued:
        total_msg = "No pending drafts or missing drafts found."
    return {"ok": True, "queued": queued, "message": total_msg}


