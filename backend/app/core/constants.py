"""
This module contains constants for the FastAPI app.
"""

from __future__ import annotations

import os
from pathlib import Path

# DMG / basic rules XP awards by challenge rating (5e).
CHALLENGE_XP: dict[float, int] = {
    0: 0,
    0.125: 25,
    0.25: 50,
    0.5: 100,
    1: 200,
    2: 450,
    3: 700,
    4: 1_100,
    5: 1_800,
    6: 2_300,
    7: 2_900,
    8: 3_900,
    9: 5_000,
    10: 5_900,
    11: 7_200,
    12: 8_400,
    13: 10_000,
    14: 11_500,
    15: 13_000,
    16: 15_000,
    17: 18_000,
    18: 20_000,
    19: 22_000,
    20: 25_000,
    21: 33_000,
    22: 41_000,
    23: 50_000,
    24: 62_000,
    25: 75_000,
    26: 90_000,
    27: 105_000,
    28: 120_000,
    29: 135_000,
    30: 155_000,
}


def xp_for_challenge(rating: float | None) -> int:
    if rating is None:
        return 0
    if rating in CHALLENGE_XP:
        return CHALLENGE_XP[rating]
    # Fractional CRs sometimes arrive as 1/8 style floats with noise
    for key, xp in CHALLENGE_XP.items():
        if abs(key - rating) < 1e-6:
            return xp
    return 0


def _package_root() -> Path:
    """`backend/` locally, or `/app` in the Docker image (WORKDIR)."""
    return Path(__file__).resolve().parents[2]


def resolve_storage_root() -> Path:
    """
    User-data root under ``storage/``.

    Prefer ``STORAGE_ROOT`` env. Otherwise:
    - local checkout: ``<repo>/storage`` (package lives in ``backend/``)
    - Docker: ``/app/storage`` (compose mounts ``./storage:/app/storage``)
    """
    env = os.environ.get("STORAGE_ROOT", "").strip()
    if env:
        return Path(env).expanduser().resolve()

    pkg = _package_root()
    if pkg.name == "backend":
        return (pkg.parent / "storage").resolve()
    return (pkg / "storage").resolve()


STORAGE_ROOT = resolve_storage_root()
DATA_DIR = STORAGE_ROOT / "data"
MAPS_DIR = str(STORAGE_ROOT / "maps")
SCENES_DIR = str(STORAGE_ROOT / "scenes")
CAMPAIGN_IMAGES_DIR = str(STORAGE_ROOT / "campaign_images")
MONSTERS_DIR = str(STORAGE_ROOT / "monsters")
SOUNDS_DIR = STORAGE_ROOT / "sounds"
LOGS_DIR = STORAGE_ROOT / "logs"

for _path in (
    STORAGE_ROOT,
    DATA_DIR,
    Path(MAPS_DIR),
    Path(SCENES_DIR),
    Path(CAMPAIGN_IMAGES_DIR),
    Path(MONSTERS_DIR),
    SOUNDS_DIR,
    LOGS_DIR,
):
    _path.mkdir(parents=True, exist_ok=True)
