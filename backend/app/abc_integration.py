"""Integration layer for the research ABC optimizer (scenario_a_website/abc_Multirecloser.py).

Provides a single public function:
  - optimize(abc_input_df, num_reclosers) : run ABC on a pre-built DataFrame

The research file is loaded once via importlib and reused verbatim.
No scenario logic — all data comes from the pipeline state.
"""

from __future__ import annotations

import ast
import contextlib
import importlib.util
import io
import random
import time
from pathlib import Path
from threading import Lock
from typing import Any, Dict

import numpy as np
import pandas as pd

from .scenarios import PROJECT_ROOT

_RESEARCH_ABC_FILE = PROJECT_ROOT / "scenario_a_website" / "abc_Multirecloser.py"
_PRIVATE_MOD_NAME = "_abc_research_module"
_research_mod = None
_import_lock = Lock()


def _load_research_module():
    global _research_mod
    if _research_mod is not None:
        return _research_mod
    with _import_lock:
        if _research_mod is not None:
            return _research_mod
        spec = importlib.util.spec_from_file_location(_PRIVATE_MOD_NAME, _RESEARCH_ABC_FILE)
        if spec is None or spec.loader is None:
            raise RuntimeError(f"Cannot load spec from {_RESEARCH_ABC_FILE}")
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        _research_mod = mod
    return _research_mod


def _zone_details(optimizer, solution):
    out = []
    for line_name in solution:
        line_num = int(line_name.split("_")[1])
        zone_lines = optimizer.get_all_downstream_line_ids(line_num)
        zone_risk = float(sum(optimizer.line_info[fid]["pola_gangguan"] for fid in zone_lines))
        zone_customers = float(sum(optimizer.line_info[fid]["customers"] for fid in zone_lines))
        out.append({
            "recloser": line_name,
            "num_lines_in_zone": len(zone_lines),
            "customers": zone_customers,
            "risk": zone_risk,
        })
    return out


def optimize(abc_input_df: pd.DataFrame, num_reclosers: int = 4) -> Dict[str, Any]:
    """Run ABC optimization on a pre-built ABC input DataFrame.

    Args:
        abc_input_df: DataFrame with columns:
            line_id, from_bus, to_bus, synthetic_lambda_yearly,
            synthetic_outage_duration_yearly, num_customers,
            total_downstream_customers, downstream_buses, pola_gangguan
        num_reclosers: Number of reclosers to place (1-4 per API constraint)

    Returns:
        dict with baseline/optimal SAIDI/SAIFI, optimal positions, zones, etc.
    """
    if not isinstance(num_reclosers, int) or not (1 <= num_reclosers <= 4):
        raise ValueError(f"num_reclosers must be an integer in [1, 4], got {num_reclosers!r}")

    # Parse downstream_buses if stored as string
    df = abc_input_df.copy()
    if "downstream_buses" in df.columns:
        first = df["downstream_buses"].iloc[0]
        if isinstance(first, str):
            df["downstream_buses"] = df["downstream_buses"].apply(ast.literal_eval)

    research = _load_research_module()

    random.seed(research.RANDOM_SEED)
    np.random.seed(research.RANDOM_SEED)

    started = time.perf_counter()
    print(f"[ABC INTEGRATION] df columns: {df.columns.tolist()}")
    print(f"[ABC INTEGRATION] df shape: {df.shape}")
    if not df.empty:
        print(f"[ABC INTEGRATION] df first row:\n{df.iloc[0]}")
    with contextlib.redirect_stdout(io.StringIO()):
        optimizer = research.RecloserOptimizer(df, num_reclosers=num_reclosers)
        best_solution, best_fitness = optimizer.optimize()
        optimal_saidi, optimal_saifi = optimizer.calculate_saidi_saifi(best_solution)
        optimal_risk = optimizer.calculate_risk_penalty(best_solution, verbose=False)
        zones = _zone_details(optimizer, best_solution)
    elapsed = time.perf_counter() - started

    baseline_saidi = float(optimizer.baseline_saidi)
    baseline_saifi = float(optimizer.baseline_saifi)
    total_system_risk = float(optimizer.total_system_risk)
    total_customers = float(optimizer.total_customers)

    def _pct(before, after):
        return ((before - after) / before * 100.0) if before > 0 else 0.0

    return {
        "status": "ready",
        "runtime_seconds": round(elapsed, 3),
        "parameters": {
            "num_reclosers": int(num_reclosers),
            "colony_size": int(research.COLONY_SIZE),
            "max_iterations": int(research.MAX_ITERATIONS),
            "weights": {
                "W_SAIDI": research.W_SAIDI,
                "W_SAIFI": research.W_SAIFI,
                "W_RISK": research.W_RISK,
            },
            "penalties": {
                "MAX_PROTECTED_FRACTION": research.MAX_PROTECTED_FRACTION,
                "MAX_ZONE_OVERLAP": research.MAX_ZONE_OVERLAP,
                "PENALTY_PROXIMITY_COEF": research.PENALTY_PROXIMITY_COEF,
                "PENALTY_ZONE_SIZE_COEF": research.PENALTY_ZONE_SIZE_COEF,
                "RISK_SCALE": research.RISK_SCALE,
                "RANDOM_SEED": research.RANDOM_SEED,
            },
        },
        "totals": {
            "total_customers": total_customers,
            "total_system_risk": total_system_risk,
            "total_lines": int(len(optimizer.line_info)),
            "jumlah_iterasi": int(research.MAX_ITERATIONS),
        },
        "baseline": {
            "saidi": baseline_saidi,
            "saifi": baseline_saifi,
        },
        "optimal": {
            "positions": list(best_solution),
            "fitness": float(best_fitness),
            "saidi": float(optimal_saidi),
            "saifi": float(optimal_saifi),
            "risk_unprotected": float(optimal_risk),
        },
        "improvement": {
            "saidi_pct": _pct(baseline_saidi, optimal_saidi),
            "saifi_pct": _pct(baseline_saifi, optimal_saifi),
            "risk_remaining_pct": (
                (optimal_risk / total_system_risk * 100.0) if total_system_risk > 0 else 0.0
            ),
        },
        "zones": zones,
    }
