"""
This module provides services related to encounter generation in the game.
"""
import threading

from ..core.types import EncounterDifficulty
from ..models.encounter import EncounterGenerationRequest, EncounterGenerationResult, EncounterMonster


class EncounterService:

    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        """Singleton pattern to ensure only one instance of EncounterService exists."""
        if cls._instance is None:
            with cls._lock:
                # Another thread could have created the instance before we acquired the lock. So check that the
                # instance is still nonexistent.
                if not cls._instance:
                    cls._instance = super().__new__(cls)
        return cls._instance

    def generate_encounter(self, request: EncounterGenerationRequest) -> EncounterGenerationResult:
        return EncounterGenerationResult(
            monsters=[
                EncounterMonster(name="Goblin", initiative=15, hp=8),
                EncounterMonster(name="Goblin", initiative=4, hp=6),
                EncounterMonster(name="Goblin Viss", initiative=11, hp=21)
            ],
            total_monster_xp=100,
            adjusted_monster_xp=500,
            assessed_difficulty=EncounterDifficulty.EASY
        )
