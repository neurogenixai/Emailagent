"""
NeuroGenix Email Agent — Routers Package
"""
from routers import auth_router, campaigns, leads, upload, approval, analytics, timeline, agent_settings, mailboxes, tracking, dashboard

__all__ = [
    "auth_router", "campaigns", "leads", "upload", "approval",
    "analytics", "timeline", "agent_settings", "mailboxes", "tracking", "dashboard"
]
