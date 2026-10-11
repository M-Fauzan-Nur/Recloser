"""Manual fault data input storage (Tahap 9 — fixed, Tahap 15 — auth ownership).

Stores user-entered fault records in a local JSON file. Completely separate
from the research CSVs under scenario_* — never reads, never writes, never
imports them. No LSTM training, no ABC run is triggered by any CRUD here.

Schema: line_id, timestamp, fault_type, faktor_penyebab, penyebab_gangguan,
description, reported_by (= username of creator), affected_customers,
duration_hours, source (= "manual"), id, created_at, updated_at,
created_by_username (internal).

Auth:
- GET requires authentication (any role).
- POST requires authentication; reported_by & created_by_username auto-filled
  from JWT.
- PUT/DELETE require authentication; admin can edit/delete any record, user
  can only edit/delete records they created.
"""
from __future__ import annotations

import json
import os
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator

from .auth import get_current_user

_BACKEND_DIR = Path(__file__).resolve().parents[1]
_DATA_DIR = _BACKEND_DIR / "data"
_DATA_FILE = _DATA_DIR / "manual_faults.json"

_lock = threading.Lock()

FAULT_TYPES = ("temporary", "permanent")
_LINE_MIN, _LINE_MAX = 1, 68

FAKTOR_PENYEBAB = ("Cuaca", "Peralatan", "Hewan", "Risiko")

PENYEBAB_BY_FAKTOR = {
    "Cuaca":      ["Hujan lebat", "Petir", "Angin kencang", "Pohon tumbang"],
    "Peralatan":  ["Kerusakan isolator", "Gangguan konduktor", "Kerusakan peralatan"],
    "Hewan":      ["Hewan menyentuh jaringan", "Hewan masuk gardu"],
    "Risiko":     ["Kondisi jaringan tua", "Vegetasi dekat jaringan", "Kondisi lingkungan jaringan"],
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _ensure_file() -> None:
    _DATA_DIR.mkdir(parents=True, exist_ok=True)
    if not _DATA_FILE.exists():
        _atomic_write([])


def _atomic_write(faults: List[dict]) -> None:
    tmp = _DATA_FILE.with_suffix(".json.tmp")
    with tmp.open("w", encoding="utf-8") as f:
        json.dump(faults, f, indent=2, ensure_ascii=False)
    os.replace(tmp, _DATA_FILE)


def _read_all() -> List[dict]:
    _ensure_file()
    with _DATA_FILE.open("r", encoding="utf-8") as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return []


class FaultIn(BaseModel):
    line_id: int = Field(..., description="1..68")
    timestamp: str = Field(..., description="ISO date YYYY-MM-DD")
    fault_type: str = Field(..., description="temporary | permanent")
    faktor_penyebab: str = Field(..., description="Cuaca | Peralatan | Hewan | Risiko")
    penyebab_gangguan: str = Field(..., description="Must match a value in PENYEBAB_BY_FAKTOR[faktor_penyebab]")
    description: str = Field(..., min_length=3)
    affected_customers: int = Field(..., ge=0)
    duration_hours: float = Field(..., ge=0.0)

    @field_validator("line_id")
    @classmethod
    def _check_line(cls, v: int) -> int:
        if not (_LINE_MIN <= v <= _LINE_MAX):
            raise ValueError(f"line_id must be between {_LINE_MIN} and {_LINE_MAX}")
        return v

    @field_validator("fault_type")
    @classmethod
    def _check_fault_type(cls, v: str) -> str:
        if v not in FAULT_TYPES:
            raise ValueError(f"fault_type must be one of {FAULT_TYPES}")
        return v

    @field_validator("faktor_penyebab")
    @classmethod
    def _check_faktor(cls, v: str) -> str:
        if v not in FAKTOR_PENYEBAB:
            raise ValueError(f"faktor_penyebab must be one of {FAKTOR_PENYEBAB}")
        return v

    @field_validator("penyebab_gangguan")
    @classmethod
    def _check_penyebab(cls, v: str, info) -> str:
        faktor = info.data.get("faktor_penyebab")
        allowed = PENYEBAB_BY_FAKTOR.get(faktor, [])
        if v not in allowed:
            raise ValueError(
                f"penyebab_gangguan '{v}' is not valid for faktor '{faktor}'. Allowed: {allowed}"
            )
        return v

    @field_validator("timestamp")
    @classmethod
    def _check_timestamp(cls, v: str) -> str:
        datetime.strptime(v, "%Y-%m-%d")
        return v


class Fault(FaultIn):
    id: str
    source: str = "manual"
    created_by_username: str
    reported_by: str
    created_at: str
    updated_at: str


router = APIRouter()


def _visible_for(faults: list, user: dict) -> list:
    """Filter records visible to user (admin sees all; user sees own)."""
    if user["role"] == "admin":
        return faults
    return [f for f in faults if f.get("created_by_username") == user["username"]]


def _check_modify_right(fault: dict, user: dict) -> None:
    """Raise 403 if user is not admin AND did not create the fault."""
    if user["role"] == "admin":
        return
    if fault.get("created_by_username") != user["username"]:
        raise HTTPException(
            status_code=403,
            detail="You can only modify your own fault records",
        )


@router.get("/api/manual-faults")
def list_faults(user: dict = Depends(get_current_user)):
    with _lock:
        all_faults = _read_all()
    return {"faults": _visible_for(all_faults, user)}


@router.post("/api/manual-faults", status_code=201)
def create_fault(payload: FaultIn, user: dict = Depends(get_current_user)):
    now = _now_iso()
    rec = {
        "id": str(uuid.uuid4()),
        "line_id": payload.line_id,
        "timestamp": payload.timestamp,
        "fault_type": payload.fault_type,
        "faktor_penyebab": payload.faktor_penyebab,
        "penyebab_gangguan": payload.penyebab_gangguan,
        "description": payload.description,
        "reported_by": user["username"],
        "created_by_username": user["username"],
        "affected_customers": payload.affected_customers,
        "duration_hours": payload.duration_hours,
        "source": "manual",
        "created_at": now,
        "updated_at": now,
    }
    with _lock:
        faults = _read_all()
        faults.append(rec)
        _atomic_write(faults)
    return {"fault": rec}


@router.put("/api/manual-faults/{fault_id}")
def update_fault(fault_id: str, payload: FaultIn, user: dict = Depends(get_current_user)):
    with _lock:
        faults = _read_all()
        existing = next((f for f in faults if f["id"] == fault_id), None)
        if existing is None:
            raise HTTPException(status_code=404, detail=f"Fault not found: {fault_id}")
        _check_modify_right(existing, user)
        now = _now_iso()
        rec = {
            "id": fault_id,
            "line_id": payload.line_id,
            "timestamp": payload.timestamp,
            "fault_type": payload.fault_type,
            "faktor_penyebab": payload.faktor_penyebab,
            "penyebab_gangguan": payload.penyebab_gangguan,
            "description": payload.description,
            "reported_by": existing.get("reported_by", user["username"]),
            "created_by_username": existing.get("created_by_username", user["username"]),
            "affected_customers": payload.affected_customers,
            "duration_hours": payload.duration_hours,
            "source": "manual",
            "created_at": existing.get("created_at", now),
            "updated_at": now,
        }
        # Replace by index (preserves order)
        for i, f in enumerate(faults):
            if f["id"] == fault_id:
                faults[i] = rec
                break
        _atomic_write(faults)
    return {"fault": rec}


@router.delete("/api/manual-faults/{fault_id}")
def delete_fault(fault_id: str, user: dict = Depends(get_current_user)):
    with _lock:
        faults = _read_all()
        existing = next((f for f in faults if f["id"] == fault_id), None)
        if existing is None:
            raise HTTPException(status_code=404, detail=f"Fault not found: {fault_id}")
        _check_modify_right(existing, user)
        faults = [f for f in faults if f["id"] != fault_id]
        _atomic_write(faults)
    return {"deleted": fault_id}


@router.get("/api/manual-faults/stats")
def fault_stats(user: dict = Depends(get_current_user)):
    with _lock:
        all_faults = _read_all()
    visible = _visible_for(all_faults, user)
    by_faktor = {k: 0 for k in FAKTOR_PENYEBAB}
    by_fault_type = {"temporary": 0, "permanent": 0}
    for f in visible:
        fk = f.get("faktor_penyebab")
        if fk in by_faktor:
            by_faktor[fk] += 1
        ft = f.get("fault_type")
        if ft in by_fault_type:
            by_fault_type[ft] += 1
    return {"total": len(visible), "by_faktor": by_faktor, "by_fault_type": by_fault_type}