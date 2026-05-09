"""
Auth router — login/logout/me
"""
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database import get_db
from user_model import User
from auth import verify_password, create_token, decode_token
from config import settings
from google.oauth2 import id_token
from google.auth.transport import requests
import uuid

router = APIRouter(prefix="/auth", tags=["Auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

class GoogleToken(BaseModel):
    token: str


class Token(BaseModel):
    access_token: str
    token_type: str
    user: dict


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload = decode_token(token)
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = db.query(User).filter(User.id == user_id).first()
        if not user or not user.is_active:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


@router.post("/login", response_model=Token)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form.username).first()
    if not user or not verify_password(form.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled")
    token = create_token({"sub": user.id, "email": user.email, "role": user.role})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": user.id, "email": user.email, "full_name": user.full_name, "role": user.role},
    }

@router.post("/google", response_model=Token)
def google_login(payload: GoogleToken, db: Session = Depends(get_db)):
    try:
        # Verify the Google token
        idinfo = id_token.verify_oauth2_token(
            payload.token, 
            requests.Request(), 
            settings.google_client_id
        )
        email = idinfo.get('email')
        full_name = idinfo.get('name')
        
        if not email:
            raise HTTPException(status_code=400, detail="Google token missing email")

        # Check if user exists
        user = db.query(User).filter(User.email == email).first()
        
        if not user:
            # Auto-create user for any valid Google login (or restrict to super_admin_email)
            user = User(
                email=email,
                full_name=full_name,
                password_hash=str(uuid.uuid4()), # Impossible to login via normal password
                role="admin" if email in [settings.super_admin_email, settings.approver_email] else "client"
            )
            db.add(user)
            db.commit()
            db.refresh(user)

        if not user.is_active:
            raise HTTPException(status_code=403, detail="Account is disabled")

        # Generate our own internal JWT
        token = create_token({"sub": user.id, "email": user.email, "role": user.role})
        return {
            "access_token": token,
            "token_type": "bearer",
            "user": {"id": user.id, "email": user.email, "full_name": user.full_name, "role": user.role},
        }
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid Google token")

@router.get("/me")
def me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "role": current_user.role,
    }
