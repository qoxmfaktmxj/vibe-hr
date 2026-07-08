from collections.abc import Generator

from sqlalchemy import text
from sqlmodel import Session, SQLModel, create_engine

from app.core.config import settings

engine = create_engine(
    settings.database_url,
    echo=False,
    pool_size=20,
    max_overflow=30,
    pool_pre_ping=True,
    pool_recycle=3600,
)


def init_db() -> None:
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                DO $$
                BEGIN
                    IF to_regclass('public.org_departments') IS NOT NULL THEN
                        EXECUTE 'ALTER TABLE org_departments ADD COLUMN IF NOT EXISTS organization_type VARCHAR(50)';
                        EXECUTE 'ALTER TABLE org_departments ADD COLUMN IF NOT EXISTS cost_center_code VARCHAR(30)';
                        EXECUTE 'ALTER TABLE org_departments ADD COLUMN IF NOT EXISTS description VARCHAR(500)';
                    END IF;

                    IF to_regclass('public.tim_attendance_daily') IS NOT NULL THEN
                        EXECUTE 'ALTER TABLE tim_attendance_daily ADD COLUMN IF NOT EXISTS actual_minutes INTEGER NOT NULL DEFAULT 0';
                        EXECUTE 'ALTER TABLE tim_attendance_daily ADD COLUMN IF NOT EXISTS regular_minutes INTEGER NOT NULL DEFAULT 0';
                        EXECUTE 'ALTER TABLE tim_attendance_daily ADD COLUMN IF NOT EXISTS overtime_minutes INTEGER NOT NULL DEFAULT 0';
                        EXECUTE 'ALTER TABLE tim_attendance_daily ADD COLUMN IF NOT EXISTS night_minutes INTEGER NOT NULL DEFAULT 0';
                        EXECUTE 'ALTER TABLE tim_attendance_daily ADD COLUMN IF NOT EXISTS holiday_work_minutes INTEGER NOT NULL DEFAULT 0';
                        EXECUTE 'ALTER TABLE tim_attendance_daily ADD COLUMN IF NOT EXISTS holiday_overtime_minutes INTEGER NOT NULL DEFAULT 0';
                        EXECUTE 'ALTER TABLE tim_attendance_daily ADD COLUMN IF NOT EXISTS holiday_night_minutes INTEGER NOT NULL DEFAULT 0';
                        EXECUTE 'ALTER TABLE tim_attendance_daily ADD COLUMN IF NOT EXISTS is_holiday_work BOOLEAN NOT NULL DEFAULT FALSE';
                        EXECUTE 'ALTER TABLE tim_attendance_daily ADD COLUMN IF NOT EXISTS calculated_at TIMESTAMPTZ';
                    END IF;

                    IF to_regclass('public.wel_benefit_requests') IS NOT NULL THEN
                        EXECUTE 'ALTER TABLE wel_benefit_requests ADD COLUMN IF NOT EXISTS employee_id INTEGER';
                        EXECUTE 'CREATE INDEX IF NOT EXISTS ix_wel_benefit_requests_employee_id ON wel_benefit_requests(employee_id)';

                        IF to_regclass('public.hr_employees') IS NOT NULL AND NOT EXISTS (
                            SELECT 1 FROM pg_constraint WHERE conname = 'fk_wel_benefit_requests_employee_id'
                        ) THEN
                            EXECUTE
                                'ALTER TABLE wel_benefit_requests
                                 ADD CONSTRAINT fk_wel_benefit_requests_employee_id
                                 FOREIGN KEY (employee_id) REFERENCES hr_employees(id)';
                        END IF;
                    END IF;

                    IF to_regclass('public.pap_appraisal_masters') IS NOT NULL
                       AND to_regclass('public."PAP_APPRAISAL_MASTERS"') IS NULL THEN
                        EXECUTE 'ALTER TABLE pap_appraisal_masters RENAME TO "PAP_APPRAISAL_MASTERS"';
                    END IF;

                    IF to_regclass('public.pap_final_results') IS NOT NULL
                       AND to_regclass('public."PAP_FINAL_RESULTS"') IS NULL THEN
                        EXECUTE 'ALTER TABLE pap_final_results RENAME TO "PAP_FINAL_RESULTS"';
                    END IF;

                    IF to_regclass('public."PAP_APPRAISAL_MASTERS"') IS NOT NULL THEN
                        EXECUTE 'ALTER TABLE "PAP_APPRAISAL_MASTERS" ADD COLUMN IF NOT EXISTS final_result_id INTEGER';
                        EXECUTE 'CREATE INDEX IF NOT EXISTS ix_pap_appraisal_masters_final_result_id ON "PAP_APPRAISAL_MASTERS"(final_result_id)';

                        IF to_regclass('public."PAP_FINAL_RESULTS"') IS NOT NULL AND NOT EXISTS (
                            SELECT 1 FROM pg_constraint WHERE conname = 'fk_pap_appraisal_masters_final_result_id'
                        ) THEN
                            EXECUTE
                                'ALTER TABLE "PAP_APPRAISAL_MASTERS"
                                 ADD CONSTRAINT fk_pap_appraisal_masters_final_result_id
                                 FOREIGN KEY (final_result_id) REFERENCES "PAP_FINAL_RESULTS"(id)';
                        END IF;
                    END IF;
                END
                $$;
                """
            ),
        )
    SQLModel.metadata.create_all(engine)


def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session

