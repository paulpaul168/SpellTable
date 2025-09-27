"""
This module contains the encounter models.
"""

from ..core.model_base import ModelBase
from ..core.types import EncounterDifficulty


class EncounterGenerationRequest(ModelBase):
    character_levels: list[int]
    difficulty: EncounterDifficulty
    monsters: dict[str, int]  # Monster name to max occurrence


class EncounterMonster(ModelBase):
    name: str
    initiative: int
    hp: int


class EncounterGenerationResult(ModelBase):
    monsters: list[EncounterMonster]
    total_monster_xp: int
    adjusted_monster_xp: int
    assessed_difficulty: EncounterDifficulty
