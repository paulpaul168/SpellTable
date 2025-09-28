"""
This module provides services related to encounter generation in the game.
"""
import random
import threading

from .hit_dice_service import HitDiceService
from .monster_service import MonsterService
from ..core.types import EncounterDifficulty
from ..models.encounter import EncounterGenerationRequest, EncounterGenerationResult, EncounterMonster

# Per-level thresholds: (easy, medium, hard, deadly)
_LEVEL_THRESHOLDS: dict[int, tuple[int, int, int, int]] = {
    1: (25, 50, 75, 100),
    2: (50, 100, 150, 200),
    3: (75, 150, 225, 400),
    4: (125, 250, 375, 500),
    5: (250, 500, 750, 1100),
    6: (300, 600, 900, 1400),
    7: (350, 750, 1100, 1700),
    8: (450, 900, 1400, 2100),
    9: (550, 1100, 1600, 2400),
    10: (600, 1200, 1900, 2800),
    11: (800, 1600, 2400, 3600),
    12: (1000, 2000, 3000, 4500),
    13: (1100, 2200, 3400, 5100),
    14: (1250, 2500, 3800, 5700),
    15: (1400, 2800, 4300, 6400),
    16: (1600, 3200, 4800, 7200),
    17: (2000, 3900, 5900, 8800),
    18: (2100, 4200, 6300, 9500),
    19: (2400, 4900, 7300, 10900),
    20: (2800, 5700, 8500, 12700),
}


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
        monsters: list[EncounterMonster] = [
            EncounterMonster(name=monster_name)
            for monster_name, count in request.monsters.items()
            for _ in range(count)
        ]

        total_monster_xp = self.__calculate_total_xp(monsters)
        adjusted_monster_xp = self.__calculate_adjusted_xp(total_monster_xp, len(monsters))
        return EncounterGenerationResult(
            monsters=self.__calculate_initiative_and_hp(monsters),
            monster_xp_total=total_monster_xp,
            monster_xp_with_modifiers=adjusted_monster_xp,
            difficulty_rating=self.__assess_encounter_difficulty(adjusted_monster_xp, request.character_levels),
            party_difficulty_thresholds=self.__calculate_party_thresholds(request.character_levels)
        )

    # Methods to calculate the encounter

    # Methods to calculate various aspects of the encounter result
    def __calculate_initiative_and_hp(self, monsters: list[EncounterMonster]) -> list[EncounterMonster]:
        for monster in monsters:
            monster.initiative = random.randint(1, 20)
            m = MonsterService().load_monster(monster.name)
            hit_dice_expression = HitDiceService().parse_hit_dice(m.hp.hit_dice)
            monster.hp = HitDiceService().evaluate_hit_dice(hit_dice_expression)
        return monsters

    def __calculate_total_xp(self, monsters: list[EncounterMonster]) -> int:
        total_xp = 0
        for monster in monsters:
            m = MonsterService().load_monster(monster.name)
            total_xp += m.challenge.xp
        return total_xp

    def __calculate_adjusted_xp(self, total_xp: int, num_monsters: int) -> int:
        if num_monsters == 1:
            multiplier = 1
        elif num_monsters == 2:
            multiplier = 1.5
        elif 3 <= num_monsters <= 6:
            multiplier = 2
        elif 7 <= num_monsters <= 10:
            multiplier = 2.5
        elif 11 <= num_monsters <= 14:
            multiplier = 3
        else:  # 15 or more
            multiplier = 4
        return int(total_xp * multiplier)

    def __calculate_player_thresholds(self, level: int) -> tuple[int, int, int, int]:
        return _LEVEL_THRESHOLDS.get(level, (0, 0, 0, 0))

    def __calculate_party_thresholds(self, levels: list[int]) -> dict[str, int]:
        easy, medium, hard, deadly = 0, 0, 0, 0
        for level in levels:
            e, m, h, d = self.__calculate_player_thresholds(level)
            easy += e
            medium += m
            hard += h
            deadly += d
        return {"easy": easy, "medium": medium, "hard": hard, "deadly": deadly}

    def __assess_encounter_difficulty(self, adjusted_monster_xp: int, levels: list[int]) -> EncounterDifficulty:
        thresholds = self.__calculate_party_thresholds(levels)
        xp = adjusted_monster_xp
        if xp < thresholds["easy"]:
            return EncounterDifficulty.EASY
        if xp < thresholds["medium"]:
            return EncounterDifficulty.EASY
        if xp < thresholds["hard"]:
            return EncounterDifficulty.MEDIUM
        if xp < thresholds["deadly"]:
            return EncounterDifficulty.HARD
        return EncounterDifficulty.DEADLY
