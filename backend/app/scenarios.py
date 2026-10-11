"""Shared constants and paths for the pipeline-based backend.

Scenario A-E logic has been removed. The research engine files are still
referenced by path so their algorithms can be loaded via importlib.
"""

from pathlib import Path

# Resolve project root: this file lives in app/
#   parents[0] = app/
#   parents[1] = backend/
#   parents[2] = recloser-research-web/
#   parents[3] = Pengujian_penelitian/
PROJECT_ROOT = Path(__file__).resolve().parents[3]

# Path to trained LSTM artifacts (model.keras + scaler.pkl).
# Layout: backend/lstm_artifacts/model.keras, backend/lstm_artifacts/scaler.pkl
# (single pair, not per-scenario — trained on IEEE 69-bus system)
ARTIFACTS_DIR = Path(__file__).resolve().parents[1] / "lstm_artifacts"

# LSTM feature columns required for inference
# (metadata columns + computed/risk factor columns)
LSTM_META_COLS = ["timestamp", "year", "month", "line_id"]
LSTM_BASE_FEATURES = [
    "base_failure_rate",
    "risk_factor",
    "equipment_age_factor",
    "animal_factor",
    "weather_factor",
    "synthetic_lambda_monthly",
    "synthetic_failure_probability",
    "synthetic_outage_duration",
    "synthetic_repair_duration",
]
LSTM_REQUIRED_COLS = LSTM_META_COLS + LSTM_BASE_FEATURES + [
    "from_bus",
    "to_bus",
    "load_demand",
    "num_customers",
    "downstream_buses",
    "level_topology",
    "total_downstream_load",
    "total_downstream_customers",
    "synthetic_failure_type",
]
LSTM_SEQUENCE_LENGTH = 12

# ABC engine requires these columns in the LSTM output (merged with yearly aggregates)
ABC_REQUIRED_COLS = [
    "line_id",
    "from_bus",
    "to_bus",
    "synthetic_lambda_yearly",
    "synthetic_outage_duration_yearly",
    "num_customers",
    "total_downstream_customers",
    "downstream_buses",
    "pola_gangguan",
]

# Column aliases: canonical (engine-expected) name → list of possible names in uploaded datasets.
# The adapter renames raw/v7 names to canonical synthetic_* names.
# Works for both v7 datasets (raw names) and existing scenario datasets (already canonical).
COLUMN_ALIASES = {
    "synthetic_lambda_monthly":      ["synthetic_lambda_monthly", "lambda_monthly"],
    "synthetic_failure_probability": ["synthetic_failure_probability", "failure_probability"],
    "synthetic_outage_duration":     ["synthetic_outage_duration", "outage_duration"],
    "synthetic_repair_duration":      ["synthetic_repair_duration", "repair_duration"],
}

# Columns that LSTM validation checks — the ones the engine actually reads.
# load_demand, level_topology, total_downstream_load, synthetic_failure_type
# are topology-derived (computed from network CSV) or informational; LSTM engine
# never touches them so they are excluded from validation.
LSTM_CORE_COLS = LSTM_META_COLS + LSTM_BASE_FEATURES + [
    "from_bus",
    "to_bus",
    "num_customers",
    "downstream_buses",
    "total_downstream_customers",
]
