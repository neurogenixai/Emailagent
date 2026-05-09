"""
Mailbox Rotator Service
Implements round-robin, block, and random rotation strategies
"""
import random
import logging
from datetime import datetime
from sqlalchemy.orm import Session
from models import Mailbox, AgentSettings, RotationStrategy, MailboxRotationLog

logger = logging.getLogger(__name__)


def pick_mailbox(db: Session) -> Mailbox | None:
    """
    Pick the next mailbox to send from based on rotation strategy.
    Respects daily limits from settings.
    """
    settings = db.query(AgentSettings).filter(AgentSettings.id == 1).first()
    max_per_day = settings.max_per_mailbox_per_day if settings else 40
    strategy = settings.rotation_strategy if settings else RotationStrategy.round_robin

    # Get all active, connected mailboxes
    mailboxes = db.query(Mailbox).filter(
        Mailbox.is_active == True,
        Mailbox.oauth_refresh_token_enc.isnot(None),
    ).all()

    if not mailboxes:
        return None

    today = datetime.utcnow().strftime("%Y-%m-%d")
    # Reset daily count if it's a new day
    for m in mailboxes:
        if m.daily_reset_date != today:
            m.daily_sent_count = 0
            m.daily_reset_date = today
    db.commit()

    # Filter out mailboxes that hit their daily limit
    available = [m for m in mailboxes if m.daily_sent_count < max_per_day]
    if not available:
        logger.warning("⚠️ All mailboxes hit daily limit")
        return None

    if strategy == RotationStrategy.random:
        return random.choice(available)

    if strategy == RotationStrategy.block:
        # Block: each mailbox handles a block of leads
        # Sort by index and return the one with fewest sends
        return min(available, key=lambda m: m.total_sent)

    # Default: Round Robin — pick mailbox with fewest sends today
    return min(available, key=lambda m: m.daily_sent_count)
