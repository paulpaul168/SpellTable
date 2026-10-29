"""
Database configuration and session management.
"""

import os
from collections.abc import Generator

from loguru import logger
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, declarative_base, sessionmaker


def _default_sqlite_url() -> str:
    """Default DB under ``storage/data/spelltable.db`` (cwd-independent)."""
    from .constants import DATA_DIR

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    db_path = (DATA_DIR / "spelltable.db").resolve()
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
