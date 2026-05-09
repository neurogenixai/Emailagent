"""
NeuroGenix Email Agent — FastAPI Main Application
"""
import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from database import create_tables, SessionLocal
from config import settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger(__name__)


def seed_settings():
    """Ensure the single agent_settings row exists with Neurogenix defaults on first run."""
    from models import AgentSettings
    db = SessionLocal()
    try:
        row = db.query(AgentSettings).filter(AgentSettings.id == 1).first()
        if not row:
            db.add(AgentSettings(
                id=1,
                product_name="Neurogenix AI",
                product_description=(
                    "Neurogenix is an AI-powered email outreach and automation platform. "
                    "We help B2B companies scale their cold email campaigns using Claude AI to generate "
                    "hyper-personalized, human-like emails. The platform includes multi-mailbox rotation, "
                    "smart IMAP reply detection, lead management, approval workflows, and a full analytics dashboard."
                ),
                icp=(
                    "Our ideal customer is a B2B SaaS founder, growth hacker, sales leader, or marketing agency "
                    "that runs cold email outreach campaigns. They typically have 10-500 employees, are trying to "
                    "book meetings or generate leads at scale, and are frustrated with generic mass-blast tools "
                    "that get low reply rates. They care deeply about deliverability and personalization."
                ),
                value_proposition=(
                    "Neurogenix replaces your manual cold email process with AI-generated, deeply personalized emails "
                    "that read like a human wrote them — getting 3-5x higher reply rates than traditional tools. "
                    "Zero AI detection score, built-in mailbox warmup protection, and instant reply halting means "
                    "your domain stays safe while your pipeline grows automatically."
                ),
                sequence_steps=[
                    {"step": 0, "label": "Intro Email", "delay_days": 0, "prompt": ""},
                    {"step": 1, "label": "Follow-up 1", "delay_days": 3, "prompt": ""},
                    {"step": 2, "label": "Follow-up 2", "delay_days": 7, "prompt": ""},
                ],
            ))
            db.commit()
            logger.info("✅ Default agent settings seeded with Neurogenix product context")
        else:
            # Backfill Neurogenix context if fields are still blank
            if not row.product_name:
                row.product_name = "Neurogenix AI"
                row.product_description = (
                    "Neurogenix is an AI-powered email outreach and automation platform. "
                    "We help B2B companies scale their cold email campaigns using Claude AI to generate "
                    "hyper-personalized, human-like emails. The platform includes multi-mailbox rotation, "
                    "smart IMAP reply detection, lead management, approval workflows, and a full analytics dashboard."
                )
                row.icp = (
                    "Our ideal customer is a B2B SaaS founder, growth hacker, sales leader, or marketing agency "
                    "that runs cold email outreach campaigns. They typically have 10-500 employees, are trying to "
                    "book meetings or generate leads at scale, and are frustrated with generic mass-blast tools "
                    "that get low reply rates. They care deeply about deliverability and personalization."
                )
                row.value_proposition = (
                    "Neurogenix replaces your manual cold email process with AI-generated, deeply personalized emails "
                    "that read like a human wrote them — getting 3-5x higher reply rates than traditional tools. "
                    "Zero AI detection score, built-in mailbox warmup protection, and instant reply halting means "
                    "your domain stays safe while your pipeline grows automatically."
                )
                if not row.sequence_steps:
                    row.sequence_steps = [
                        {"step": 0, "label": "Intro Email", "delay_days": 0, "prompt": ""},
                        {"step": 1, "label": "Follow-up 1", "delay_days": 3, "prompt": ""},
                        {"step": 2, "label": "Follow-up 2", "delay_days": 7, "prompt": ""},
                    ]
                db.commit()
                logger.info("✅ Agent settings backfilled with Neurogenix product context")
            else:
                logger.info("✅ Agent settings already exist")
    except Exception as e:
        logger.error(f"❌ Settings seed error: {e}")
        db.rollback()
    finally:
        db.close()


def seed_admin():
    """Create default admin user on first run."""
    from user_model import User
    from auth import hash_password
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == settings.super_admin_email).first()
        if not existing:
            user = User(
                email=settings.super_admin_email,
                full_name="Neurogenix Admin",
                password_hash=hash_password(settings.super_admin_password),
                role="admin",
                is_active=True,
            )
            db.add(user)
            db.commit()
            logger.info(f"✅ Admin user created: {settings.super_admin_email}")
        else:
            # Always sync password in case ENV changed
            existing.password_hash = hash_password(settings.super_admin_password)
            db.commit()
            logger.info("✅ Admin user already exists — password synced")
    except Exception as e:
        logger.error(f"❌ Admin seed error: {e}")
        db.rollback()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 NeuroGenix Email Agent starting up...")
    create_tables()
    logger.info("✅ Database tables ready")
    seed_settings()
    seed_admin()

    # Start background scheduler
    from services.scheduler import start_scheduler, stop_scheduler
    start_scheduler()

    yield

    logger.info("🔴 Shutting down Email Agent...")
    from services.scheduler import stop_scheduler
    stop_scheduler()


app = FastAPI(
    title="NeuroGenix Email Agent API",
    description="AI-powered cold email outreach platform by Neurogenix",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
_cors_origins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:5174",
    "https://localhost:5174",
]
if settings.frontend_url and settings.frontend_url not in _cors_origins:
    _cors_origins.append(settings.frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_origin_regex=r"https://.*\.up\.railway\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
from fastapi import APIRouter
from routers import auth_router, campaigns, leads, upload, approval, analytics, timeline, agent_settings, mailboxes, tracking, dashboard, replies
from routers import admin as admin_router

api_router = APIRouter(prefix="/api")
api_router.include_router(auth_router.router)
api_router.include_router(admin_router.router)
api_router.include_router(campaigns.router)
api_router.include_router(leads.router)
api_router.include_router(upload.router)
api_router.include_router(approval.router)
api_router.include_router(analytics.router)
api_router.include_router(timeline.router)
api_router.include_router(agent_settings.router)
api_router.include_router(mailboxes.router)
api_router.include_router(tracking.router)
api_router.include_router(dashboard.router)
api_router.include_router(replies.router)

@api_router.get("/health", tags=["Health"])
def health():
    return {"status": "healthy", "version": "1.0.0"}

app.include_router(api_router)

# ── Frontend Static Serving (Production) ──────────────────────────────────────
import os
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

frontend_dist = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if os.path.exists(frontend_dist):
    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_dist, "assets")), name="assets")
    
    @app.get("/{full_path:path}")
    async def serve_react_app(full_path: str):
        # Fallback to index.html for React Router
        return FileResponse(os.path.join(frontend_dist, "index.html"))
else:
    @app.get("/", tags=["Health"])
    def root():
        return {"app": "NeuroGenix Email Agent API", "status": "running", "mode": "development"}
