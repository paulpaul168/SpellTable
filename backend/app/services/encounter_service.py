"""
Basic combat encounter generation (D&D 5e 2014 XP thresholds).
"""

from __future__ import annotations

import random
import threading
from typing import Self, cast

from ..core.types import EncounterDifficulty
from ..models.encounter import (
    EncounterGenerationRequest,
    EncounterGenerationResult,
    EncounterMonster,
    PartyThresholds,
)
from ..models.monster import Monster
from .hit_dice_service import HitDiceService
from .monster_service import MonsterService

# Per-level thresholds: (easy, medium, hard, deadly) — 2014 DMG
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

_MAX_CREATURES = 12
_SEARCH_ATTEMPTS = 80
_TOLERANCE = 0.20


class EncounterService:
    _instance: EncounterService | None = None
    _lock = threading.Lock()

    def __new__(cls) -> Self:
        if cls._instance is None:
            with cls._lock:
                if not cls._instance:
                    cls._instance = super().__new__(cls)
        assert cls._instance is not None
        return cast(Self, cls._instance)

    def party_thresholds(self, party_size: int, party_level: int) -> PartyThresholds:
        levels = [party_level] * party_size
        totals = self._sum_thresholds(levels)
        return PartyThresholds(**totals)

    def generate_encounter(
        self, request: EncounterGenerationRequest
    ) -> EncounterGenerationResult:
        difficulty = request.difficulty
        if isinstance(difficulty, str):
            difficulty = EncounterDifficulty(difficulty)

        thresholds = self.party_thresholds(request.party_size, request.party_level)
        target_xp = self._threshold_for(thresholds, difficulty)
        if target_xp <= 0:
            raise ValueError("Invalid party level or size for XP thresholds")

        catalog = [
            m
            for m in MonsterService().load_monsters()
            if m.challenge and m.challenge.xp and m.challenge.xp > 0
        ]
        if not catalog:
            raise ValueError("No monsters available in the local library")

        names, raw_xp, adjusted_xp, within = self._compose_encounter(catalog, target_xp)
        monsters = self._roll_instances(names)

        return EncounterGenerationResult(
            monsters=monsters,
            monster_xp_total=raw_xp,
            monster_xp_adjusted=adjusted_xp,
            target_xp=target_xp,
            party_thresholds=thresholds,
            within_tolerance=within,
            difficulty=difficulty,
            party_size=request.party_size,
            party_level=request.party_level,
        )

    def _threshold_for(
        self, thresholds: PartyThresholds, difficulty: EncounterDifficulty
    ) -> int:
        mapping = {
            EncounterDifficulty.EASY: thresholds.easy,
            EncounterDifficulty.MEDIUM: thresholds.medium,
            EncounterDifficulty.HARD: thresholds.hard,
            EncounterDifficulty.DEADLY: thresholds.deadly,
        }
        return mapping[difficulty]

    def _sum_thresholds(self, levels: list[int]) -> dict[str, int]:
        easy = medium = hard = deadly = 0
        for level in levels:
            e, m, h, d = _LEVEL_THRESHOLDS.get(level, (0, 0, 0, 0))
            easy += e
            medium += m
            hard += h
            deadly += d
        return {"easy": easy, "medium": medium, "hard": hard, "deadly": deadly}

    @staticmethod
    def _adjusted_xp(raw_xp: int, count: int) -> int:
        if count <= 0:
            return 0
        if count == 1:
            multiplier = 1.0
        elif count == 2:
            multiplier = 1.5
        elif count <= 6:
            multiplier = 2.0
        elif count <= 10:
            multiplier = 2.5
        elif count <= 14:
            multiplier = 3.0
        else:
            multiplier = 4.0
        return int(raw_xp * multiplier)

    @staticmethod
    def _within_tolerance(adjusted: int, target: int) -> bool:
        if target <= 0:
            return False
        return abs(adjusted - target) / target <= _TOLERANCE

    def _compose_encounter(
        self, catalog: list[Monster], target_xp: int
    ) -> tuple[list[str], int, int, bool]:
        """Return (names, raw_xp, adjusted_xp, within_tolerance)."""
        best_names: list[str] = []
        best_raw = 0
        best_adj = 0
        best_delta = float("inf")

        for _ in range(_SEARCH_ATTEMPTS):
            names, raw, adj = self._random_pack(catalog, target_xp)
            delta = abs(adj - target_xp)
            if delta < best_delta:
                best_delta = delta
                best_names, best_raw, best_adj = names, raw, adj
            if self._within_tolerance(adj, target_xp):
                return names, raw, adj, True

        # Greedy fallback toward target
        g_names, g_raw, g_adj = self._greedy_pack(catalog, target_xp)
        if abs(g_adj - target_xp) < best_delta:
            best_names, best_raw, best_adj = g_names, g_raw, g_adj

        if not best_names:
            # Absolute fallback: single cheapest (or only) monster
            pick = min(catalog, key=lambda m: m.challenge.xp)
            best_names = [pick.name]
            best_raw = int(pick.challenge.xp)
            best_adj = best_raw

        return (
            best_names,
            best_raw,
            best_adj,
            self._within_tolerance(best_adj, target_xp),
        )

    def _random_pack(
        self, catalog: list[Monster], target_xp: int
    ) -> tuple[list[str], int, int]:
        """Build a random pack that stays near the target budget."""
        count = random.randint(1, min(_MAX_CREATURES, max(1, len(catalog) * 2)))
        # Prefer monsters whose XP won't wildly overshoot after multipliers
        affordable = [
            m
            for m in catalog
            if self._adjusted_xp(int(m.challenge.xp), 1) <= target_xp * 1.5
        ] or catalog

        names: list[str] = []
        raw = 0
        for _ in range(count):
            pick = random.choice(affordable)
            trial_raw = raw + int(pick.challenge.xp)
            trial_adj = self._adjusted_xp(trial_raw, len(names) + 1)
            # Soft stop if already well over budget
            if names and trial_adj > target_xp * 1.35:
                break
            names.append(pick.name)
            raw = trial_raw

        if not names:
            pick = random.choice(catalog)
            names = [pick.name]
            raw = int(pick.challenge.xp)

        return names, raw, self._adjusted_xp(raw, len(names))

    def _greedy_pack(
        self, catalog: list[Monster], target_xp: int
    ) -> tuple[list[str], int, int]:
        names: list[str] = []
        raw = 0
        ordered = sorted(catalog, key=lambda m: m.challenge.xp)

        while len(names) < _MAX_CREATURES:
            best: Monster | None = None
            best_score = float("inf")
            for monster in ordered:
                trial_raw = raw + int(monster.challenge.xp)
                trial_adj = self._adjusted_xp(trial_raw, len(names) + 1)
                score = abs(trial_adj - target_xp)
                # Prefer moves that don't explode past 1.2x unless empty
                if (
                    names
                    and trial_adj > target_xp * 1.25
                    and trial_adj >= self._adjusted_xp(raw, len(names))
                ):
                    continue
                if score < best_score:
                    best_score = score
                    best = monster
            if best is None:
                break
            next_raw = raw + int(best.challenge.xp)
            next_adj = self._adjusted_xp(next_raw, len(names) + 1)
            current_adj = self._adjusted_xp(raw, len(names)) if names else 0
            if names and abs(next_adj - target_xp) >= abs(current_adj - target_xp):
                break
            names.append(best.name)
            raw = next_raw
            if self._within_tolerance(next_adj, target_xp):
                break

        if not names:
            pick = ordered[0]
            names = [pick.name]
            raw = int(pick.challenge.xp)

        return names, raw, self._adjusted_xp(raw, len(names))

    def _roll_instances(self, names: list[str]) -> list[EncounterMonster]:
        hit_dice = HitDiceService()
        monsters_svc = MonsterService()
        result: list[EncounterMonster] = []
        for name in names:
            monster = monsters_svc.load_monster(name)
            hp = 1
            if monster is not None:
                try:
                    hp = hit_dice.roll_hit_dice_expression(monster.hp.hit_dice)
                except ValueError:
                    hp = max(1, monster.hp.average)
            result.append(
                EncounterMonster(
                    name=name,
                    initiative=random.randint(1, 20),
                    hp=hp,
                )
            )
        return result
