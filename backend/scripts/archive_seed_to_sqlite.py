from __future__ import annotations

import os
import sqlite3
from pathlib import Path

from sqlalchemy import create_engine, text
from sqlmodel import SQLModel

# 모델 import로 metadata 등록
from app import models  # noqa: F401

TABLES = [
    "auth_roles",
    "auth_users",
    "auth_user_roles",
    "org_departments",
    "hr_employees",
    "tim_attendance_daily",
    "tim_leave_requests",
    "app_menus",
    "app_menu_roles",
]


def main() -> None:
    source_url = os.getenv("DATABASE_URL", "sqlite:///./vibe_hr.db")
    target_url = os.getenv("SEED_ARCHIVE_SQLITE_URL", "sqlite:///./db/dev_seed_accum.sqlite")

    if not target_url.startswith("sqlite:///"):
        raise RuntimeError("SEED_ARCHIVE_SQLITE_URL must be sqlite:///... format")

    target_path = Path(target_url.replace("sqlite:///", ""))
    target_path.parent.mkdir(parents=True, exist_ok=True)

    source_engine = create_engine(source_url)
    target_engine = create_engine(target_url, connect_args={"check_same_thread": False})

    # 대상 sqlite 스키마 생성
    SQLModel.metadata.create_all(target_engine)

    with source_engine.begin() as src_conn, target_engine.begin() as dst_conn:
        raw = dst_conn.connection
        assert isinstance(raw, sqlite3.Connection)

        total_rows = 0
        for table in TABLES:
            rows = src_conn.execute(text(f"SELECT * FROM {table}")).mappings().all()
            if not rows:
                continue

            cols = list(rows[0].keys())
            col_sql = ", ".join(cols)
            placeholders = ", ".join(["?" for _ in cols])
            sql = f"INSERT OR REPLACE INTO {table} ({col_sql}) VALUES ({placeholders})"

            values = [tuple(row[col] for col in cols) for row in rows]
            raw.executemany(sql, values)
            total_rows += len(values)

    print(f"[seed-archive] source={source_url}")
    print(f"[seed-archive] target={target_url}")
    print(f"[seed-archive] synced rows={total_rows}")


if __name__ == "__main__":
    main()
