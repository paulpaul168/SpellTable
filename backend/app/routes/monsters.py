"""
This module contains the monsters routes for the FastAPI app.
"""
from typing import List

from fastapi import APIRouter, Body, HTTPException

from ..models.monster import Monster
from ..services.monster_service import MonsterService

router = APIRouter()

@router.get("", status_code=200)
async def list_monsters() -> List[Monster]:
    try:
        service = MonsterService()
        return service.load_monsters()
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
            raise HTTPException(status_code=400, detail=f"Monster '{monster.name}' already exists")
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
            raise HTTPException(status_code=404, detail=f"Monster '{monster_name}' not found")
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
            raise HTTPException(status_code=404, detail=f"Monster '{monster_name}' not found")
        return None
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
