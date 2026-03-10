from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.logging import setup_logging
from app.core.state_machine.service import StateMachineError

from app.api.routes_dashboard import router as dashboard_router
from app.api.routes_temp_detector import router as temp_router
from app.api.routes_category_engine import router as category_router
from app.api.routes_user_engine import router as user_router
from app.api.routes_data import router as data_router


def create_app() -> FastAPI:
    setup_logging()

    openapi_tags = [
        {
            "name": "dashboard",
            "description": "Operational overview for model versions, health checks, and dataset counts.",
        },
        {
            "name": "temp-detector",
            "description": "Temporary user detector APIs for anomaly scoring, template management, and model training.",
        },
        {
            "name": "category",
            "description": "Cold-start category engine APIs for onboarding-based profile generation and training.",
        },
        {
            "name": "user",
            "description": "User-wise personalization APIs for profile updates and sequence-model analytics.",
        },
        {
            "name": "data",
            "description": "Read-only APIs for profile history, traces, quarantine records, and state machine events.",
        },
    ]

    app = FastAPI(
        title="ML Personalization Engine (MLPE)",
        version="0.1.0",
        description=(
            "MLPE combines a temporary-user detector, a category cold-start engine, and a "
            "continuous user personalization engine. Use the category endpoints for onboarding "
            "profiles, temp-detector endpoints to filter low-quality interaction batches, and "
            "user endpoints to update long-term profiles from accepted interactions."
        ),
        openapi_tags=openapi_tags,
        debug=settings.DEBUG,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ALLOW_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(dashboard_router, prefix="/dashboard", tags=["dashboard"])
    app.include_router(temp_router, prefix="/temp-detector", tags=["temp-detector"])
    app.include_router(category_router, prefix="/category", tags=["category"])
    app.include_router(user_router, prefix="/user", tags=["user"])
    app.include_router(data_router, prefix="/data", tags=["data"])

    @app.exception_handler(StateMachineError)
    async def handle_state_machine_error(_: Request, exc: StateMachineError):
        return JSONResponse(status_code=exc.status_code, content=exc.to_response())

    @app.get(
        "/health",
        tags=["dashboard"],
        summary="Service health check",
        description="Lightweight liveness check for API and orchestrator startup.",
    )
    def health():
        return {"status": "ok"}

    return app


app = create_app()
