"""
Admin router — manage access requests and client accounts
"""
import secrets
import string
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from database import get_db
from models import AccessRequest, AccessRequestStatus
from user_model import User
from auth import hash_password
from routers.auth_router import get_current_user

router = APIRouter(prefix="/admin", tags=["Admin"])


def require_admin(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(403, "Admin access required")
    return current_user


def _gen_password(length=12) -> str:
    chars = string.ascii_letters + string.digits + "!@#$"
    return "".join(secrets.choice(chars) for _ in range(length))


# ── Access Requests ────────────────────────────────────────────────────────────

class AccessRequestCreate(BaseModel):
    full_name: str
    email: str
    company_name: Optional[str] = None
    phone: Optional[str] = None
    use_case: Optional[str] = None


@router.post("/access-requests", tags=["Public"])
def submit_access_request(data: AccessRequestCreate, db: Session = Depends(get_db)):
    """Public endpoint — no login needed."""
    existing = db.query(AccessRequest).filter(AccessRequest.email == data.email).first()
    if existing:
        raise HTTPException(400, "An access request with this email already exists.")
    req = AccessRequest(
        full_name=data.full_name,
        email=data.email,
        company_name=data.company_name,
        phone=data.phone,
        use_case=data.use_case,
    )
    db.add(req)
    db.commit()
    return {"ok": True, "message": "Access request submitted. The Neurogenix team will review and get back to you."}


@router.get("/access-requests")
def list_access_requests(db: Session = Depends(get_db), _=Depends(require_admin)):
    reqs = db.query(AccessRequest).order_by(AccessRequest.created_at.desc()).all()
    return [
        {
            "id": r.id,
            "full_name": r.full_name,
            "email": r.email,
            "company_name": r.company_name,
            "phone": r.phone,
            "use_case": r.use_case,
            "status": r.status,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in reqs
    ]


@router.post("/access-requests/{request_id}/approve")
def approve_access_request(request_id: str, db: Session = Depends(get_db), _=Depends(require_admin)):
    req = db.query(AccessRequest).filter(AccessRequest.id == request_id).first()
    if not req:
        raise HTTPException(404, "Request not found")
    if req.status != AccessRequestStatus.pending:
        raise HTTPException(400, f"Request is already {req.status}")

    # Check if user already exists
    existing_user = db.query(User).filter(User.email == req.email).first()
    if existing_user:
        req.status = AccessRequestStatus.approved
        req.reviewed_at = datetime.utcnow()
        db.commit()
        return {"ok": True, "message": "User already exists. Request marked as approved.", "email": req.email}

    # Create client account with auto-generated password
    temp_password = _gen_password()
    user = User(
        email=req.email,
        full_name=req.full_name,
        company_name=req.company_name,
        password_hash=hash_password(temp_password),
        role="client",
        is_active=True,
    )
    db.add(user)
    req.status = AccessRequestStatus.approved
    req.reviewed_at = datetime.utcnow()
    db.commit()

    return {
        "ok": True,
        "message": f"Client account created for {req.email}",
        "email": req.email,
        "temp_password": temp_password,  # Admin must share this with the client
    }


@router.post("/access-requests/{request_id}/reject")
def reject_access_request(request_id: str, db: Session = Depends(get_db), _=Depends(require_admin)):
    req = db.query(AccessRequest).filter(AccessRequest.id == request_id).first()
    if not req:
        raise HTTPException(404, "Request not found")
    req.status = AccessRequestStatus.rejected
    req.reviewed_at = datetime.utcnow()
    db.commit()
    return {"ok": True}


# ── Client Management ──────────────────────────────────────────────────────────

@router.get("/clients")
def list_clients(db: Session = Depends(get_db), _=Depends(require_admin)):
    from models import Campaign, Mailbox
    from sqlalchemy import func
    clients = db.query(User).filter(User.role == "client").order_by(User.created_at.desc()).all()
    result = []
    for c in clients:
        campaign_count = db.query(func.count(Campaign.id)).filter(Campaign.user_id == c.id).scalar() or 0
        mailbox_count = db.query(func.count(Mailbox.id)).filter(Mailbox.user_id == c.id).scalar() or 0
        result.append({
            "id": c.id,
            "email": c.email,
            "full_name": c.full_name,
            "company_name": c.company_name,
            "is_active": c.is_active,
            "created_at": c.created_at.isoformat() if c.created_at else None,
            "campaign_count": campaign_count,
            "mailbox_count": mailbox_count,
        })
    return result


@router.patch("/clients/{user_id}/toggle")
def toggle_client(user_id: str, db: Session = Depends(get_db), _=Depends(require_admin)):
    user = db.query(User).filter(User.id == user_id, User.role == "client").first()
    if not user:
        raise HTTPException(404, "Client not found")
    user.is_active = not user.is_active
    db.commit()
    return {"ok": True, "is_active": user.is_active}


@router.get("/clients/{user_id}")
def get_client_detail(user_id: str, db: Session = Depends(get_db), _=Depends(require_admin)):
    from models import Campaign, CampaignStatus, Lead, LeadStatus, Mailbox, EmailEvent, EventType
    from sqlalchemy import func

    user = db.query(User).filter(User.id == user_id, User.role == "client").first()
    if not user:
        raise HTTPException(404, "Client not found")

    campaigns = db.query(Campaign).filter(Campaign.user_id == user_id).order_by(Campaign.created_at.desc()).all()
    mailboxes = db.query(Mailbox).filter(Mailbox.user_id == user_id).all()

    campaign_ids = [c.id for c in campaigns]
    total_leads = db.query(func.count(Lead.id)).filter(Lead.campaign_id.in_(campaign_ids)).scalar() or 0 if campaign_ids else 0
    replied_leads = db.query(func.count(Lead.id)).filter(Lead.campaign_id.in_(campaign_ids), Lead.status == LeadStatus.replied).scalar() or 0 if campaign_ids else 0

    campaigns_data = []
    for c in campaigns:
        c_leads = db.query(func.count(Lead.id)).filter(Lead.campaign_id == c.id).scalar() or 0
        c_replied = db.query(func.count(Lead.id)).filter(Lead.campaign_id == c.id, Lead.status == LeadStatus.replied).scalar() or 0
        campaigns_data.append({
            "id": c.id, "name": c.name, "status": c.status,
            "total_leads": c_leads, "replied": c_replied,
            "reply_rate": round(c_replied / c_leads * 100, 1) if c_leads else 0,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        })

    return {
        "id": user.id, "email": user.email, "full_name": user.full_name,
        "company_name": user.company_name, "is_active": user.is_active,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "total_campaigns": len(campaigns),
        "active_campaigns": sum(1 for c in campaigns if c.status == CampaignStatus.active),
        "total_leads": total_leads,
        "replied_leads": replied_leads,
        "total_mailboxes": len(mailboxes),
        "campaigns": campaigns_data,
        "mailboxes": [{"email": m.email, "is_active": m.is_active, "total_sent": m.total_sent} for m in mailboxes],
    }


class PasswordResetRequest(BaseModel):
    new_password: Optional[str] = None


@router.post("/clients/{user_id}/reset-password")
def reset_client_password(user_id: str, body: PasswordResetRequest = None, db: Session = Depends(get_db), _=Depends(require_admin)):
    user = db.query(User).filter(User.id == user_id, User.role == "client").first()
    if not user:
        raise HTTPException(404, "Client not found")
    temp_password = (body.new_password if body and body.new_password else None) or _gen_password()
    user.password_hash = hash_password(temp_password)
    db.commit()
    return {"ok": True, "temp_password": temp_password}

