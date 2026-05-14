"""
IMAP Poller — polls Gmail API every 15-30 mins for replies and bounces
"""
import logging
import re
from datetime import datetime, timedelta
from database import SessionLocal
from models import Lead, LeadStatus, Mailbox, EmailEvent, EventType, EmailSequence, SequenceStatus
from services.encryption import decrypt
from config import settings

logger = logging.getLogger(__name__)

# Known bounce sender patterns
BOUNCE_SENDERS = [
    "mailer-daemon", "postmaster", "mail delivery subsystem",
    "delivery status notification",
]
BOUNCE_SUBJECTS = [
    "delivery failed", "undeliverable", "mail delivery", "returned mail",
    "delivery status notification", "failure notice", "delivery failure",
]


def _get_gmail_service(refresh_token: str):
    from google.oauth2.credentials import Credentials
    from googleapiclient.discovery import build
    creds = Credentials(
        token=None,
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
        scopes=["https://www.googleapis.com/auth/gmail.readonly"],
    )
    return build("gmail", "v1", credentials=creds, cache_discovery=False)


def poll_replies():
    """
    Poll all connected mailboxes for replies AND bounces.
    Called every 15-30 mins by scheduler.
    """
    db = SessionLocal()
    try:
        mailboxes = db.query(Mailbox).filter(
            Mailbox.is_active == True,
            Mailbox.oauth_refresh_token_enc.isnot(None),
        ).all()

        if not mailboxes:
            return

        # Build lead email → lead_id map from sent events
        sent_events = db.query(EmailEvent).filter(
            EmailEvent.event_type == EventType.sent
        ).all()
        lead_email_map = {}
        for ev in sent_events:
            lead = db.query(Lead).filter(Lead.id == ev.lead_id).first()
            if lead:
                lead_email_map[lead.email.lower()] = lead.id

        for mailbox in mailboxes:
            try:
                refresh_token = decrypt(mailbox.oauth_refresh_token_enc)
                service = _get_gmail_service(refresh_token)

                since = (datetime.utcnow() - timedelta(hours=24)).strftime("%Y/%m/%d")
                results = service.users().messages().list(
                    userId="me",
                    q=f"in:inbox after:{since}",
                    maxResults=50,
                ).execute()

                messages = results.get("messages", [])
                for msg_ref in messages:
                    msg = service.users().messages().get(
                        userId="me",
                        id=msg_ref["id"],
                        format="full",
                    ).execute()

                    headers = {h["name"]: h["value"] for h in msg.get("payload", {}).get("headers", [])}
                    from_addr = headers.get("From", "").lower()
                    in_reply_to = headers.get("In-Reply-To", "")
                    references = headers.get("References", "")
                    subject = headers.get("Subject", "").lower()
                    snippet = msg.get("snippet", "")

                    # ── Bounce Detection ─────────────────────────────────────
                    is_bounce = (
                        any(s in from_addr for s in BOUNCE_SENDERS) or
                        any(s in subject for s in BOUNCE_SUBJECTS)
                    )

                    if is_bounce:
                        # Try to extract bounced email from snippet/subject
                        bounced_email_match = re.search(
                            r'[\w\.\+\-]+@[\w\.\-]+\.[a-z]{2,}',
                            snippet + " " + subject
                        )
                        if bounced_email_match:
                            bounced_email = bounced_email_match.group(0).lower()
                            if bounced_email == mailbox.email.lower():
                                continue
                            lead_id = lead_email_map.get(bounced_email)
                            if lead_id:
                                lead = db.query(Lead).filter(Lead.id == lead_id).first()
                                if lead and lead.status != LeadStatus.bounced:
                                    lead.status = LeadStatus.bounced
                                    # Stop all pending sequences
                                    for seq in db.query(EmailSequence).filter(
                                        EmailSequence.lead_id == lead_id,
                                        EmailSequence.status == SequenceStatus.pending,
                                    ).all():
                                        seq.status = SequenceStatus.skipped

                                    db.add(EmailEvent(
                                        lead_id=lead_id,
                                        event_type=EventType.bounced,
                                        mailbox=mailbox.email,
                                        timestamp=datetime.utcnow(),
                                        metadata_={"reason": snippet[:300], "subject": subject}
                                    ))
                                    db.commit()
                                    logger.info(f"⛔ Bounce: {bounced_email} marked as bounced")
                        continue  # Don't also process as reply

                    # ── Reply Detection ──────────────────────────────────────
                    if not (in_reply_to or references):
                        continue

                    email_match = re.search(r'<([^>]+)>', from_addr)
                    sender_email = email_match.group(1).lower() if email_match else from_addr.split()[0]

                    if sender_email in lead_email_map:
                        lead_id = lead_email_map[sender_email]
                        lead = db.query(Lead).filter(Lead.id == lead_id).first()
                        if not lead:
                            continue

                        # Skip if already recorded
                        existing = db.query(EmailEvent).filter(
                            EmailEvent.lead_id == lead_id,
                            EmailEvent.event_type == EventType.replied,
                        ).first()
                        if existing:
                            continue

                        lead.status = LeadStatus.replied
                        for seq in db.query(EmailSequence).filter(
                            EmailSequence.lead_id == lead_id,
                            EmailSequence.status == SequenceStatus.pending,
                        ).all():
                            seq.status = SequenceStatus.skipped

                        db.add(EmailEvent(
                            lead_id=lead_id,
                            event_type=EventType.replied,
                            mailbox=mailbox.email,
                            timestamp=datetime.utcnow(),
                            metadata_={"subject": subject, "body": snippet}
                        ))
                        mailbox.total_replies += 1
                        db.commit()
                        logger.info(f"✅ Reply: {sender_email} (via {mailbox.email})")

            except Exception as e:
                logger.warning(f"⚠️ Poll error for {mailbox.email}: {e}")

    except Exception as e:
        logger.error(f"❌ poll_replies error: {e}")
    finally:
        db.close()
