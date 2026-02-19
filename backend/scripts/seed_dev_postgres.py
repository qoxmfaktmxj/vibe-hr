from __future__ import annotations

import os

from sqlalchemy import text
from sqlmodel import Session

from app.bootstrap import seed_initial_data
from app.core.database import engine, init_db


def main() -> None:
    database_url = os.getenv("DATABASE_URL", "")
    if not database_url.startswith("postgresql"):
        raise RuntimeError("DATABASE_URL must point to PostgreSQL.")

    init_db()
    with Session(engine) as session:
        seed_initial_data(session)

        kr_users = session.exec(text("SELECT COUNT(*) FROM auth_users WHERE login_id LIKE 'kr-%'")).one()[0]
        employee_count = session.exec(text("SELECT COUNT(*) FROM hr_employees")).one()[0]
        admin_name = session.exec(
            text("SELECT display_name FROM auth_users WHERE login_id = 'admin' LIMIT 1")
        ).one()[0]

    print(f"[dev-seed] database_url={database_url}")
    print(f"[dev-seed] kr_users={kr_users}")
    print(f"[dev-seed] hr_employees={employee_count}")
    print(f"[dev-seed] admin_display_name={admin_name}")


if __name__ == "__main__":
    main()
