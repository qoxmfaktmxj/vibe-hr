from __future__ import annotations

from pathlib import Path

from sqlalchemy import text
from sqlmodel import SQLModel, Session, create_engine

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


def archive_seed_to_sqlite(session: Session, sqlite_path: str) -> int:
    """현재 DB의 핵심 초기 데이터를 SQLite 파일로 누적/동기화한다.

    - 대상 파일이 없으면 생성
    - 같은 PK는 INSERT OR REPLACE로 최신 상태 반영
    """
    target = Path(sqlite_path)
    target.parent.mkdir(parents=True, exist_ok=True)

    target_engine = create_engine(f"sqlite:///{target}", connect_args={"check_same_thread": False})
    SQLModel.metadata.create_all(target_engine)

    synced = 0
    with target_engine.begin() as dst_conn:
        for table in TABLES:
            rows = session.exec(text(f"SELECT * FROM {table}")).mappings().all()
            if not rows:
                continue

            cols = list(rows[0].keys())
            col_sql = ", ".join(cols)
            placeholders = ", ".join([f":{col}" for col in cols])
            stmt = text(f"INSERT OR REPLACE INTO {table} ({col_sql}) VALUES ({placeholders})")

            for row in rows:
                dst_conn.execute(stmt, dict(row))
            synced += len(rows)

    return synced
