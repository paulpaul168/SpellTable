"""
This module contains the encounter models.
"""
from pydantic import field_validator

from ..core.model_base import ModelBase
from ..core.types import EncounterDifficulty


class EncounterGenerationRequest(ModelBase):
    character_levels: list[int]
    difficulty: EncounterDifficulty
    monsters: dict[str, int]  # Monster name to max occurrence

    @field_validator('difficulty', mode='before')
    def normalize_size(cls, value):
        if isinstance(value, str):
            formatted_value = value.replace('_', ' ').replace('-', ' ').strip().lower()
            for e in EncounterDifficulty:
                if e.value.lower() == formatted_value or e.name.lower() == formatted_value:
                    return e
        return value


class EncounterMonster(ModelBase):
    name: str
    initiative: int
    hp: int


class EncounterGenerationResult(ModelBase):
    monsters: list[EncounterMonster]
    total_monster_xp: int
    adjusted_monster_xp: int
    assessed_difficulty: EncounterDifficulty
