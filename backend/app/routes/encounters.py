from fastapi import APIRouter, HTTPException, Body

from ..models.encounter import EncounterGenerationRequest, EncounterGenerationResult, XpLevels
from ..services.encounter_service import EncounterService

router = APIRouter()

@router.post("", status_code=200)
async def generate_encounter(request: EncounterGenerationRequest = Body(...)) -> EncounterGenerationResult:
    try:
        service = EncounterService()
        return service.generate_encounter(request)
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

@router.get("/xp-levels", status_code=200)
async def get_xp_levels(levels: str) -> XpLevels:
    try:
        try:
            level_list = [int(level.strip()) for level in levels.split(",")]
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid level format. Levels must be integers separated by commas.")
        service = EncounterService()
        return service.calculate_xp_levels(level_list)
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
