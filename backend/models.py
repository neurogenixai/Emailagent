"""
NeuroGenix Email Agent — All SQLAlchemy Models
"""
import uuid
import enum
from datetime import datetime
from sqlalchemy import (
    Column, String, Text, Integer, Boolean, Float,
    DateTime, Enum, ForeignKey, JSON
)
from sqlalchemy.orm import relationship
from database import Base


def _uuid():
    return str(uuid.uuid4())


# ─── Enums ────────────────────────────────────────────────────────────────────

class CampaignStatus(str, enum.Enum):
    draft = "draft"
    active = "active"
    paused = "paused"
    completed = "completed"


class AccessRequestStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class LeadStatus(str, enum.Enum):
    new = "new"
    contacted = "contacted"
    replied = "replied"
    bounced = "bounced"
    unsubscribed = "unsubscribed"


class SequenceStatus(str, enum.Enum):
    pending = "pending"
    sent = "sent"
    skipped = "skipped"
    failed = "failed"


class EventType(str, enum.Enum):
    sent = "sent"
    opened = "opened"
    bounced = "bounced"
    replied = "replied"
    unsubscribed = "unsubscribed"


class RotationStrategy(str, enum.Enum):
    round_robin = "round_robin"
    block = "block"
    random = "random"


class ApprovalStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


# ─── Campaign ─────────────────────────────────────────────────────────────────

class Campaign(Base):
    __tablename__ = "campaigns"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)  # Multi-tenant owner
    name = Column(String(255), nullable=False)
    status = Column(Enum(CampaignStatus), default=CampaignStatus.draft)
    approver_email = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    settings = Column(JSON, nullable=True)  # Added per-campaign settings
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    leads = relationship("Lead", back_populates="campaign", cascade="all, delete-orphan")
    approval_requests = relationship("ApprovalRequest", back_populates="campaign", cascade="all, delete-orphan")


# ─── Lead ─────────────────────────────────────────────────────────────────────

class Lead(Base):
    __tablename__ = "leads"

    id = Column(String, primary_key=True, default=_uuid)
    campaign_id = Column(String, ForeignKey("campaigns.id"), nullable=False)
    email = Column(String(255), nullable=False)
    first_name = Column(String(100), nullable=True)
    last_name = Column(String(100), nullable=True)
    company_name = Column(String(255), nullable=True)
    company_description = Column(Text, nullable=True)
    job_title = Column(String(255), nullable=True)
    linkedin_url = Column(String(500), nullable=True)
    why_fit = Column(Text, nullable=True)
    custom_fields = Column(JSON, nullable=True)  # Extra Excel columns
    status = Column(Enum(LeadStatus), default=LeadStatus.new)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    campaign = relationship("Campaign", back_populates="leads")
    sequences = relationship("EmailSequence", back_populates="lead", cascade="all, delete-orphan")
    drafts = relationship("EmailDraft", back_populates="lead", cascade="all, delete-orphan")
    events = relationship("EmailEvent", back_populates="lead", cascade="all, delete-orphan")


# ─── Email Sequence ────────────────────────────────────────────────────────────

class EmailSequence(Base):
    __tablename__ = "email_sequences"

    id = Column(String, primary_key=True, default=_uuid)
    lead_id = Column(String, ForeignKey("leads.id"), nullable=False)
    step = Column(Integer, nullable=False)  # 0=intro, 1=followup1, 2=followup2
    scheduled_at = Column(DateTime, nullable=True)
    sent_at = Column(DateTime, nullable=True)
    status = Column(Enum(SequenceStatus), default=SequenceStatus.pending)
    from_mailbox = Column(String(255), nullable=True)

    lead = relationship("Lead", back_populates="sequences")


# ─── Email Draft ───────────────────────────────────────────────────────────────

class EmailDraft(Base):
    __tablename__ = "email_drafts"

    id = Column(String, primary_key=True, default=_uuid)
    lead_id = Column(String, ForeignKey("leads.id"), nullable=False)
    campaign_id = Column(String, ForeignKey("campaigns.id"), nullable=True)
    step = Column(Integer, nullable=False)
    subject = Column(String(500), nullable=True)
    body = Column(Text, nullable=True)
    edited_body = Column(Text, nullable=True)  # Human-edited version
    approved = Column(Boolean, default=False)
    approved_at = Column(DateTime, nullable=True)
    ai_score = Column(Float, nullable=True)  # AI-detection score 0-1
    rewritten = Column(Boolean, default=False)  # True if auto-rewritten
    created_at = Column(DateTime, default=datetime.utcnow)

    lead = relationship("Lead", back_populates="drafts")


# ─── Email Event ───────────────────────────────────────────────────────────────

class EmailEvent(Base):
    __tablename__ = "email_events"

    id = Column(String, primary_key=True, default=_uuid)
    lead_id = Column(String, ForeignKey("leads.id"), nullable=False)
    event_type = Column(Enum(EventType), nullable=False)
    mailbox = Column(String(255), nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    metadata_ = Column("metadata", JSON, nullable=True)

    lead = relationship("Lead", back_populates="events")


# ─── Mailbox Rotation Log ──────────────────────────────────────────────────────

class MailboxRotationLog(Base):
    __tablename__ = "mailbox_rotation_log"

    id = Column(String, primary_key=True, default=_uuid)
    lead_id = Column(String, ForeignKey("leads.id"), nullable=False)
    step = Column(Integer, nullable=False)
    mailbox = Column(String(255), nullable=False)
    sent_at = Column(DateTime, default=datetime.utcnow)


# ─── Approval Request ──────────────────────────────────────────────────────────

class ApprovalRequest(Base):
    __tablename__ = "approval_requests"

    id = Column(String, primary_key=True, default=_uuid)
    campaign_id = Column(String, ForeignKey("campaigns.id"), nullable=False)
    approver_email = Column(String(255), nullable=False)
    status = Column(Enum(ApprovalStatus), default=ApprovalStatus.pending)
    sent_at = Column(DateTime, default=datetime.utcnow)
    responded_at = Column(DateTime, nullable=True)

    campaign = relationship("Campaign", back_populates="approval_requests")


# ─── Agent Settings (single-row config table) ─────────────────────────────────

class AgentSettings(Base):
    __tablename__ = "agent_settings"

    id = Column(Integer, primary_key=True, default=1)

    # Product Context
    product_name = Column(String(255), default="")
    product_description = Column(Text, default="")
    icp = Column(Text, default="")
    value_proposition = Column(Text, default="")

    # AI Prompts
    intro_prompt = Column(Text, default="""Write a short, personalized cold email to {name} at {company}.

Context about our product: {product}
Their company does: {company_description}
Why they are a good fit: {why_fit}
Their role: {job_title}
Our ideal customer: {icp}

Rules:
- Keep it under 100 words
- Sound like a real human, not AI
- No generic openers like "I hope this email finds you well"
- Be direct and mention something specific about their company
- End with a soft CTA like "Worth a quick chat?"
- Use casual but professional tone""")

    followup1_prompt = Column(Text, default="""Write a short follow-up email to {name} at {company} who did not reply to our previous email.

Our product: {product}
Why they are a good fit: {why_fit}

Rules:
- Reference the previous email briefly ("Following up on my last note...")
- Keep it under 60 words
- Add one new piece of value or insight
- No pressure, just a gentle nudge
- Sound human and conversational""")

    followup2_prompt = Column(Text, default="""Write a final follow-up email to {name} at {company}.

Our product: {product}

Rules:
- Very short (under 50 words)  
- Create slight urgency without being pushy
- Something like "Last time I'll bother you..." 
- Offer to send a quick resource or case study
- End with easy yes/no question
- Sound natural, not robotic""")

    followup3_prompt = Column(Text, default="""Write a breakup email to {name} at {company}.

Rules:
- Very short (2-3 sentences max)
- Friendly goodbye, no hard feelings
- Leave the door open if they want to reconnect later
- Sound genuine and human""")

    # Sequence timing (days after intro)
    sequence_day0 = Column(Integer, default=0)   # Intro (fixed)
    sequence_day1 = Column(Integer, default=3)   # Follow-up 1
    sequence_day2 = Column(Integer, default=7)   # Follow-up 2
    sequence_day3 = Column(Integer, default=12)  # Follow-up 3 (optional)
    use_followup3 = Column(Boolean, default=False)

    # Sending Schedule
    send_start_hour = Column(Integer, default=9)
    send_end_hour = Column(Integer, default=18)
    timezone = Column(String(50), default="IST")
    send_monday = Column(Boolean, default=True)
    send_tuesday = Column(Boolean, default=True)
    send_wednesday = Column(Boolean, default=True)
    send_thursday = Column(Boolean, default=True)
    send_friday = Column(Boolean, default=True)
    send_saturday = Column(Boolean, default=False)
    send_sunday = Column(Boolean, default=False)

    # Mailbox Rotation
    rotation_strategy = Column(Enum(RotationStrategy), default=RotationStrategy.round_robin)
    max_per_mailbox_per_day = Column(Integer, default=40)

    # Excel Column Mapping (stored as JSON)
    column_mapping = Column(JSON, nullable=True)

    # Dynamic Follow-ups (replaces fixed sequence above)
    sequence_steps = Column(JSON, nullable=True)

    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ─── Mailbox (Gmail OAuth) ────────────────────────────────────────────────────

class Mailbox(Base):
    __tablename__ = "mailboxes"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)  # Multi-tenant owner
    email = Column(String(255), unique=True, nullable=False)
    display_name = Column(String(255), nullable=True)
    oauth_refresh_token_enc = Column(Text, nullable=True)  # Encrypted
    is_active = Column(Boolean, default=True)
    daily_sent_count = Column(Integer, default=0)
    daily_reset_date = Column(String(20), nullable=True)  # YYYY-MM-DD
    total_sent = Column(Integer, default=0)
    total_replies = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)


# ─── Access Request ───────────────────────────────────────────────────────────

class AccessRequest(Base):
    __tablename__ = "access_requests"

    id = Column(String, primary_key=True, default=_uuid)
    full_name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False)
    company_name = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    use_case = Column(Text, nullable=True)
    status = Column(Enum(AccessRequestStatus), default=AccessRequestStatus.pending)
    created_at = Column(DateTime, default=datetime.utcnow)
    reviewed_at = Column(DateTime, nullable=True)
