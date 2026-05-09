"""
Upload router — Excel/CSV parsing with dynamic column detection, deduplication
"""
import io
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, timedelta
from database import get_db
from models import Lead, Campaign, EmailSequence, AgentSettings, EmailDraft
from routers.auth_router import get_current_user
from services.excel_parser import parse_excel, detect_columns

router = APIRouter(prefix="/upload", tags=["Upload"])


@router.post("/detect-columns")
async def detect_excel_columns(
    file: UploadFile = File(...),
    _=Depends(get_current_user),
):
    """Return detected column names from uploaded Excel/CSV file."""
    content = await file.read()
    try:
        columns, sample_row = detect_columns(content, file.filename)
        return {"columns": columns, "sample_row": sample_row}
    except Exception as e:
        raise HTTPException(400, f"Could not parse file: {e}")


@router.post("/leads")
async def upload_leads(
    campaign_id: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    """
    Upload Excel/CSV leads to a campaign.
    - Auto-deduplicates by email
    - Mid-campaign upload: new leads get intro, existing leads skipped
    - Generates AI drafts for new leads
    """
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(404, "Campaign not found")

    # Get column mapping from settings
    settings_row = db.query(AgentSettings).filter(AgentSettings.id == 1).first()
    column_mapping = settings_row.column_mapping if settings_row else None

    content = await file.read()
    try:
        leads_data = parse_excel(content, file.filename, column_mapping)
    except Exception as e:
        raise HTTPException(400, f"Parse error: {e}")

    if not leads_data:
        raise HTTPException(400, "No leads found in file")

    # Collect existing emails in this campaign
    existing_emails = {
        r[0] for r in db.query(Lead.email).filter(Lead.campaign_id == campaign_id).all()
    }

    added = 0
    skipped = 0
    new_lead_ids = []

    for row in leads_data:
        email = (row.get("email") or "").strip().lower()
        if not email:
            skipped += 1
            continue
        if email in existing_emails:
            skipped += 1
            continue

        lead = Lead(
            campaign_id=campaign_id,
            email=email,
            first_name=row.get("first_name"),
            last_name=row.get("last_name"),
            company_name=row.get("company_name"),
            company_description=row.get("company_description"),
            job_title=row.get("job_title"),
            linkedin_url=row.get("linkedin_url"),
            why_fit=row.get("why_fit"),
            custom_fields=row.get("custom_fields"),
        )
        db.add(lead)
        db.flush()  # Get lead.id

        now = datetime.utcnow()
        # Get sequence steps from CAMPAIGN settings first, fallback to global settings
        campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
        camp_settings = campaign.settings if (campaign and campaign.settings) else {}
        seq_steps = camp_settings.get("sequence_steps") or settings_row.sequence_steps or []

        # Only create the INTRO (step 0) sequence row now.
        # Follow-up sequences are created by the scheduler AFTER the previous step is sent.
        intro_step = next((s for s in seq_steps if s.get("step", 0) == 0), None)
        if intro_step:
            db.add(EmailSequence(lead_id=lead.id, step=0, scheduled_at=now))
        else:
            # Fallback: create step 0 anyway
            db.add(EmailSequence(lead_id=lead.id, step=0, scheduled_at=now))

        existing_emails.add(email)
        new_lead_ids.append(lead.id)
        added += 1

    db.commit()

    # Trigger AI draft generation for INTRO ONLY (step 0)
    if new_lead_ids:
        try:
            from services.claude_ai import generate_drafts_for_leads
            import threading
            t = threading.Thread(
                target=generate_drafts_for_leads,
                args=(new_lead_ids, campaign_id, [0]),  # Only step 0
                daemon=True,
            )
            t.start()
        except Exception as e:
            pass  # Don't block upload on AI error

    return {
        "ok": True,
        "added": added,
        "skipped": skipped,
        "total_in_file": len(leads_data),
        "message": f"✅ {added} new leads added. {skipped} duplicates/invalid skipped.",
    }
