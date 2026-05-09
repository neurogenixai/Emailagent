"""
Agent Settings router — all 6 sections save independently
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, Dict, Any
from database import get_db
from models import AgentSettings, RotationStrategy
from routers.auth_router import get_current_user

router = APIRouter(prefix="/settings", tags=["Settings"])


def _get_settings(db: Session) -> AgentSettings:
    row = db.query(AgentSettings).filter(AgentSettings.id == 1).first()
    if not row:
        row = AgentSettings(id=1)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def _serialize(s: AgentSettings) -> dict:
    return {
        "product_name": s.product_name,
        "product_description": s.product_description,
        "icp": s.icp,
        "value_proposition": s.value_proposition,
        "sequence_steps": s.sequence_steps or [],
        "send_start_hour": s.send_start_hour,
        "send_end_hour": s.send_end_hour,
        "timezone": s.timezone,
        "send_monday": s.send_monday,
        "send_tuesday": s.send_tuesday,
        "send_wednesday": s.send_wednesday,
        "send_thursday": s.send_thursday,
        "send_friday": s.send_friday,
        "send_saturday": s.send_saturday,
        "send_sunday": s.send_sunday,
        "rotation_strategy": s.rotation_strategy,
        "max_per_mailbox_per_day": s.max_per_mailbox_per_day,
        "column_mapping": s.column_mapping,
    }


@router.get("")
def get_settings(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return _serialize(_get_settings(db))


# ── Section 1: Product Context ──────────────────────────────────────────────

class ProductContext(BaseModel):
    product_name: Optional[str] = None
    product_description: Optional[str] = None
    icp: Optional[str] = None
    value_proposition: Optional[str] = None


@router.put("/product-context")
def save_product_context(data: ProductContext, db: Session = Depends(get_db), _=Depends(get_current_user)):
    s = _get_settings(db)
    if data.product_name is not None: s.product_name = data.product_name
    if data.product_description is not None: s.product_description = data.product_description
    if data.icp is not None: s.icp = data.icp
    if data.value_proposition is not None: s.value_proposition = data.value_proposition
    db.commit()
    return {"ok": True}


# ── Dynamic Sequences (Replaces fixed Prompts/Timeline) ─────────────────────

class SequenceStepsUpdate(BaseModel):
    sequence_steps: list[dict]

@router.put("/sequence-steps")
def save_sequence_steps(data: SequenceStepsUpdate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    s = _get_settings(db)
    s.sequence_steps = data.sequence_steps
    db.commit()
    return {"ok": True}


# ── Section 4: Column Mapping ────────────────────────────────────────────────

class ColumnMappingUpdate(BaseModel):
    column_mapping: Dict[str, Any]


@router.put("/column-mapping")
def save_column_mapping(data: ColumnMappingUpdate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    s = _get_settings(db)
    s.column_mapping = data.column_mapping
    db.commit()
    return {"ok": True}


# ── Section 5: Sending Schedule ──────────────────────────────────────────────

class SendingSchedule(BaseModel):
    send_start_hour: Optional[int] = None
    send_end_hour: Optional[int] = None
    timezone: Optional[str] = None
    send_monday: Optional[bool] = None
    send_tuesday: Optional[bool] = None
    send_wednesday: Optional[bool] = None
    send_thursday: Optional[bool] = None
    send_friday: Optional[bool] = None
    send_saturday: Optional[bool] = None
    send_sunday: Optional[bool] = None


@router.put("/sending-schedule")
def save_schedule(data: SendingSchedule, db: Session = Depends(get_db), _=Depends(get_current_user)):
    s = _get_settings(db)
    for field, val in data.model_dump(exclude_none=True).items():
        setattr(s, field, val)
    db.commit()
    return {"ok": True}


# ── Section 6: Mailbox Rotation ──────────────────────────────────────────────

class MailboxRotation(BaseModel):
    rotation_strategy: Optional[str] = None
    max_per_mailbox_per_day: Optional[int] = None


@router.put("/mailbox-rotation")
def save_rotation(data: MailboxRotation, db: Session = Depends(get_db), _=Depends(get_current_user)):
    s = _get_settings(db)
    if data.rotation_strategy is not None:
        s.rotation_strategy = RotationStrategy(data.rotation_strategy)
    if data.max_per_mailbox_per_day is not None:
        s.max_per_mailbox_per_day = data.max_per_mailbox_per_day
    db.commit()
    return {"ok": True}
