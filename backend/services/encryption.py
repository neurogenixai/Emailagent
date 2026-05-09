"""
Encryption Service — for storing OAuth refresh tokens securely
"""
import os
import base64
from cryptography.fernet import Fernet


def _get_fernet() -> Fernet:
    key = os.getenv("ENCRYPTION_KEY", "")
    if not key:
        # Generate a default key (not secure for production — set ENCRYPTION_KEY in ENV)
        key = base64.urlsafe_b64encode(b"neurogenix_email_agent_key_32byt")
    # Ensure it's a valid Fernet key (32 bytes base64)
    try:
        return Fernet(key.encode() if isinstance(key, str) else key)
    except Exception:
        # Fallback: derive a valid key
        import hashlib
        raw = hashlib.sha256(key.encode()).digest()
        valid_key = base64.urlsafe_b64encode(raw)
        return Fernet(valid_key)


def encrypt(plaintext: str) -> str:
    if not plaintext:
        return ""
    return _get_fernet().encrypt(plaintext.encode()).decode()


def decrypt(ciphertext: str) -> str:
    if not ciphertext:
        return ""
    return _get_fernet().decrypt(ciphertext.encode()).decode()
