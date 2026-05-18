"""
Gmail Sender Service — sends emails via Gmail API (no SMTP ports needed)
"""
import logging
import base64
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
from typing import Optional
from database import SessionLocal
from models import Mailbox, EmailEvent, EventType, EmailSequence, SequenceStatus, Lead, LeadStatus, MailboxRotationLog
from services.encryption import decrypt
from config import settings

logger = logging.getLogger(__name__)


def _get_gmail_service(refresh_token: str):
    """Build Gmail API service from refresh token."""
    from google.oauth2.credentials import Credentials
    from googleapiclient.discovery import build

    creds = Credentials(
        token=None,
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
        scopes=["https://www.googleapis.com/auth/gmail.send", "https://www.googleapis.com/auth/gmail.readonly"],
    )
    return build("gmail", "v1", credentials=creds, cache_discovery=False)


def _build_mime_message(
    from_email: str,
    from_name: str,
    to_email: str,
    subject: str,
    body: str,
    lead_id: str,
    step: int,
    base_url: str,
    sender_company: str = "",
) -> str:
    """Build MIME email with tracking pixel embedded."""
    msg = MIMEMultipart("alternative")
    # Set proper From with display name so it shows as "Jay Rwaltz <jay@rwaltz.services>"
    msg["From"] = f"{from_name} <{from_email}>" if from_name else from_email
    msg["To"] = to_email
    msg["Subject"] = subject

    # Plain text fallback
    msg.attach(MIMEText(body, "plain", "utf-8"))

    # HTML version with tracking pixel
    # NOTE: Do NOT use style="display:none" — Gmail strips it and may skip loading the pixel
    # Use width/height=1 and no style attribute for maximum compatibility
    tracking_url = f"{base_url}/api/track/open/{lead_id}/{step}"
    html_body = body.replace("\n", "<br>")
    # Build the official-looking signature
    initial = from_name[0].upper() if from_name else "S"
    signature_html = f"""
    <br><br>
    <table cellpadding="0" cellspacing="0" style="border-collapse: collapse; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 20px; width: 100%; max-width: 400px;">
      <tr>
        <td style="padding-right: 15px; border-right: 2px solid #e2e8f0; width: 45px;">
          <div style="width: 40px; height: 40px; border-radius: 50%; background-color: #f1f5f9; text-align: center; line-height: 40px; font-size: 18px; font-weight: bold; color: #475569;">
            {initial}
          </div>
        </td>
        <td style="padding-left: 15px;">
          <p style="margin: 0; font-size: 15px; font-weight: 600; color: #0f172a;">{from_name}</p>
          <p style="margin: 3px 0 0; font-size: 13px; color: #64748b;">{sender_company}</p>
        </td>
      </tr>
    </table>
    """

    html = (
        f"<html><head><meta charset='UTF-8'></head><body>"
        f"<div style='font-family:-apple-system,BlinkMacSystemFont,\"Segoe UI\",Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;color:#333;'>"
        f"{html_body}"
        f"</div>"
        f"{signature_html}"
        f"<img src='{tracking_url}' width='1' height='1' border='0' alt='' style='display:block;' />"
        f"</body></html>"
    )
    msg.attach(MIMEText(html, "html", "utf-8"))

    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
    return raw


def send_email(sequence_id: str):
    """
    Send one scheduled email via Gmail API.
    Called by the scheduler for due sequences.
    """
    db = SessionLocal()
    try:
        seq = db.query(EmailSequence).filter(EmailSequence.id == sequence_id).first()
        if not seq or seq.status != SequenceStatus.pending:
            return

        lead = db.query(Lead).filter(Lead.id == seq.lead_id).first()
        if not lead:
            return

        # Don't send if lead replied or unsubscribed
        if lead.status in (LeadStatus.replied, LeadStatus.unsubscribed):
            seq.status = SequenceStatus.skipped
            db.commit()
            return

        # Check if draft exists for this step
        from models import EmailDraft
        any_draft = db.query(EmailDraft).filter(
            EmailDraft.lead_id == lead.id,
            EmailDraft.step == seq.step,
        ).first()

        if not any_draft:
            # Draft hasn't been generated yet — it's due today, so generate it NOW
            logger.info(f"📝 Generating draft for lead={lead.id[:8]} step={seq.step} — due today!")
            from services.claude_ai import generate_drafts_for_leads
            import threading
            t = threading.Thread(
                target=generate_drafts_for_leads,
                args=([lead.id], lead.campaign_id, [seq.step]),
                daemon=True,
            )
            t.start()
            return  # Wait for draft generation + human approval

        if not any_draft.approved:
            logger.info(f"⏳ Draft awaiting approval for lead={lead.id[:8]} step={seq.step}")
            return  # Waiting for human to approve in queue

        draft = any_draft

        # Pick mailbox
        mailbox = None
        if seq.from_mailbox:
            mailbox = db.query(Mailbox).filter(Mailbox.email == seq.from_mailbox, Mailbox.is_active == True).first()
        if not mailbox:
            from services.mailbox_rotator import pick_mailbox
            mailbox = pick_mailbox(db)
        if not mailbox:
            logger.error("❌ No active mailboxes available")
            return

        refresh_token = decrypt(mailbox.oauth_refresh_token_enc)
        service = _get_gmail_service(refresh_token)

        subject = draft.subject or f"Following up — {lead.company_name or 'your company'}"
        body = draft.edited_body or draft.body or ""

        # Replace [Your name] / [Your Name] placeholder with sender's name
        sender_name = mailbox.display_name or mailbox.email.split("@")[0].replace(".", " ").title()
        body = body.replace("[Your name]", sender_name)
        body = body.replace("[Your Name]", sender_name)
        body = body.replace("[your name]", sender_name)

        base_url = settings.backend_url.rstrip("/")
        
        # Get company name from campaign settings
        from models import Campaign
        campaign = db.query(Campaign).filter(Campaign.id == lead.campaign_id).first()
        sender_company = campaign.settings.get("product_name", "Our Company") if campaign and campaign.settings else "Our Company"

        raw_msg = _build_mime_message(
            from_email=mailbox.email,
            from_name=sender_name,
            to_email=lead.email,
            subject=subject,
            body=body,
            lead_id=lead.id,
            step=seq.step,
            base_url=base_url,
            sender_company=sender_company,
        )

        service.users().messages().send(userId="me", body={"raw": raw_msg}).execute()

        # Update sequence
        seq.status = SequenceStatus.sent
        seq.sent_at = datetime.utcnow()
        seq.from_mailbox = mailbox.email

        # Update lead status
        if lead.status == LeadStatus.new:
            lead.status = LeadStatus.contacted

        # Log event
        db.add(EmailEvent(
            lead_id=lead.id,
            event_type=EventType.sent,
            mailbox=mailbox.email,
            timestamp=datetime.utcnow(),
            metadata_={"step": seq.step},
        ))

        # Log mailbox rotation
        db.add(MailboxRotationLog(
            lead_id=lead.id,
            step=seq.step,
            mailbox=mailbox.email,
        ))

        # Update mailbox counters
        mailbox.daily_sent_count += 1
        mailbox.total_sent += 1

        db.commit()
        logger.info(f"✅ Sent: {mailbox.email} → {lead.email} (step {seq.step})")

        # ── Schedule the NEXT step in the sequence ──────────────────────────
        try:
            from models import Campaign, AgentSettings
            from datetime import timedelta
            campaign = db.query(Campaign).filter(Campaign.id == lead.campaign_id).first()
            s = db.query(AgentSettings).filter(AgentSettings.id == 1).first()
            camp_settings = (campaign.settings if campaign and campaign.settings else {})
            seq_steps = camp_settings.get("sequence_steps") or (s.sequence_steps if s else [])

            current_step = seq.step
            next_step_data = next(
                (st for st in seq_steps if st.get("step", 0) == current_step + 1), None
            )
            if next_step_data:
                next_step = next_step_data.get("step", current_step + 1)
                delay_days = next_step_data.get("delay_days", 3)

                # ⚠️ Do NOT schedule follow-up if lead has already replied
                db.refresh(lead)
                if lead.status in (LeadStatus.replied, LeadStatus.unsubscribed):
                    logger.info(f"⏭️ Skipping next step for lead={lead.id[:8]} — already replied/unsubscribed")
                    return

                # Check if next sequence entry already exists
                existing_next = db.query(EmailSequence).filter(
                    EmailSequence.lead_id == lead.id,
                    EmailSequence.step == next_step,
                ).first()
                if not existing_next:
                    scheduled_at = datetime.utcnow() + timedelta(days=delay_days)
                    db.add(EmailSequence(
                        lead_id=lead.id,
                        step=next_step,
                        scheduled_at=scheduled_at,
                    ))
                    db.commit()
                    logger.info(f"📅 Scheduled step {next_step} for lead={lead.id[:8]} in {delay_days} days — draft will be generated on that day")
                    # ✅ Option B: Do NOT pre-generate the draft here.
                    # The scheduler will generate it automatically on the scheduled day.
        except Exception as ex:
            logger.warning(f"⚠️ Could not schedule next step: {ex}")


    except Exception as e:
        err_str = str(e)
        db.rollback()
        # invalid_grant means the OAuth refresh token is expired/revoked — deactivate mailbox
        if "invalid_grant" in err_str:
            try:
                from models import Mailbox as MbModel
                bad_mailbox = db.query(MbModel).filter(MbModel.email == (mailbox.email if mailbox else "")).first()
                if bad_mailbox:
                    bad_mailbox.is_active = False
                    db.commit()
                    logger.warning(
                        f"⚠️ Mailbox {bad_mailbox.email} deactivated — OAuth token expired. "
                        "Re-authenticate via the Mailboxes page."
                    )
            except Exception:
                pass
        else:
            logger.error(f"❌ Send error for sequence {sequence_id}: {e}")
            try:
                seq = db.query(EmailSequence).filter(EmailSequence.id == sequence_id).first()
                if seq:
                    seq.status = SequenceStatus.failed
                    db.commit()
            except Exception:
                pass
    finally:
        db.close()
