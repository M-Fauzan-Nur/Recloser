"""Authentication.

JWT bearer token + OAuth2PasswordBearer. Password bcrypt via users.py.

Endpoints:
- POST /api/auth/login     → form (username, password) → JWT
- POST /api/auth/register  → json (full_name, email, username, password, confirm_password) → JWT
- POST /api/auth/google/init     → {} → {url}
- GET  /api/auth/google/callback  → code, state → redirect to frontend with token
- GET  /api/auth/me       → {username, role}

Dependencies:
- get_current_user  → raises 401 if no/invalid token
- require_admin      → raises 403 if role != admin
"""
from __future__ import annotations

import json
import os
import re
import secrets
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, Form, HTTPException, Query, Request
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt

from .users import (
    create_google_user,
    create_user,
    find_user,
    verify_password,
)

JWT_SECRET = os.environ.get("RECLOSER_JWT_SECRET", "dev-secret-change-in-production")
JWT_ALG = "HS256"
JWT_EXP_HOURS = 8

oauth2 = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=True)
router = APIRouter()

# Load .env file from backend/ directory
_dotenv_path = Path(__file__).resolve().parents[1] / ".env"
load_dotenv(_dotenv_path)

# In-memory state store for Google OAuth CSRF protection
# key = state, value = {"created_at": timestamp}
_oauth_states: dict[str, dict] = {}


def create_access_token(username: str, role: str) -> str:
    exp = datetime.now(timezone.utc) + timedelta(hours=JWT_EXP_HOURS)
    return jwt.encode(
        {"sub": username, "role": role, "exp": exp},
        JWT_SECRET,
        algorithm=JWT_ALG,
    )


def get_current_user(token: str = Depends(oauth2)) -> dict:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        username = payload.get("sub")
        role = payload.get("role")
        if not username or not role:
            raise HTTPException(status_code=401, detail="Invalid token payload")
        return {"username": username, "role": role}
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")
    return user


@router.post("/api/auth/login")
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user = find_user(form_data.username)
    if not user or not verify_password(form_data.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token(user["username"], user["role"])
    return {
        "access_token": token,
        "token_type": "bearer",
        "role": user["role"],
        "username": user["username"],
        "full_name": user.get("full_name"),
        "email": user.get("email"),
    }


def _valid_email(email: str) -> bool:
    return bool(re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email))


@router.post("/api/auth/register")
def register(
    username: str = Form(...),
    password: str = Form(...),
    confirm_password: str = Form(...),
    full_name: str = Form(...),
    email: str = Form(...),
):
    """Register a new local account. All new accounts get role 'admin' for full access."""
    # Validate
    if not username or len(username) < 3:
        raise HTTPException(400, "Username minimal 3 karakter")
    if len(password) < 6:
        raise HTTPException(400, "Password minimal 6 karakter")
    if password != confirm_password:
        raise HTTPException(400, "Password dan konfirmasi password tidak cocok")
    if not full_name or len(full_name.strip()) < 2:
        raise HTTPException(400, "Nama lengkap minimal 2 karakter")
    if not _valid_email(email):
        raise HTTPException(400, "Format email tidak valid")
    if not re.match(r"^[a-zA-Z0-9_.-]+$", username):
        raise HTTPException(400, "Username hanya boleh huruf, angka, titik, underscore, dan strip")

    try:
        user = create_user(
            username=username.strip(),
            password=password,
            full_name=full_name.strip(),
            email=email.strip().lower(),
            role="admin",  # all new accounts get admin access
        )
    except ValueError as e:
        raise HTTPException(400, str(e))

    token = create_access_token(user["username"], user["role"])
    return {
        "access_token": token,
        "token_type": "bearer",
        "role": user["role"],
        "username": user["username"],
        "full_name": user.get("full_name"),
        "email": user.get("email"),
    }


# ---------------------------------------------------------------------------
# Google OAuth
# ---------------------------------------------------------------------------

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = os.environ.get(
    "GOOGLE_REDIRECT_URI", "http://localhost:8000/api/auth/google/callback"
)
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173")


@router.get("/api/auth/google/config")
def google_config():
    """Return whether Google OAuth is configured."""
    return {"enabled": bool(GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET)}


@router.post("/api/auth/google/init")
def google_init():
    """Return Google OAuth authorization URL."""
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(503, "Google OAuth belum dikonfigurasi. Hubungi administrator.")

    state = secrets.token_urlsafe(32)
    _oauth_states[state] = {"created_at": datetime.now(timezone.utc).isoformat()}

    # Clean up old states (older than 10 minutes)
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=10)
    for k, v in list(_oauth_states.items()):
        if datetime.fromisoformat(v["created_at"]) < cutoff:
            del _oauth_states[k]

    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "online",
        "state": state,
    }
    url = "https://accounts.google.com/o/oauth2/v2/auth?" + urllib.parse.urlencode(params)
    return {"url": url}


@router.get("/api/auth/google/callback")
def google_callback(request: Request, code: str = Query(...), state: str = Query(...)):
    """Handle Google OAuth callback."""
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(503, "Google OAuth belum dikonfigurasi")

    # Validate state
    if state not in _oauth_states:
        raise HTTPException(400, "State tidak valid atau sudah kadaluarsa")
    del _oauth_states[state]

    # Exchange code for tokens
    token_data = {
        "code": code,
        "client_id": GOOGLE_CLIENT_ID,
        "client_secret": GOOGLE_CLIENT_SECRET,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "grant_type": "authorization_code",
    }
    try:
        req = urllib.request.Request(
            "https://oauth2.googleapis.com/token",
            data=urllib.parse.urlencode(token_data).encode(),
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            token_resp = json.loads(resp.read())
    except Exception as e:
        raise HTTPException(502, f"Gagal mengambil token dari Google: {e}")

    id_token = token_resp.get("id_token")
    if not id_token:
        raise HTTPException(502, "Google tidak mengembalikan ID token")

    # Verify ID token and extract user info
    try:
        # Fetch Google's public keys (JWKS)
        jwks_req = urllib.request.Request("https://www.googleapis.com/oauth2/v3/certs")
        with urllib.request.urlopen(jwks_req, timeout=10) as resp:
            jwks = json.loads(resp.read())

        # Decode header to get kid
        unverified_header = jwt.get_unverified_header(id_token)
        kid = unverified_header.get("kid")

        # Find matching key
        rsa_key = None
        for key in jwks.get("keys", []):
            if key.get("kid") == kid:
                rsa_key = {
                    "kty": key["kty"],
                    "kid": key["kid"],
                    "use": key.get("use"),
                    "n": key["n"],
                    "e": key["e"],
                }
                break

        if not rsa_key:
            raise HTTPException(401, "Kunci publik Google tidak ditemukan")

        # Verify the token
        payload = jwt.decode(
            id_token,
            rsa_key,
            algorithms=["RS256"],
            audience=GOOGLE_CLIENT_ID,
            options={"verify_iss": True, "verify_aud": True},
        )

        google_sub = payload.get("sub", "")
        email = payload.get("email", "")
        full_name = payload.get("name", "")

        if not google_sub or not email:
            raise HTTPException(401, "Google tidak mengembalikan informasi yang diperlukan")

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(401, f"Verifikasi ID token Google gagal: {e}")

    # Create or retrieve user
    try:
        user = create_google_user(
            google_sub=google_sub,
            email=email,
            full_name=full_name or email.split("@")[0],
            role="admin",  # all Google accounts get admin access
        )
    except ValueError as e:
        raise HTTPException(400, str(e))

    token = create_access_token(user["username"], user["role"])

    # Redirect to frontend with token
    # Frontend URL: http://localhost:5173/auth/google/callback?token=xxx&username=xxx&role=xxx&full_name=xxx&email=xxx
    query = urllib.parse.urlencode({
        "token": token,
        "username": user["username"],
        "role": user["role"],
        "full_name": user.get("full_name") or "",
        "email": user.get("email") or "",
    })
    redirect_url = f"{FRONTEND_URL}/auth/google/callback?{query}"

    # Return redirect instead of using Response redirect (to avoid strict origin check)
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url=redirect_url, status_code=302)


@router.get("/api/auth/me")
def me(user: dict = Depends(get_current_user)):
    return user