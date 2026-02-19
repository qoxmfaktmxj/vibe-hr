from __future__ import annotations

import os
from pathlib import Path


def _prepare_env() -> tuple[Path, Path]:
    db_path = Path(os.getenv("DEV_SEED_DB_PATH", "./db/dev_hr_master.sqlite"))
    archive_path = Path(os.getenv("DEV_SEED_ARCHIVE_PATH", "./db/dev_seed_accum.sqlite"))
    reset_db = os.getenv("DEV_SEED_RESET", "true").lower() in {"1", "true", "yes", "y"}

    db_path.parent.mkdir(parents=True, exist_ok=True)
    archive_path.parent.mkdir(parents=True, exist_ok=True)

    if reset_db and db_path.exists():
        db_path.unlink()

    os.environ["DATABASE_URL"] = f"sqlite:///{db_path.as_posix()}"
    os.environ["SEED_ARCHIVE_ENABLED"] = "true"
    os.environ["SEED_ARCHIVE_SQLITE_PATH"] = archive_path.as_posix()

    return db_path, archive_path


def main() -> None:
    db_path, archive_path = _prepare_env()

    from sqlalchemy import text
    from sqlmodel import Session

    from app.bootstrap import seed_initial_data
    from app.core.database import engine, init_db

    init_db()
    with Session(engine) as session:
        seed_initial_data(session)

        kr_users = session.exec(text("SELECT COUNT(*) FROM auth_users WHERE login_id LIKE 'kr-%'")).one()[0]
        employee_count = session.exec(text("SELECT COUNT(*) FROM hr_employees")).one()[0]
        admin_name = session.exec(
            text("SELECT display_name FROM auth_users WHERE login_id = 'admin' LIMIT 1")
        ).one()[0]

    print(f"[dev-seed] db={db_path.as_posix()}")
    print(f"[dev-seed] archive={archive_path.as_posix()}")
    print(f"[dev-seed] kr_users={kr_users}")
    print(f"[dev-seed] hr_employees={employee_count}")
    print(f"[dev-seed] admin_display_name={admin_name}")


if __name__ == "__main__":
    main()
