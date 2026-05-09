"""
Campaigns router
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from database import get_db
from models import Campaign, CampaignStatus, Lead, LeadStatus, AgentSettings
from user_model import User
from routers.auth_router import get_current_user

router = APIRouter(prefix="/campaigns", tags=["Campaigns"])


class CampaignCreate(BaseModel):
    name: str
    approver_email: Optional[str] = None
    description: Optional[str] = None


class CampaignStatusUpdate(BaseModel):
    status: CampaignStatus


def _serialize(c: Campaign, db: Session) -> dict:
    total_leads = db.query(func.count(Lead.id)).filter(Lead.campaign_id == c.id).scalar() or 0
    contacted = db.query(func.count(Lead.id)).filter(
        Lead.campaign_id == c.id, Lead.status != LeadStatus.new
    ).scalar() or 0
    replied = db.query(func.count(Lead.id)).filter(
        Lead.campaign_id == c.id, Lead.status == LeadStatus.replied
    ).scalar() or 0
    reply_rate = round((replied / total_leads * 100), 1) if total_leads else 0
    return {
        "id": c.id,
        "name": c.name,
        "status": c.status,
        "approver_email": c.approver_email,
        "description": c.description,
        "settings": c.settings or {},
        "total_leads": total_leads,
        "contacted": contacted,
        "replied": replied,
        "reply_rate": reply_rate,
        "progress": round((contacted / total_leads * 100), 1) if total_leads else 0,
        "created_at": c.created_at.isoformat() if c.created_at else None,
    }


@router.get("")
def list_campaigns(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    q = db.query(Campaign)
    if current_user.role != "admin":
        q = q.filter(Campaign.user_id == current_user.id)
    campaigns = q.order_by(Campaign.created_at.desc()).all()
    return [_serialize(c, db) for c in campaigns]


@router.post("")
def create_campaign(data: CampaignCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    s = db.query(AgentSettings).filter(AgentSettings.id == 1).first()
    default_settings = {}
    if s:
        default_settings = {
            "product_name": s.product_name,
            "product_description": s.product_description,
            "icp": s.icp,
            "value_proposition": s.value_proposition,
            "sequence_steps": s.sequence_steps or [],
        }
    c = Campaign(
        name=data.name,
        approver_email=data.approver_email,
        description=data.description,
        settings=default_settings,
        user_id=current_user.id,
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return _serialize(c, db)


@router.get("/{campaign_id}")
def get_campaign(campaign_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    q = db.query(Campaign).filter(Campaign.id == campaign_id)
    if current_user.role != "admin":
        q = q.filter(Campaign.user_id == current_user.id)
    c = q.first()
    if not c:
        raise HTTPException(404, "Campaign not found")
    return _serialize(c, db)


@router.patch("/{campaign_id}/status")
def update_status(campaign_id: str, data: CampaignStatusUpdate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    c = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not c:
        raise HTTPException(404, "Campaign not found")
    c.status = data.status
    c.updated_at = datetime.utcnow()
    db.commit()
    return {"ok": True, "status": c.status}


class CampaignSettingsUpdate(BaseModel):
    settings: dict

@router.put("/{campaign_id}/settings")
def update_campaign_settings(campaign_id: str, data: CampaignSettingsUpdate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    c = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not c:
        raise HTTPException(404, "Campaign not found")
    c.settings = data.settings
    c.updated_at = datetime.utcnow()
    db.commit()
    return {"ok": True, "settings": c.settings}


@router.delete("/{campaign_id}")
def delete_campaign(campaign_id: str, db: Session = Depends(get_db), _=Depends(get_current_user)):
    c = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not c:
        raise HTTPException(404, "Campaign not found")
    db.delete(c)
    db.commit()
    return {"ok": True}
