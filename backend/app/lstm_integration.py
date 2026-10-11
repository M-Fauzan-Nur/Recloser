"""Integration layer for the research LSTM engine (scenario_a_website/lstm_train.py).

Provides two public functions:
  - predict_from_dataset(dataset_path) : run LSTM inference on a user-uploaded CSV
  - prepare_abc_input(rows, dataset_df) : merge LSTM output with yearly aggregates

The research file is loaded via importlib and reused verbatim.
No scenario logic — all data comes from user uploads.
"""

from __future__ import annotations

import contextlib
import importlib.util
import io
import tempfile
from pathlib import Path
from threading import Lock
from typing import Any, Dict

import pandas as pd

from .scenarios import (
    LSTM_BASE_FEATURES,
    LSTM_CORE_COLS,
    LSTM_META_COLS,
    LSTM_SEQUENCE_LENGTH,
)

_REQUIRED_COLS = LSTM_CORE_COLS  # validate only the columns LSTM engine actually reads


def _normalize_columns(df):
    """Rename raw/v7 column names to canonical synthetic_* names.

    Supports both:
      - v7 datasets: lambda_monthly, failure_probability, outage_duration, repair_duration
      - existing scenario datasets: already canonical (synthetic_*)
    """
    from .scenarios import COLUMN_ALIASES
    rename = {}
    for canonical, aliases in COLUMN_ALIASES.items():
        for alias in aliases:
            if alias in df.columns and alias != canonical:
                rename[alias] = canonical
                break
    if rename:
        df = df.rename(columns=rename)
    return df


# Path to the bundled research LSTM engine
_RESEARCH_LSTM_FILE = Path(__file__).resolve().parents[1] / "research" / "lstm_train.py"


_PRIVATE_MOD_NAME = "_lstm_research_module"
_research_mod = None
_import_lock = Lock()


def _load_research_module():
    global _research_mod
    if _research_mod is not None:
        return _research_mod
    with _import_lock:
        if _research_mod is not None:
            return _research_mod
        spec = importlib.util.spec_from_file_location(_PRIVATE_MOD_NAME, _RESEARCH_LSTM_FILE)
        if spec is None or spec.loader is None:
            raise RuntimeError(f"Cannot load spec from {_RESEARCH_LSTM_FILE}")
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
    _research_mod = mod
    return _research_mod


def predict_from_dataset(dataset_path: Path) -> dict:
    """Run LSTM inference on a user-uploaded dataset CSV.

    Uses the original LSTMGangguanPredictor from lstm_train.py.
    The model is trained on-the-fly from the uploaded dataset.

    Args:
        dataset_path: Path to a CSV file with LSTM_REQUIRED_COLS columns.

    Returns:
        dict with keys:
            source: "live" | "error"
            rows: list of {line_id, from_bus, to_bus, pola_gangguan}
            data_rows_used: int
            preview_rows: first 5 rows
            total_rows: int
            error: str or None
            model_info: str
    """
    try:
        research = _load_research_module()
        DataProcessor = research.DataProcessor
        DirectLSTM = research.DirectLSTM
    except Exception as e:
        return {
            "source": "error",
            "rows": [],
            "data_rows_used": 0,
            "preview_rows": [],
            "total_rows": 0,
            "error": f"Failed to import LSTM engine: {e}",
            "model_info": None,
        }

    # Load raw data
    try:
        df_raw = pd.read_csv(dataset_path)
    except Exception as e:
        return {
            "source": "error",
            "rows": [],
            "data_rows_used": 0,
            "preview_rows": [],
            "total_rows": 0,
            "error": f"Failed to read dataset CSV: {e}",
            "model_info": None,
        }

    # Normalize v7/raw column names to canonical synthetic_* names
    df_raw = _normalize_columns(df_raw)

    # Validate required columns
    missing = [c for c in _REQUIRED_COLS if c not in df_raw.columns]
    if missing:
        return {
            "source": "error",
            "rows": [],
            "data_rows_used": 0,
            "preview_rows": [],
            "total_rows": 0,
            "error": f"Dataset missing required columns: {missing}",
            "model_info": None,
        }

    # Validate enough data for sequences
    df_raw["timestamp"] = pd.to_datetime(df_raw["timestamp"])
    df_raw = df_raw.sort_values(["line_id", "timestamp"]).reset_index(drop=True)

    line_counts = df_raw.groupby("line_id").size()
    eligible_lines = line_counts[line_counts >= LSTM_SEQUENCE_LENGTH]
    if len(eligible_lines) == 0:
        return {
            "source": "error",
            "rows": [],
            "data_rows_used": 0,
            "preview_rows": [],
            "total_rows": 0,
            "error": (
                f"Each line needs at least {LSTM_SEQUENCE_LENGTH} monthly records "
                "for LSTM prediction. No line meets this requirement."
            ),
            "model_info": None,
        }

    # Build and train the LSTM model using the original engine
    try:
        processor = DataProcessor()
        scaler = processor.scaler

        # Fit scaler on the uploaded dataset
        df_norm = df_raw.copy()
        df_norm[LSTM_BASE_FEATURES] = scaler.fit_transform(df_raw[LSTM_BASE_FEATURES])

        # Create and train the model using the original engine
        model = DirectLSTM(n_features=processor.n_features)

        # Create sequences from normalized data
        sequences, targets, line_ids, timestamps = processor.create_sequences(
            df_norm, LSTM_SEQUENCE_LENGTH
        )

        if len(sequences) == 0:
            return {
                "source": "error",
                "rows": [],
                "data_rows_used": len(df_norm),
                "preview_rows": [],
                "total_rows": 0,
                "error": "Not enough sequence data for training.",
                "model_info": None,
            }

        # Train the model (original engine, original hyperparameters)
        print(f"[LSTM] Training on {len(sequences)} sequences...")
        history, metrics = model.train(df_norm)
        print(f"[LSTM] Training complete: {metrics}")

    except Exception as e:
        return {
            "source": "error",
            "rows": [],
            "data_rows_used": 0,
            "preview_rows": [],
            "total_rows": 0,
            "error": f"LSTM training failed: {e}",
            "model_info": None,
        }

    # Predict on all eligible lines using the last sequence per line
    rows = []
    for line_id in eligible_lines.index:
        line_data = df_norm[df_norm["line_id"] == line_id].sort_values("timestamp")
        if len(line_data) < LSTM_SEQUENCE_LENGTH:
            continue

        seq = line_data[LSTM_BASE_FEATURES].iloc[-LSTM_SEQUENCE_LENGTH:].values
        latest = line_data.iloc[-1]

        X_pred = seq.reshape(1, LSTM_SEQUENCE_LENGTH, processor.n_features)
        pred = float(model.predict(X_pred)[0])

        rows.append({
            "line_id": int(line_id),
            "from_bus": int(latest["from_bus"]),
            "to_bus": int(latest["to_bus"]),
            "pola_gangguan": pred,
        })

    rows.sort(key=lambda r: r["line_id"])

    return {
        "source": "live",
        "rows": rows,
        "data_rows_used": len(df_norm),
        "preview_rows": rows[:5],
        "total_rows": len(rows),
        "error": None,
        "model_info": f"lstm_train (trained on {len(df_norm)} rows, {len(sequences)} sequences)",
    }


def prepare_abc_input(lstm_rows: list, dataset_df: pd.DataFrame) -> pd.DataFrame:
    """Build the ABC input DataFrame from LSTM output + yearly aggregates.

    For each line_id:
      - pola_gangguan from LSTM rows
      - from_bus, to_bus from LSTM rows
      - num_customers, total_downstream_customers, downstream_buses from dataset's latest row
      - synthetic_lambda_yearly  = sum of synthetic_lambda_monthly
      - synthetic_outage_duration_yearly = sum of synthetic_outage_duration

    Note: load_demand, level_topology, total_downstream_load are NOT required
    by the ABC engine and are not included.

    Args:
        lstm_rows: list of {line_id, from_bus, to_bus, pola_gangguan}
        dataset_df: full monthly dataset DataFrame (columns should already be normalized)

    Returns:
        pd.DataFrame with ABC_REQUIRED_COLS columns
    """
    from .scenarios import ABC_REQUIRED_COLS

    lstm_df = pd.DataFrame(lstm_rows)

    # Yearly aggregates per line
    yearly = (
        dataset_df.groupby("line_id")
        .agg(
            synthetic_lambda_yearly=("synthetic_lambda_monthly", "sum"),
            synthetic_outage_duration_yearly=("synthetic_outage_duration", "sum"),
        )
        .reset_index()
    )

    # Latest row per line — only the columns ABC actually reads
    latest = (
        dataset_df.sort_values(["line_id", "timestamp"])
        .groupby("line_id")
        .last()
        .reset_index()
    )

    # Merge only what ABC needs (lstm_df already has from_bus/to_bus)
    abc_df = lstm_df.merge(
        latest[["line_id", "num_customers", "total_downstream_customers", "downstream_buses"]],
        on="line_id",
        how="left",
    )
    abc_df = abc_df.merge(yearly, on="line_id", how="left")

    # Select and order required columns
    abc_df = abc_df[ABC_REQUIRED_COLS]

    return abc_df
