"""Schema drift checker: compares SQLModel metadata against the live DB.

Exits with code 0 when no drift is detected, 1 when drift is found.

Usage:
    # against default DATABASE_URL in .env (myhr)
    python scripts/check_schema_drift.py

    # against a specific DB
    DATABASE_URL=postgresql+psycopg://... python scripts/check_schema_drift.py

    # --json flag for machine-readable output
    python scripts/check_schema_drift.py --json
"""
from __future__ import annotations

import json
import sys
from typing import Any

import psycopg
from sqlalchemy import inspect
from sqlmodel import SQLModel, create_engine

# Import all models so their tables register on SQLModel.metadata.
import app.models  # noqa: F401
from app.core.config import settings


def _get_model_tables() -> dict[str, set[str]]:
    """Return {table_name: {col_name, ...}} from SQLModel metadata."""
    result: dict[str, set[str]] = {}
    for table in SQLModel.metadata.sorted_tables:
        result[table.name] = {col.name for col in table.columns}
    return result


def _get_db_tables(url: str) -> dict[str, set[str]]:
    """Return {table_name: {col_name, ...}} from information_schema."""
    # Convert SQLAlchemy URL to psycopg DSN.
    # e.g. postgresql+psycopg://user:pass@host:port/db -> host/dbname etc.
    engine = create_engine(url, echo=False, pool_pre_ping=True)
    result: dict[str, set[str]] = {}
    with engine.connect() as conn:
        raw = conn.connection.driver_connection  # psycopg raw connection
        cur = raw.cursor()
        cur.execute(
            """
            SELECT table_name, column_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name != 'alembic_version'
            ORDER BY table_name, column_name
            """
        )
        for table_name, col_name in cur.fetchall():
            result.setdefault(table_name, set()).add(col_name)
    engine.dispose()
    return result


def check_drift(database_url: str | None = None) -> dict[str, Any]:
    """Compare model metadata vs DB and return a drift report dict."""
    url = database_url or settings.database_url
    model_tables = _get_model_tables()
    db_tables = _get_db_tables(url)

    missing_tables: list[str] = []       # in model, not in DB
    extra_tables: list[str] = []         # in DB, not in model
    missing_columns: dict[str, list[str]] = {}  # table -> cols in model but not DB
    extra_columns: dict[str, list[str]] = {}    # table -> cols in DB but not model

    all_model_names = set(model_tables.keys())
    all_db_names = set(db_tables.keys())

    for t in sorted(all_model_names - all_db_names):
        missing_tables.append(t)

    for t in sorted(all_db_names - all_model_names):
        extra_tables.append(t)

    for t in sorted(all_model_names & all_db_names):
        model_cols = model_tables[t]
        db_cols = db_tables[t]
        miss = sorted(model_cols - db_cols)
        extra = sorted(db_cols - model_cols)
        if miss:
            missing_columns[t] = miss
        if extra:
            extra_columns[t] = extra

    drift_count = (
        len(missing_tables)
        + len(extra_tables)
        + sum(len(v) for v in missing_columns.values())
        + sum(len(v) for v in extra_columns.values())
    )

    return {
        "database_url": url,
        "drift_count": drift_count,
        "missing_tables": missing_tables,
        "extra_tables": extra_tables,
        "missing_columns": missing_columns,
        "extra_columns": extra_columns,
    }


def main() -> None:
    use_json = "--json" in sys.argv
    report = check_drift()

    if use_json:
        print(json.dumps(report, indent=2, ensure_ascii=False))
    else:
        print(f"[drift] database_url  : {report['database_url']}")
        print(f"[drift] drift_count   : {report['drift_count']}")

        if report["missing_tables"]:
            print("\n[drift] MISSING TABLES (in model, not in DB):")
            for t in report["missing_tables"]:
                print(f"  - {t}")

        if report["extra_tables"]:
            print("\n[drift] EXTRA TABLES (in DB, not in model):")
            for t in report["extra_tables"]:
                print(f"  + {t}")

        if report["missing_columns"]:
            print("\n[drift] MISSING COLUMNS (in model, not in DB):")
            for t, cols in report["missing_columns"].items():
                for c in cols:
                    print(f"  - {t}.{c}")

        if report["extra_columns"]:
            print("\n[drift] EXTRA COLUMNS (in DB, not in model):")
            for t, cols in report["extra_columns"].items():
                for c in cols:
                    print(f"  + {t}.{c}")

        if report["drift_count"] == 0:
            print("\n[drift] OK - no structural drift detected.")
        else:
            print(f"\n[drift] DRIFT DETECTED - {report['drift_count']} item(s) require attention.")

    sys.exit(0 if report["drift_count"] == 0 else 1)


if __name__ == "__main__":
    main()
