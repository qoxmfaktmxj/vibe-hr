from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session

from app.api.auth import router as auth_router
from app.api.dashboard import router as dashboard_router
from app.api.menu import router as menu_router
from app.bootstrap import seed_initial_data
from app.core.config import settings
from app.core.database import engine, init_db


@asynccontextmanager
async def lifespan(_app: FastAPI):
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
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api/v1")
app.include_router(dashboard_router, prefix="/api/v1")
app.include_router(menu_router, prefix="/api/v1")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}

