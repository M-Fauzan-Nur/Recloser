"""User storage.

JSON file `backend/data/users.json`. Bootstrap admin (admin/admin123) and
operator1 (operator123) on first initialization. Passwords stored as bcrypt
hashes; never plaintext.

Schema:
    {
      "username": str,
      "password_hash": str,   # bcrypt hash, never plaintext; null for Google accounts
      "role": "admin" | "user",
      "created_at": iso8601,
      "full_name": str | null,
      "email": str | null,
      "provider": "local" | "google",
      "google_sub": str | null   # Google "sub" claim
    }
"""
from __future__ import annotations

import json
import threading
from datetime import datetime, timezone
from pathlib import Path

from passlib.context import CryptContext

_BACKEND_DIR = Path(__file__).resolve().parents[1]
_DATA_DIR = _BACKEND_DIR / "data"
_DATA_FILE = _DATA_DIR / "users.json"

_lock = threading.Lock()
_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")

DEFAULT_USERS = [
    {"username": "admin", "password": "admin123", "role": "admin"},
    {"username": "operator1", "password": "operator123", "role": "user"},
]


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _bootstrap_users() -> None:
    """Create users.json with default users if missing.

    Default password is hashed with bcrypt on first run; plaintext is never
    persisted. The file stores hashes only.
    """
    _DATA_DIR.mkdir(parents=True, exist_ok=True)
    records = []
    now = _now_iso()
    for u in DEFAULT_USERS:
        records.append({
            "username": u["username"],
            "password_hash": _pwd.hash(u["password"]),
            "role": u["role"],
            "created_at": now,
            "full_name": None,
            "email": None,
            "provider": "local",
            "google_sub": None,
        })
    _DATA_FILE.write_text(json.dumps(records, indent=2, ensure_ascii=False), encoding="utf-8")


def _ensure() -> None:
    if not _DATA_FILE.exists():
        _bootstrap_users()


def _read_all() -> list:
    _ensure()
    with _DATA_FILE.open("r", encoding="utf-8") as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return []


def _write_all(users: list) -> None:
    import os
    tmp = _DATA_FILE.with_suffix(".json.tmp")
    with tmp.open("w", encoding="utf-8") as f:
        json.dump(users, f, indent=2, ensure_ascii=False)
    os.replace(tmp, _DATA_FILE)


def find_user(username: str):
    for u in _read_all():
        if u.get("username") == username:
            return u
    return None


def verify_password(plain: str, hashed: str) -> bool:
    if not hashed:
        return False
    try:
        return _pwd.verify(plain, hashed)
    except Exception:
        return False


def _ensure_user_present(username: str, password: str, role: str) -> bool:
    """If `username` not in users.json, append it (with bcrypt-hashed password).

    Returns True if the user was added or already present.
    """
    users = _read_all()
    if any(u.get("username") == username for u in users):
        return True
    users.append({
        "username": username,
        "password_hash": _pwd.hash(password),
        "role": role,
        "created_at": _now_iso(),
        "full_name": None,
        "email": None,
        "provider": "local",
        "google_sub": None,
    })
    _write_all(users)
    return True


def find_by_email(email: str):
    """Find a user by email address."""
    for u in _read_all():
        if u.get("email") == email:
            return u
    return None


def find_by_google_sub(sub: str):
    """Find a user by Google subject ID."""
    for u in _read_all():
        if u.get("google_sub") == sub:
            return u
    return None


def create_user(
    username: str,
    password: str,
    full_name: str,
    email: str,
    role: str = "user",
) -> dict:
    """Create a new local user. Raises ValueError if username or email exists."""
    users = _read_all()
    if any(u.get("username") == username for u in users):
        raise ValueError("Username sudah digunakan")
    if any(u.get("email") == email for u in users):
        raise ValueError("Email sudah digunakan")
    now = _now_iso()
    new_user = {
        "username": username,
        "password_hash": _pwd.hash(password),
        "role": role,
        "created_at": now,
        "full_name": full_name,
        "email": email,
        "provider": "local",
        "google_sub": None,
    }
    users.append(new_user)
    _write_all(users)
    # Return without password_hash
    return {k: v for k, v in new_user.items() if k != "password_hash"}


def create_google_user(
    google_sub: str,
    email: str,
    full_name: str,
    role: str = "user",
) -> dict:
    """Create or return a Google user. Raises ValueError if email is already used by a local account."""
    existing = find_by_google_sub(google_sub)
    if existing:
        return {k: v for k, v in existing.items() if k != "password_hash"}

    # Check if email is taken by a local account
    email_user = find_by_email(email)
    if email_user and email_user.get("provider") == "local":
        raise ValueError("Akun dengan email ini sudah terdaftar. Silakan login dengan password.")

    users = _read_all()
    # Check if email already exists (another Google account)
    if any(u.get("email") == email for u in users):
        raise ValueError("Akun dengan email ini sudah terdaftar.")

    now = _now_iso()
    # Use local part of email as username
    base_username = email.split("@")[0]
    username = base_username
    counter = 1
    while any(u.get("username") == username for u in users):
        username = f"{base_username}{counter}"
        counter += 1

    new_user = {
        "username": username,
        "password_hash": None,
        "role": role,
        "created_at": now,
        "full_name": full_name,
        "email": email,
        "provider": "google",
        "google_sub": google_sub,
    }
    users.append(new_user)
    _write_all(users)
    return {k: v for k, v in new_user.items() if k != "password_hash"}


def ensure_bootstrap() -> None:
    """Public hook for startup. Idempotent + additive.

    If users.json missing -> create with all DEFAULT_USERS.
    If users.json exists but missing any DEFAULT_USER -> append that user.
    """
    if not _DATA_FILE.exists():
        _bootstrap_users()
        return
    # Additive: ensure every DEFAULT_USER is present (admin + operator1).
    for u in DEFAULT_USERS:
        _ensure_user_present(u["username"], u["password"], u["role"])