"""
Encounter generation request/response models.
"""

from typing import Any

from pydantic import Field, field_validator

from ..core.model_base import ModelBase
from ..core.types import EncounterDifficulty


class EncounterGenerationRequest(ModelBase):
    party_size: int = Field(ge=1, le=12)
    party_level: int = Field(ge=1, le=20)
    difficulty: EncounterDifficulty

    @field_validator("difficulty", mode="before")
    @classmethod
    def normalize_difficulty(cls, value: Any) -> Any:
        if isinstance(value, str):
            formatted = value.replace("_", " ").replace("-", " ").strip().lower()
            for e in EncounterDifficulty:
                if e.value.lower() == formatted or e.name.lower() == formatted:
                    return e
        return value


class EncounterMonster(ModelBase):
    name: str
    initiative: int = 1
    hp: int = 1


class PartyThresholds(ModelBase):
    easy: int
    medium: int
    hard: int
    deadly: int


class EncounterGenerationResult(ModelBase):
    monsters: list[EncounterMonster]
    monster_xp_total: int
    monster_xp_adjusted: int
    target_xp: int
    party_thresholds: PartyThresholds
    within_tolerance: bool
    difficulty: EncounterDifficulty
    party_size: int
    party_level: int
