"""
Mailboxes router — Gmail OAuth connect + list
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import secrets
from database import get_db
from models import Mailbox
from config import settings
from routers.auth_router import get_current_user
from user_model import User

router = APIRouter(prefix="/mailboxes", tags=["Mailboxes"])
_state_store: dict = {}  # Temporary OAuth state store


@router.get("")
def list_mailboxes(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    q = db.query(Mailbox)
    if current_user.role != "admin":
        q = q.filter(Mailbox.user_id == current_user.id)
    mailboxes = q.order_by(Mailbox.created_at.desc()).all()
    return [
        {
            "id": m.id,
            "email": m.email,
            "display_name": m.display_name,
            "is_active": m.is_active,
            "is_connected": bool(m.oauth_refresh_token_enc),
            "daily_sent_count": m.daily_sent_count,
            "total_sent": m.total_sent,
            "total_replies": m.total_replies,
            "reply_rate": round(m.total_replies / m.total_sent * 100, 1) if m.total_sent else 0,
        }
        for m in mailboxes
    ]


@router.get("/oauth/google-url")
def get_google_oauth_url(current_user: User = Depends(get_current_user)):
    """Generate Google OAuth URL for connecting a Gmail mailbox."""
    if not settings.google_client_id:
        raise HTTPException(400, "GOOGLE_CLIENT_ID not configured in environment")
    state = secrets.token_urlsafe(16)
    _state_store[state] = current_user.id
    scope = "email profile https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly"
    url = (
        f"https://accounts.google.com/o/oauth2/v2/auth"
        f"?client_id={settings.google_client_id}"
        f"&redirect_uri={settings.google_redirect_uri}"
        f"&response_type=code"
        f"&scope={scope}"
        f"&access_type=offline"
        f"&prompt=consent"
        f"&state={state}"
    )
    return {"url": url}


@router.get("/oauth/google-callback")
async def google_callback(code: str, state: str, db: Session = Depends(get_db)):
    """Handle Google OAuth callback and store refresh token."""
    user_id = _state_store.get(state)
    if not user_id:
        raise HTTPException(400, "Invalid or expired OAuth state")
    del _state_store[state]

    import httpx
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "redirect_uri": settings.google_redirect_uri,
                "grant_type": "authorization_code",
            },
        )
    token_data = resp.json()
    if "error" in token_data:
        raise HTTPException(400, f"OAuth error: {token_data.get('error_description', token_data['error'])}")

    refresh_token = token_data.get("refresh_token", "")
    access_token = token_data.get("access_token", "")

    # Get user email
    async with httpx.AsyncClient() as client:
        info_resp = await client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )
    user_info = info_resp.json()
    email = user_info.get("email", "")
    name = user_info.get("name", email)

    if not email:
        raise HTTPException(400, "Could not retrieve email from Google")

    # Encrypt and store
    from services.encryption import encrypt
    enc_token = encrypt(refresh_token)

    existing = db.query(Mailbox).filter(Mailbox.email == email).first()
    if existing:
        existing.oauth_refresh_token_enc = enc_token
        existing.display_name = name
        existing.is_active = True
        existing.user_id = user_id
    else:
        db.add(Mailbox(email=email, display_name=name, oauth_refresh_token_enc=enc_token, user_id=user_id))
    db.commit()

    from fastapi.responses import RedirectResponse
    # Redirect to frontend
    frontend = settings.frontend_url
    return RedirectResponse(url=f"{frontend}/mailboxes?success=true")


@router.delete("/{mailbox_id}")
def remove_mailbox(mailbox_id: str, db: Session = Depends(get_db), _=Depends(get_current_user)):
    m = db.query(Mailbox).filter(Mailbox.id == mailbox_id).first()
    if not m:
        raise HTTPException(404, "Mailbox not found")
    db.delete(m)
    db.commit()
    return {"ok": True}


@router.patch("/{mailbox_id}/toggle")
def toggle_mailbox(mailbox_id: str, db: Session = Depends(get_db), _=Depends(get_current_user)):
    m = db.query(Mailbox).filter(Mailbox.id == mailbox_id).first()
    if not m:
        raise HTTPException(404, "Mailbox not found")
    m.is_active = not m.is_active
    db.commit()
    return {"ok": True, "is_active": m.is_active}
