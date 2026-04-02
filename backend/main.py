import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api.analyze import router as analyze_router
from backend.api.chat import router as chat_router
from backend.api.counterfactual import router as counterfactual_router
from backend.api.report import router as report_router
from backend.api.shap_explain import router as shap_explain_router
from backend.api.trade_insights import router as trade_insights_router
from backend.api.sessions import router as sessions_router
from backend.api.users import router as users_router
from backend.db.database import Base, engine
from backend.utils.config import get_settings


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    Base.metadata.create_all(bind=engine)
    yield


def create_app() -> FastAPI:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")

    settings = get_settings()
    app = FastAPI(title="Tradealytics API", version="0.1.0", lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(analyze_router, prefix="/api")
    app.include_router(chat_router, prefix="/api")
    app.include_router(counterfactual_router, prefix="/api")
    app.include_router(report_router, prefix="/api")
    app.include_router(shap_explain_router, prefix="/api")
    app.include_router(trade_insights_router, prefix="/api")
    app.include_router(users_router, prefix="/api")
    app.include_router(sessions_router, prefix="/api")

    @app.get("/health")
    def health_check() -> dict:
        return {"status": "ok"}

    return app


app = create_app()
