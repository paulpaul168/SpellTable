"""
This module contains the monsters routes for the FastAPI app.
"""

from fastapi import APIRouter, Body, HTTPException, Query

from ..models.monster import Monster
from ..services.aurora_monster_catalog import AuroraMonsterCatalogService
from ..services.fc5_monster_catalog import Fc5MonsterCatalogService
from ..services.monster_service import MonsterService

router = APIRouter()

AURORA_PREFIX = "aurora:"
FC5_PREFIX = "fc5:"


def _resolve_catalog_by_display_name(name: str) -> dict | None:
    """Heal bare display names (e.g. after link stored 'Fire Giant' instead of fc5:…)."""
    needle = name.strip()
    if not needle:
        return None

    fc5 = Fc5MonsterCatalogService()
    if fc5.is_available():
        slug = Fc5MonsterCatalogService._slugify(needle)
        monster = fc5.get_creature_monster(slug)
        if monster is not None:
            return monster
        for entry in fc5.list_creatures(needle, limit=80) or []:
            if entry.name.lower() == needle.lower():
                return fc5.get_creature_monster(entry.id)

    aurora = AuroraMonsterCatalogService()
    if aurora.is_available():
        for entry in aurora.list_creatures(needle) or []:
            if entry.name.lower() == needle.lower():
                return aurora.get_creature_monster(entry.id)

    return None


@router.get("", status_code=200)
async def list_monsters() -> list[Monster]:
    try:
        service = MonsterService()
        return service.load_monsters()
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/catalog/status", status_code=200)
async def aurora_monster_catalog_status() -> dict[str, bool | int]:
    service = AuroraMonsterCatalogService()
    available = service.is_available()
    count = len(service.list_creatures() or []) if available else 0
    return {"available": available, "count": count}


@router.get("/catalog", status_code=200)
async def list_aurora_monster_catalog(
    q: str | None = Query(default=None, description="Filter by name, id, or source"),
) -> list[dict]:
    service = AuroraMonsterCatalogService()
    entries = service.list_creatures(q)
    if entries is None:
        raise HTTPException(
            status_code=503,
            detail="Aurora monster catalog unavailable (AURORA_ELEMENTS_ROOT not configured)",
        )
    return [
        {
            "id": e.id,
            "name": e.name,
            "source": e.source,
            "size": e.size,
            "challenge": e.challenge,
            "ac": e.ac,
            "hp_average": e.hp_average,
            "creature_type": e.creature_type,
            "monsterName": f"{AURORA_PREFIX}{e.id}",
        }
        for e in entries
    ]


@router.get("/catalog/{creature_id}", status_code=200)
async def get_aurora_monster_catalog_detail(creature_id: str) -> dict:
    service = AuroraMonsterCatalogService()
    if not service.is_available():
        raise HTTPException(
            status_code=503,
            detail="Aurora monster catalog unavailable (AURORA_ELEMENTS_ROOT not configured)",
        )
    monster = service.get_creature_monster(creature_id)
    if monster is None:
        raise HTTPException(
            status_code=404, detail=f"Aurora creature '{creature_id}' not found"
        )
    return monster


@router.get("/fc5/status", status_code=200)
async def fc5_monster_catalog_status() -> dict[str, bool | int]:
    service = Fc5MonsterCatalogService()
    available = service.is_available()
    if not available:
        return {"available": False, "count": 0}
    entries = service.list_creatures(limit=None) or []
    return {"available": True, "count": len(entries)}


@router.get("/fc5", status_code=200)
async def list_fc5_monster_catalog(
    q: str | None = Query(
        default=None, description="Filter by name, id, type, or source"
    ),
    limit: int = Query(default=200, ge=1, le=20000),
) -> list[dict]:
    service = Fc5MonsterCatalogService()
    entries = service.list_creatures(q, limit=limit)
    if entries is None:
        raise HTTPException(
            status_code=503,
            detail="FC5 monster catalog unavailable (FC5_ROOT not configured)",
        )
    return [
        {
            "id": e.id,
            "name": e.name,
            "source": e.source,
            "size": e.size,
            "challenge": e.challenge,
            "ac": e.ac,
            "hp_average": e.hp_average,
            "creature_type": e.creature_type,
            "monsterName": f"{FC5_PREFIX}{e.id}",
        }
        for e in entries
    ]


@router.get("/fc5/{creature_id}", status_code=200)
async def get_fc5_monster_catalog_detail(creature_id: str) -> dict:
    service = Fc5MonsterCatalogService()
    if not service.is_available():
        raise HTTPException(
            status_code=503,
            detail="FC5 monster catalog unavailable (FC5_ROOT not configured)",
        )
    monster = service.get_creature_monster(creature_id)
    if monster is None:
        raise HTTPException(
            status_code=404, detail=f"FC5 creature '{creature_id}' not found"
        )
    return monster


@router.get("/{monster_name}", status_code=200)
async def get_monster(monster_name: str) -> Monster | dict:
    try:
        if monster_name.startswith(AURORA_PREFIX):
            creature_id = monster_name[len(AURORA_PREFIX) :]
            aurora = AuroraMonsterCatalogService()
            monster = aurora.get_creature_monster(creature_id)
            if monster is None:
                raise HTTPException(
                    status_code=404,
                    detail=f"Aurora creature '{creature_id}' not found",
                )
            return monster

        if monster_name.startswith(FC5_PREFIX):
            creature_id = monster_name[len(FC5_PREFIX) :]
            fc5 = Fc5MonsterCatalogService()
            monster = fc5.get_creature_monster(creature_id)
            if monster is None:
                raise HTTPException(
                    status_code=404,
                    detail=f"FC5 creature '{creature_id}' not found",
                )
            return monster

        service = MonsterService()
        monster = service.load_monster(monster_name)
        if monster is not None:
            return monster

        catalog = _resolve_catalog_by_display_name(monster_name)
        if catalog is not None:
            return catalog

        raise HTTPException(
            status_code=404, detail=f"Monster '{monster_name}' not found"
        )
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("", status_code=201)
async def create_monster(monster: Monster = Body(...)) -> None:
    try:
        service = MonsterService()
        created = service.create_monster(monster)
        if not created:
            raise HTTPException(
                status_code=400, detail=f"Monster '{monster.name}' already exists"
            )
        return None
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.put("/{monster_name}", status_code=204)
async def update_monster(monster_name: str, monster: Monster = Body(...)) -> None:
    try:
        service = MonsterService()
        updated = service.update_monster(monster_name, monster)
        if not updated:
            raise HTTPException(
                status_code=404, detail=f"Monster '{monster_name}' not found"
            )
        return None
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.delete("/{monster_name}", status_code=204)
async def delete_monster(monster_name: str) -> None:
    try:
        service = MonsterService()
        deleted = service.delete_monster(monster_name)
        if not deleted:
            raise HTTPException(
                status_code=404, detail=f"Monster '{monster_name}' not found"
            )
        return None
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
