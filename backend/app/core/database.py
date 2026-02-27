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

