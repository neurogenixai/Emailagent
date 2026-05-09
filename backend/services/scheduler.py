"""
APScheduler — background jobs for sending and IMAP polling
"""
import logging
from datetime import datetime
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.triggers.cron import CronTrigger

logger = logging.getLogger(__name__)
_scheduler: BackgroundScheduler | None = None


def _check_and_send():
    """
    Check for due email sequences and send them.
    Respects send window (hours) and send days from settings.
    """
    from database import SessionLocal
    from models import EmailSequence, SequenceStatus, AgentSettings
    import pytz

    db = SessionLocal()
    try:
        s = db.query(AgentSettings).filter(AgentSettings.id == 1).first()
        if not s:
            return

        now_utc = datetime.utcnow()
        # Timezone offset approximations
        tz_offsets = {"IST": 5.5, "EST": -5, "PST": -8, "GMT": 0, "UAE": 4}
        offset = tz_offsets.get(s.timezone, 5.5)
        import math
        now_local_hour = (now_utc.hour + offset) % 24
        weekday = (now_utc.weekday() + math.floor(offset / 24)) % 7  # 0=Monday

        # Check send window
        if not (s.send_start_hour <= now_local_hour < s.send_end_hour):
            return

        # Check send days
        day_checks = [s.send_monday, s.send_tuesday, s.send_wednesday,
                      s.send_thursday, s.send_friday, s.send_saturday, s.send_sunday]
        if not day_checks[weekday]:
            return

        # Find sequences due to send (scheduled_at <= now and still pending)
        due = db.query(EmailSequence).filter(
            EmailSequence.status == SequenceStatus.pending,
            EmailSequence.scheduled_at <= now_utc,
        ).limit(100).all()

        for seq in due:
            try:
                from services.gmail_sender import send_email
                send_email(seq.id)
            except Exception as e:
                logger.error(f"❌ Send error seq {seq.id[:8]}: {e}")

    except Exception as e:
        logger.error(f"❌ _check_and_send error: {e}")
    finally:
        db.close()


def _poll_replies():
    """Run IMAP polling for all mailboxes."""
    try:
        from services.imap_poller import poll_replies
        poll_replies()
    except Exception as e:
        logger.error(f"❌ _poll_replies error: {e}")


def start_scheduler():
    global _scheduler
    _scheduler = BackgroundScheduler(timezone="UTC")

    # Send emails every 2 minutes (checks due sequences)
    _scheduler.add_job(_check_and_send, IntervalTrigger(minutes=2), id="send_emails", replace_existing=True)

    # Poll for replies every 20 minutes
    _scheduler.add_job(_poll_replies, IntervalTrigger(minutes=20), id="poll_replies", replace_existing=True)

    _scheduler.start()
    logger.info("✅ Email Agent scheduler started")


def stop_scheduler():
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("🔴 Scheduler stopped")
