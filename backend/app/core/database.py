"""
Database configuration and session management.
"""

import os
from collections.abc import Generator
from pathlib import Path

from loguru import logger
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import Session, sessionmaker


def _default_sqlite_url() -> str:
    """
    Match docker-compose: ./data at repo root -> /app/data in the container.

    sqlite:///data/spelltable.db is cwd-relative; local uvicorn often runs with
    cwd=backend/, so the DB was backend/data/ while Docker used repo ./data/.
    """
    app_root = Path(__file__).resolve().parents[2]
    if app_root.name == "backend":
        data_dir = app_root.parent / "data"
    else:
        data_dir = app_root / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    db_path = (data_dir / "spelltable.db").resolve()
    return "sqlite:///" + db_path.as_posix()


SQLALCHEMY_DATABASE_URL = os.environ.get("DATABASE_URL") or _default_sqlite_url()

# Create engine
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},  # Needed for SQLite
)

# Create SessionLocal class (SQLAlchemy naming; not UPPER_CASE)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)  # pylint: disable=invalid-name

# Create Base class - this will be shared across all models
Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """Get database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Initialize database tables."""
    logger.info("Creating database tables")

    # Import models here to ensure they are registered with the Base

    Base.metadata.create_all(bind=engine)
    logger.info("Database tables created successfully")
