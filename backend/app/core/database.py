"""
Database configuration and session management.
"""

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from loguru import logger

# SQLite database URL - use the mounted volume directory
SQLALCHEMY_DATABASE_URL = "sqlite:///../data/spelltable.db"

# Create engine
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},  # Needed for SQLite
)

# Create SessionLocal class
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create Base class - this will be shared across all models
Base = declarative_base()


def get_db():
    """Get database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Initialize database tables."""
    logger.info("Creating database tables")

    # Import models here to ensure they are registered with the Base
    from ..models.user import User  # This registers the User model with Base

    Base.metadata.create_all(bind=engine)
    logger.info("Database tables created successfully")
