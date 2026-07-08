from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlmodel import Session

from app.core.config import settings
from app.core.database import get_session

router = APIRouter(prefix="/health", tags=["health"])


@router.get("")
def health_check(session: Session = Depends(get_session)) -> dict:
    db_status = "ok"
    try:
        session.exec(text("SELECT 1"))
    except Exception:
        db_status = "error"
    return {
        "status": "ok" if db_status == "ok" else "degraded",
        "app": settings.app_name,
        "environment": settings.environment,
        "db": db_status,
    }
