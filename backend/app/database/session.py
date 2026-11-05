from typing import Generator, Dict, Any, Optional
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session
from backend.app.config import get_settings
from backend.app.core.logging import logger

settings = get_settings()

_engine = None
_SessionLocal = None


def get_engine():
    global _engine
    if _engine is None:
        db_url = settings.sync_database_url
        if not db_url:
            return None
        try:
            connect_args = {}
            if db_url.startswith("sqlite"):
                connect_args = {"check_same_thread": False}
            elif db_url.startswith("postgresql"):
                connect_args = {"connect_timeout": settings.DB_CONNECT_TIMEOUT}

            _engine = create_engine(
                db_url,
                connect_args=connect_args,
                pool_pre_ping=True,
            )
        except Exception as e:
            logger.warning("Database engine initialization deferred or failed: %s", e)
            return None
    return _engine


def get_session_factory():
    global _SessionLocal
    engine = get_engine()
    if engine is not None and _SessionLocal is None:
        _SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    return _SessionLocal


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency for database session."""
    factory = get_session_factory()
    if factory is None:
        raise RuntimeError("Database is not configured or engine failed to initialize.")
    db = factory()
    try:
        yield db
    finally:
        db.close()


def check_db_health() -> Dict[str, Any]:
    """
    Check database connectivity safely without crashing the health endpoint.
    PostgreSQL is not mandatory for initial health checks.
    """
    engine = get_engine()
    if engine is None:
        return {
            "status": "unconfigured",
            "connected": False,
            "message": "Database is not configured. PostgreSQL is optional for initial baseline.",
        }
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {
            "status": "connected",
            "connected": True,
            "message": "Database is reachable.",
        }
    except Exception as exc:
        return {
            "status": "disconnected",
            "connected": False,
            "message": f"Database unreachable: {str(exc)}",
        }
