from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session

from app.api.auth import router as auth_router
from app.api.common_code import router as common_code_router
from app.api.dashboard import router as dashboard_router
from app.api.employee import router as employee_router
from app.api.menu import router as menu_router
from app.api.organization import router as organization_router
from app.api.hr_basic import router as hr_basic_router
from app.api.tim_attendance_code import router as tim_attendance_code_router
from app.api.tim_work_schedule import router as tim_work_schedule_router
from app.api.tim_holiday import router as tim_holiday_router
from app.api.tim_attendance_daily import router as tim_attendance_daily_router
from app.api.tim_leave import router as tim_leave_router
from app.api.tim_report import router as tim_report_router
from app.api.hri_form_type import router as hri_form_type_router
from app.api.hri_approval_template import router as hri_approval_template_router
from app.api.hri_request import router as hri_request_router
from app.api.pay_setup import router as pay_setup_router
from app.bootstrap import seed_initial_data
from app.core.config import settings
from app.core.database import engine, init_db


@asynccontextmanager
async def lifespan(_app: FastAPI):
    settings.validate_security_settings()
    init_db()
    with Session(engine) as session:
        seed_initial_data(session)
    yield


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)

app.include_router(auth_router, prefix="/api/v1")
app.include_router(dashboard_router, prefix="/api/v1")
app.include_router(employee_router, prefix="/api/v1")
app.include_router(menu_router, prefix="/api/v1")
app.include_router(organization_router, prefix="/api/v1")
app.include_router(common_code_router, prefix="/api/v1")
app.include_router(hr_basic_router, prefix="/api/v1")
app.include_router(tim_attendance_code_router, prefix="/api/v1")
app.include_router(tim_work_schedule_router, prefix="/api/v1")
app.include_router(tim_holiday_router, prefix="/api/v1")
app.include_router(tim_attendance_daily_router, prefix="/api/v1")
app.include_router(tim_leave_router, prefix="/api/v1")
app.include_router(tim_report_router, prefix="/api/v1")
app.include_router(hri_form_type_router, prefix="/api/v1")
app.include_router(hri_approval_template_router, prefix="/api/v1")
app.include_router(hri_request_router, prefix="/api/v1")
app.include_router(pay_setup_router, prefix="/api/v1")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}

