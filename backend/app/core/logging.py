"""
This module contains the logging configuration for the application.
It configures loguru to log to the console and to a file with rotation.
"""

import sys
from datetime import datetime

from loguru import logger

from .constants import LOGS_DIR


def setup_logger() -> None:
    """
    Configure the application logger.

    Sets up loguru to:
    - Log to the console
    - Log to a rotating file inside the logs directory

    Returns:
        The configured logger object
    """
    logs_dir = LOGS_DIR
    logs_dir.mkdir(parents=True, exist_ok=True)

    # Remove default handlers
    logger.remove()

    # Add console handler
    logger.add(
        sys.stderr,
        level="INFO",
        format=(
            "<green>{time:YYYY-MM-DD HH:mm:ss}</green> | "
            "<level>{level: <8}</level> | "
            "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - "
            "<level>{message}</level>"
        ),
    )

    # Add rotating file handler
    log_file = logs_dir / "spelltable_{time:YYYY-MM-DD}.log"
    logger.add(
        log_file,
        rotation="10 MB",  # Rotate when file reaches 10MB
        retention="1 week",  # Keep logs for 1 week
        compression="zip",  # Compress rotated logs
        level="DEBUG",
        format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{function}:{line} - {message}",
    )

    logger.success(
        f"Logger initialized at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
    )
