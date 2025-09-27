from fastapi import APIRouter, HTTPException, Body

from ..models.encounter import EncounterGenerationRequest, EncounterGenerationResult
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
