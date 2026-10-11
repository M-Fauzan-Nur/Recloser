import csv
from pathlib import Path


def summarize_csv(path: Path, preview: int = 5):
    """Return columns, total_rows (excluding header), and a preview of first N rows.

    Uses the stdlib csv module so it tolerates any column schema. Cells are
    kept as strings; columns like `downstream_buses` (which contain Python
    list-shaped strings) are preserved verbatim.
    """
    with path.open("r", encoding="utf-8", newline="") as fh:
        reader = csv.reader(fh)
        try:
            columns = next(reader)
        except StopIteration:
            return {"columns": [], "total_rows": 0, "preview_rows": []}

        preview_rows = []
        total = 0
        for row in reader:
            total += 1
            if len(preview_rows) < preview:
                preview_rows.append(row)

    return {
        "columns": columns,
        "total_rows": total,
        "preview_rows": preview_rows,
    }