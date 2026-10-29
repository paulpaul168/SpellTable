"""
Encounter generation API routes.
"""

from fastapi import APIRouter, Body, HTTPException, Query

from ..models.encounter import (
    EncounterGenerationRequest,
    EncounterGenerationResult,
    PartyThresholds,
)
from ..services.encounter_service import EncounterService

router = APIRouter()


@router.post("/generate", status_code=200)
async def generate_encounter(
    request: EncounterGenerationRequest = Body(...),
) -> EncounterGenerationResult:
    try:
        return EncounterService().generate_encounter(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/xp-levels", status_code=200)
async def get_xp_levels(
    party_size: int = Query(ge=1, le=12),
    party_level: int = Query(ge=1, le=20),
) -> PartyThresholds:
    try:
        return EncounterService().party_thresholds(party_size, party_level)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
