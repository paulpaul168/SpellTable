"""
Database initialization script.
Creates tables and default users.
"""

import sys
import os

# Add the current directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import init_db, SessionLocal
from app.core.auth import get_password_hash
from app.models.user import User, UserRole
from app.models.campaign import Campaign
from loguru import logger


def create_default_users():
    """Create default admin and viewer users."""
    db = SessionLocal()
    try:
        # Check if admin user already exists
        admin_user = db.query(User).filter(User.username == "admin").first()
        if not admin_user:
            admin_user = User(
                username="admin",
                email="admin@spelltable.com",
                hashed_password=get_password_hash("admin123"),
                role=UserRole.ADMIN,
                is_active=True,
            )
            db.add(admin_user)
            logger.info("Created default admin user: admin/admin123")

        # Check if viewer user already exists
        viewer_user = db.query(User).filter(User.username == "viewer").first()
        if not viewer_user:
            viewer_user = User(
                username="viewer",
                email="viewer@spelltable.com",
                hashed_password=get_password_hash("viewer123"),
                role=UserRole.VIEWER,
                is_active=True,
            )
            db.add(viewer_user)
            logger.info("Created default viewer user: viewer/viewer123")

        db.commit()
        logger.info("Default users created successfully")

    except Exception as e:
        logger.error(f"Error creating default users: {e}")
        db.rollback()
    finally:
        db.close()


def create_sample_campaigns():
    """Create sample campaigns and assign users."""
    db = SessionLocal()
    try:
        # Get the admin and viewer users
        admin_user = db.query(User).filter(User.username == "admin").first()
        viewer_user = db.query(User).filter(User.username == "viewer").first()

        if not admin_user or not viewer_user:
            logger.warning("Admin or viewer user not found, skipping campaign creation")
            return

        # Check if sample campaign already exists
        sample_campaign = (
            db.query(Campaign).filter(Campaign.name == "Sample Campaign").first()
        )
        if not sample_campaign:
            sample_campaign = Campaign(
                name="Sample Campaign",
                description="A sample campaign for testing the diary functionality",
                created_by=admin_user.id,
                is_active=True,
            )
            # Assign both admin and viewer to the campaign
            sample_campaign.users = [admin_user, viewer_user]
            db.add(sample_campaign)
            logger.info("Created sample campaign: 'Sample Campaign'")

        # Create another sample campaign
        second_campaign = (
            db.query(Campaign).filter(Campaign.name == "Adventure Campaign").first()
        )
        if not second_campaign:
            second_campaign = Campaign(
                name="Adventure Campaign",
                description="An exciting adventure campaign for multiple players",
                created_by=admin_user.id,
                is_active=True,
            )
            # Assign both admin and viewer to the second campaign
            second_campaign.users = [admin_user, viewer_user]
            db.add(second_campaign)
            logger.info("Created sample campaign: 'Adventure Campaign'")

        db.commit()
        logger.info("Sample campaigns created successfully")

    except Exception as e:
        logger.error(f"Error creating sample campaigns: {e}")
        db.rollback()
    finally:
        db.close()


def main():
    """Main initialization function."""
    logger.info("Initializing database...")

    # Create tables
    init_db()

    # Create default users
    create_default_users()

    # Create sample campaigns
    create_sample_campaigns()

    logger.info("Database initialization completed successfully!")


if __name__ == "__main__":
    main()
