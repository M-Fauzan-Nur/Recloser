"""Topology computation from user-uploaded network CSV.

Parses a network CSV (line_id, from_bus, to_bus, R, X, P_kW, Q_kVAR)
and computes per-line topology features using BFS/DFS traversal from the
substation bus (bus 1).

Features computed per line:
  - downstream_buses      : list of all bus IDs downstream of to_bus
  - level_topology       : tree depth of to_bus from substation
  - total_downstream_load : sum of P_kW at to_bus and all downstream buses
  - total_downstream_customers : count of downstream buses with non-zero load

AVG_KW_PER_CUSTOMER = 1.5 kW/customer, matching data_generate.py.
"""

from __future__ import annotations

import csv
import io
from collections import defaultdict, deque
from typing import Any

AVG_KW_PER_CUSTOMER = 1.5
ROOT_BUS = 1

# Minimal columns required for topology (electrical params optional)
NETWORK_CORE_COLS = ["line_id", "from_bus", "to_bus"]
# Alias for backward compatibility with code that imports NETWORK_REQUIRED_COLS
NETWORK_REQUIRED_COLS = NETWORK_CORE_COLS
# Full columns with electrical data (all optional except core)
NETWORK_ALL_COLS = ["line_id", "from_bus", "to_bus", "R", "X", "P_kW", "Q_kVAR"]


def _parse_network_csv(text: str) -> list[dict[str, Any]]:
    """Parse network CSV text into a list of row dicts.

    Normalises column names case-insensitively to our canonical names.
    """
    reader = csv.DictReader(io.StringIO(text))
    if reader.fieldnames is None:
        raise ValueError("Empty or invalid CSV")

    # Canonical name -> CSV column name (first match wins)
    CANONICAL_MAP = {
        "line_id":   ["line_id", "line"],
        "from_bus":  ["from_bus", "from", "frombus", "from_bus"],
        "to_bus":    ["to_bus", "to", "tobus", "to_bus"],
        "R":         ["r", "resistance"],
        "X":         ["x", "reactance"],
        "P_kW":      ["p_kw", "pkw", "p(kw)", "p(kw)", "p"],
        "Q_kVAR":    ["q_kvar", "q_kvar", "q(kvar)", "q(kvar)", "q"],
    }

    raw_to_canonical = {}
    for canonical, candidates in CANONICAL_MAP.items():
        for raw in reader.fieldnames:
            if raw.lower().strip() in candidates:
                raw_to_canonical[raw] = canonical
                break

    rows = []
    for raw_row in reader:
        row = {canonical: raw_row.get(raw_key, "").strip()
               for raw_key, canonical in raw_to_canonical.items()}
        rows.append(row)

    return rows


def _validate_network(rows: list[dict[str, Any]]) -> None:
    """Validate network structure: tree, connected, no cycles."""
    buses_in = {}   # to_bus -> line_id
    for row in rows:
        to_bus = int(row["to_bus"])
        line_id = row["line_id"]
        if to_bus in buses_in and to_bus != ROOT_BUS:
            raise ValueError(
                f"Bus {to_bus} appears as to_bus in multiple lines "
                f"(line {buses_in[to_bus]} and line {line_id}). "
                f"Network must be a tree."
            )
        buses_in[to_bus] = line_id

    # Every bus except ROOT must appear as to_bus exactly once
    all_buses = set()
    for row in rows:
        all_buses.add(int(row["from_bus"]))
        all_buses.add(int(row["to_bus"]))

    missing = set()
    for bus in all_buses:
        if bus != ROOT_BUS and bus not in buses_in:
            missing.add(bus)
    if missing:
        raise ValueError(
            f"Bus(es) {sorted(missing)} have no incoming line "
            f"(not connected to substation bus 1). Network must be a tree."
        )

    # Check all buses reachable from ROOT
    children = defaultdict(list)
    for row in rows:
        children[int(row["from_bus"])].append(int(row["to_bus"]))

    visited = set()
    q = deque([ROOT_BUS])
    while q:
        bus = q.popleft()
        if bus in visited:
            raise ValueError(
                f"Cycle detected: bus {bus} visited twice. "
                f"Network must be a tree."
            )
        visited.add(bus)
        for child in children[bus]:
            q.append(child)

    unreachable = all_buses - visited
    if unreachable:
        raise ValueError(
            f"Bus(es) {sorted(unreachable)} not reachable from substation bus 1."
        )


def _build_graph(rows: list[dict[str, Any]]) -> tuple[dict[int, list[int]], dict[int, dict]]:
    """Build children adjacency list and bus load/customer info."""
    children = defaultdict(list)
    bus_load = defaultdict(float)

    for row in rows:
        from_bus = int(row["from_bus"])
        to_bus = int(row["to_bus"])
        p_kw = float(row["P_kW"]) if row.get("P_kW") else 0.0

        children[from_bus].append(to_bus)
        bus_load[to_bus] += p_kw

    # Ensure all buses in graph have an entry (even if no children)
    all_buses = set(bus_load.keys())
    for row in rows:
        all_buses.add(int(row["from_bus"]))
        all_buses.add(int(row["to_bus"]))
    for bus in all_buses:
        children.setdefault(bus, [])

    # num_customers per bus
    num_customers = {bus: int(round(load / AVG_KW_PER_CUSTOMER)) for bus, load in bus_load.items()}
    for bus in all_buses:
        num_customers.setdefault(bus, 0)

    return dict(children), dict(bus_load), num_customers


def _dfs_downstream(children: dict[int, list[int]], node: int) -> list[int]:
    """Return all descendant bus IDs of node (depth-first, excluding node)."""
    result = []
    for child in children.get(node, []):
        result.append(child)
        result.extend(_dfs_downstream(children, child))
    return result


def _compute_topology_features(
    children: dict[int, list[int]],
    bus_load: dict[int, float],
    num_customers: dict[int, int],
) -> tuple[dict[int, list[int]], dict[int, int], dict[int, float], dict[int, int]]:
    """Compute level_topology, downstream_buses, total_downstream_load, total_downstream_customers."""
    # BFS from ROOT to compute levels
    level = {}
    q = deque([ROOT_BUS])
    level[ROOT_BUS] = 0
    visited = {ROOT_BUS}
    while q:
        bus = q.popleft()
        for child in children.get(bus, []):
            if child not in visited:
                visited.add(child)
                level[child] = level[bus] + 1
                q.append(child)

    # DFS for downstream buses
    all_nodes = set(level.keys())
    downstream_buses = {}
    for node in all_nodes:
        downstream_buses[node] = _dfs_downstream(children, node)

    # Aggregate downstream loads
    total_downstream_load = {}
    total_downstream_customers = {}
    for bus in all_nodes:
        total_load = bus_load.get(bus, 0.0)
        total_cust = num_customers.get(bus, 0)
        for dbus in downstream_buses[bus]:
            total_load += bus_load.get(dbus, 0.0)
            total_cust += num_customers.get(dbus, 0)
        total_downstream_load[bus] = total_load
        total_downstream_customers[bus] = total_cust

    return downstream_buses, level, total_downstream_load, total_downstream_customers


def compute_topology(csv_text: str) -> dict[str, Any]:
    """Main entry point. Parse and compute topology features.

    Args:
        csv_text: raw CSV content as string with columns:
            line_id, from_bus, to_bus, R, X, P_kW, Q_kVAR

    Returns:
        dict with keys:
            error (str or None),
            metadata (dict with num_lines, num_buses, columns, preview),
            topology_map (dict: line_id -> {downstream_buses, level_topology,
                      total_downstream_load, total_downstream_customers,
                      from_bus, to_bus, R, X, P_kW, Q_kVAR})
    """
    try:
        rows = _parse_network_csv(csv_text)
    except Exception as e:
        return {"error": f"CSV parse error: {e}", "metadata": None, "topology_map": None}

    if not rows:
        return {"error": "Empty CSV", "metadata": None, "topology_map": None}

    # Check required core columns only (electrical params optional)
    sample = rows[0]
    missing = [c for c in NETWORK_CORE_COLS if c not in sample]
    if missing:
        return {
            "error": f"Missing required columns: {missing}",
            "metadata": None,
            "topology_map": None,
        }

    try:
        _validate_network(rows)
    except ValueError as e:
        return {"error": str(e), "metadata": None, "topology_map": None}

    children, bus_load, num_customers = _build_graph(rows)
    downstream_buses, level, total_downstream_load, total_downstream_customers = _compute_topology_features(
        children, bus_load, num_customers
    )

    # Build topology_map per line
    topology_map = {}
    all_buses = set(level.keys())

    for row in rows:
        line_id = int(row["line_id"])
        from_bus = int(row["from_bus"])
        to_bus = int(row["to_bus"])
        p_kw = float(row["P_kW"]) if row.get("P_kW") else 0.0
        r_val = float(row["R"]) if row.get("R") else None
        x_val = float(row["X"]) if row.get("X") else None
        q_kvar = float(row["Q_kVAR"]) if row.get("Q_kVAR") else None

        if to_bus in all_buses:
            topo = {
                "from_bus": from_bus,
                "to_bus": to_bus,
                "R": r_val,
                "X": x_val,
                "P_kW": p_kw,
                "Q_kVAR": q_kvar,
                "level_topology": level.get(to_bus, -1),
                "downstream_buses": downstream_buses.get(to_bus, []),
                "total_downstream_load": total_downstream_load.get(to_bus, 0.0),
                "total_downstream_customers": total_downstream_customers.get(to_bus, 0),
                # customer count at to_bus itself
                "num_customers": num_customers.get(to_bus, 0),
            }
        else:
            topo = {
                "from_bus": from_bus,
                "to_bus": to_bus,
                "R": r_val,
                "X": x_val,
                "P_kW": p_kw,
                "Q_kVAR": q_kvar,
                "level_topology": -1,
                "downstream_buses": [],
                "total_downstream_load": 0.0,
                "total_downstream_customers": 0,
                "num_customers": 0,
            }
        topology_map[line_id] = topo

    # Build metadata
    all_buses_in_network = set()
    for row in rows:
        all_buses_in_network.add(int(row["from_bus"]))
        all_buses_in_network.add(int(row["to_bus"]))

    preview = []
    for row in rows[:10]:
        preview.append({
            "line_id": int(row["line_id"]),
            "from_bus": int(row["from_bus"]),
            "to_bus": int(row["to_bus"]),
            "R": float(row["R"]) if row.get("R") else None,
            "X": float(row["X"]) if row.get("X") else None,
            "P_kW": float(row["P_kW"]) if row.get("P_kW") else 0.0,
            "Q_kVAR": float(row["Q_kVAR"]) if row.get("Q_kVAR") else 0.0,
        })

    metadata = {
        "num_lines": len(rows),
        "num_buses": len(all_buses_in_network),
        "columns": list(rows[0].keys()),
        "preview": preview,
    }

    return {"error": None, "metadata": metadata, "topology_map": topology_map}
