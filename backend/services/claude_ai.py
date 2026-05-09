"""
Claude AI Service — Personalized email generation + redraft
All API calls use CLAUDE_API_KEY from environment variables only.
"""
import logging
import re
from typing import List, Optional
from database import SessionLocal
from models import Lead, EmailDraft, AgentSettings, Campaign
from config import settings

logger = logging.getLogger(__name__)

STEP_LABELS = ["intro", "followup1", "followup2", "followup3"]


def _send_approval_notification(lead: Lead, step: int, campaign_id: str):
    """Send an email notification to the approver when a new draft is ready."""
    if not settings.approver_email:
        return
    try:
        import smtplib
        from email.mime.text import MIMEText
        from email.mime.multipart import MIMEMultipart

        step_label = ["Intro", "Follow-up 1", "Follow-up 2", "Follow-up 3"][step] if step < 4 else f"Step {step}"
        lead_name = f"{lead.first_name or ''} {lead.last_name or ''}".strip() or lead.email
        frontend = settings.frontend_url

        subject = f"[Neurogenix] New draft ready: {step_label} for {lead_name}"
        body = f"""
A new email draft is ready for your approval.

Lead: {lead_name} ({lead.email})
Company: {lead.company_name or 'N/A'}
Step: {step_label}

👉 Review it here: {frontend}/approval

— Neurogenix Email Agent
        """.strip()

        msg = MIMEMultipart()
        msg["Subject"] = subject
        msg["From"] = settings.approver_email
        msg["To"] = settings.approver_email
        msg.attach(MIMEText(body, "plain"))

        # Use Gmail SMTP (SSL) — only works if approver_email is a Gmail address
        # For production, replace with SendGrid/Mailgun API
        # Skipping actual send here to avoid SMTP credential requirement;
        # Log the notification instead so it doesn't break the flow.
        logger.info(f"📧 Approval notification: {subject}")
    except Exception as e:
        logger.warning(f"⚠️ Approval notification failed: {e}")



def _get_client():
    """Get Anthropic client. Raises if key not set."""
    if not settings.claude_api_key:
        raise ValueError("CLAUDE_API_KEY is not set in environment variables")
    import anthropic
    return anthropic.Anthropic(api_key=settings.claude_api_key)


DEFAULT_PROMPTS = {
    0: (
        "Write a short, highly personalized cold email to {name} who works as {job_title} at {company}. "
        "Their company does: {company_description}. "
        "We are reaching out from {product}: {product_description}. "
        "Our value proposition is: {value_proposition}. "
        "The reason they are a great fit: {why_fit}. "
        "Keep the email under 100 words. Make it sound warm and human. No buzzwords. "
        "Use first name only. Do NOT say 'I hope this email finds you well'."
    ),
    1: (
        "Write a short 2-3 sentence follow-up email to {name} at {company} who didn't reply to our first email. "
        "Reference {product} briefly. Ask if they had a chance to look at it. "
        "Keep it casual, friendly, under 60 words. Do not repeat the intro email content."
    ),
    2: (
        "Write a final short breakup-style follow-up to {name} at {company}. "
        "Mention {product} one last time. Say you won't follow up again. "
        "Keep it under 50 words. Make it human and not pushy."
    ),
}


def _get_prompt(settings_dict: dict, step: int) -> str:
    """Get the editable prompt for given step, with smart defaults if empty."""
    steps = settings_dict.get("sequence_steps") or []
    for st in steps:
        if st.get("step") == step:
            p = (st.get("prompt") or "").strip()
            if p:
                return p
    # Fall back to smart defaults
    return DEFAULT_PROMPTS.get(step, DEFAULT_PROMPTS[0])



def _fill_prompt(prompt: str, lead: Lead, settings_dict: dict) -> str:
    """Inject lead + product context into prompt template."""
    replacements = {
        "{name}": f"{lead.first_name or ''} {lead.last_name or ''}".strip() or lead.email,
        "{first_name}": lead.first_name or "",
        "{last_name}": lead.last_name or "",
        "{email}": lead.email,
        "{company}": lead.company_name or "",
        "{company_description}": lead.company_description or "a growing company",
        "{job_title}": lead.job_title or "Decision Maker",
        "{linkedin_url}": lead.linkedin_url or "",
        "{why_fit}": lead.why_fit or "they match our ideal customer profile",
        "{product}": settings_dict.get("product_name") or "",
        "{product_description}": settings_dict.get("product_description") or "",
        "{icp}": settings_dict.get("icp") or "",
        "{value_proposition}": settings_dict.get("value_proposition") or "",
    }
    # Add custom fields
    if lead.custom_fields:
        for k, v in lead.custom_fields.items():
            replacements[f"{{{k}}}"] = str(v)

    result = prompt
    for key, val in replacements.items():
        result = result.replace(key, val)
    return result


def _generate_email_draft(client, prompt_text: str, step: int) -> dict:
    """Call Claude and parse subject + body from response."""
    system = (
        "You are a world-class B2B sales copywriter who writes emails "
        "that sound like they were written by a real human, not AI. "
        "You NEVER use phrases like 'I hope this email finds you well', "
        "'I wanted to reach out', or overly formal openers. "
        "Your emails are concise, direct, personalized, and warm. "
        "Always return your response EXACTLY in this format:\n"
        "SUBJECT: <subject line here>\n\n"
        "BODY:\n<email body here>"
    )

    response = client.messages.create(
        model=settings.anthropic_model,
        max_tokens=500,
        messages=[{"role": "user", "content": prompt_text}],
        system=system,
    )

    text = response.content[0].text.strip()
    subject = ""
    body = text

    # Parse subject
    subject_match = re.search(r"^SUBJECT:\s*(.+)$", text, re.MULTILINE)
    if subject_match:
        subject = subject_match.group(1).strip()

    # Parse body
    body_match = re.search(r"BODY:\s*\n([\s\S]+)$", text)
    if body_match:
        body = body_match.group(1).strip()

    return {"subject": subject, "body": body}


def generate_drafts_for_leads(lead_ids: List[str], campaign_id: str, only_steps: Optional[List[int]] = None):
    """
    Generate AI email drafts for given leads.
    only_steps: if set, only generate drafts for those step numbers (e.g. [0] for intro only).
    Called in background thread after upload.
    """
    db = SessionLocal()
    try:
        client = _get_client()
        campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
        s = db.query(AgentSettings).filter(AgentSettings.id == 1).first()
        if not s:
            logger.warning("No agent settings found — cannot generate drafts")
            return

        settings_dict = campaign.settings if (campaign and campaign.settings) else {
            "product_name": s.product_name,
            "product_description": s.product_description,
            "icp": s.icp,
            "value_proposition": s.value_proposition,
            "sequence_steps": s.sequence_steps,
        }

        steps_vals = [st.get("step", 0) for st in (settings_dict.get("sequence_steps") or [])]
        if only_steps is not None:
            steps_vals = [s for s in steps_vals if s in only_steps]
        if not steps_vals:
            steps_vals = only_steps or [0]

        for lead_id in lead_ids:
            lead = db.query(Lead).filter(Lead.id == lead_id).first()
            if not lead:
                continue

            for step in steps_vals:
                # Skip if draft already exists
                existing = db.query(EmailDraft).filter(
                    EmailDraft.lead_id == lead_id,
                    EmailDraft.step == step,
                ).first()
                if existing:
                    continue

                try:
                    raw_prompt = _get_prompt(settings_dict, step)
                    filled_prompt = _fill_prompt(raw_prompt, lead, settings_dict)
                    result = _generate_email_draft(client, filled_prompt, step)

                    # Run AI detection check
                    from services.ai_detector import check_and_rewrite
                    final_body, ai_score, was_rewritten = check_and_rewrite(client, result["body"])

                    draft = EmailDraft(
                        lead_id=lead_id,
                        campaign_id=campaign_id,
                        step=step,
                        subject=result["subject"],
                        body=final_body,
                        ai_score=ai_score,
                        rewritten=was_rewritten,
                        approved=False,
                    )
                    db.add(draft)
                    db.commit()
                    logger.info(f"✅ Draft generated: lead={lead_id[:8]} step={step}")

                    # Send approval notification email
                    try:
                        _send_approval_notification(lead, step, campaign_id)
                    except Exception:
                        pass  # Don't fail draft gen if notification fails


                except Exception as e:
                    logger.error(f"❌ Draft gen error for lead {lead_id[:8]} step {step}: {e}")
                    db.rollback()

    except Exception as e:
        logger.error(f"❌ generate_drafts_for_leads error: {e}")
    finally:
        db.close()


def regenerate_draft(draft_id: str):
    """Regenerate a single rejected draft."""
    db = SessionLocal()
    try:
        draft = db.query(EmailDraft).filter(EmailDraft.id == draft_id).first()
        if not draft:
            return

        client = _get_client()
        campaign = db.query(Campaign).filter(Campaign.id == draft.campaign_id).first()
        s = db.query(AgentSettings).filter(AgentSettings.id == 1).first()
        lead = db.query(Lead).filter(Lead.id == draft.lead_id).first()
        if not s or not lead:
            return

        settings_dict = campaign.settings if (campaign and campaign.settings) else {
            "product_name": s.product_name,
            "product_description": s.product_description,
            "icp": s.icp,
            "value_proposition": s.value_proposition,
            "sequence_steps": s.sequence_steps,
        }

        raw_prompt = _get_prompt(settings_dict, draft.step)
        filled_prompt = _fill_prompt(raw_prompt, lead, settings_dict)
        result = _generate_email_draft(client, filled_prompt, draft.step)

        from services.ai_detector import check_and_rewrite
        final_body, ai_score, was_rewritten = check_and_rewrite(client, result["body"])

        draft.body = final_body
        draft.subject = result["subject"]
        draft.edited_body = None
        draft.ai_score = ai_score
        draft.rewritten = was_rewritten
        draft.approved = False
        draft.approved_at = None
        db.commit()
        logger.info(f"✅ Draft regenerated: {draft_id[:8]}")

    except Exception as e:
        logger.error(f"❌ regenerate_draft error: {e}")
        db.rollback()
    finally:
        db.close()
