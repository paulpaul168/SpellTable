"""
Optional BYO Aurora spell catalog routes.

Disabled (503) when AURORA_ELEMENTS_ROOT is unset or missing.
"""

from fastapi import APIRouter, HTTPException, Query

from ..services.aurora_spell_catalog import AuroraSpellCatalogService

router = APIRouter()


@router.get("/catalog/status")
async def catalog_status() -> dict[str, bool]:
    service = AuroraSpellCatalogService()
    return {"available": service.is_available()}


@router.get("/catalog")
async def list_spell_catalog(
    q: str | None = Query(default=None, description="Filter by name or id"),
) -> list[dict]:
    service = AuroraSpellCatalogService()
    entries = service.list_spells(q)
    if entries is None:
        raise HTTPException(
            status_code=503,
            detail="Spell catalog unavailable (AURORA_ELEMENTS_ROOT not configured)",
        )
    return [
        {
            "id": e.id,
            "name": e.name,
            "level": e.level,
            "school": e.school,
            "source": e.source,
        }
        for e in entries
    ]


@router.get("/catalog/{spell_id}")
async def get_spell_catalog_detail(spell_id: str) -> dict:
    service = AuroraSpellCatalogService()
    if not service.is_available():
        raise HTTPException(
            status_code=503,
            detail="Spell catalog unavailable (AURORA_ELEMENTS_ROOT not configured)",
        )
    detail = service.get_spell(spell_id)
    if detail is None:
        raise HTTPException(status_code=404, detail=f"Spell '{spell_id}' not found")
    return {
        "id": detail.id,
        "name": detail.name,
        "level": detail.level,
        "school": detail.school,
        "source": detail.source,
        "description_html": detail.description_html,
    }
