from __future__ import annotations

import random
import re
import threading
from typing import Self, cast

from ..models.die import Die, DiePool


class HitDiceService:
    _instance: HitDiceService | None = None
    _lock = threading.Lock()

    def __new__(cls) -> Self:
        """Singleton pattern to ensure only one instance of HitDiceService exists."""
        if cls._instance is None:
            with cls._lock:
                # Another thread could have created the instance before we acquired the lock. So check that the
                # instance is still nonexistent.
                if not cls._instance:
                    cls._instance = super().__new__(cls)
        assert cls._instance is not None
        return cast(Self, cls._instance)

    def parse_hit_dice(self, expression: str) -> dict[str, list[DiePool] | int]:
        expression = expression.strip().replace(" ", "")
        if not expression:
            raise ValueError("Empty expression")

        compiled_regex = re.compile(r"([+-]?\d+d\d+|[+-]?\d+)", re.IGNORECASE)
        tokens = compiled_regex.findall(expression)
        if not tokens:
            raise ValueError(f"Invalid expression: {expression}")

        dice_terms: list[DiePool] = []
        modifier = 0

        for token in tokens:
            if "d" in token.lower():  # Dice Term
                pattern_match = re.match(r"([+-]?)(\d+)d(\d+)", token, re.IGNORECASE)
                if not pattern_match:
                    raise ValueError(f"Invalid dice term: {token}")
                sign, count, faces = pattern_match.groups()
                count, faces = int(count), int(faces)
                if count <= 0 or faces <= 0:
                    raise ValueError(f"Dice must be positive: {token}")
                if sign == "-":
                    raise ValueError(f"Negative dice are not allowed: {token}")
                dice_terms.append(DiePool(count=count, die=Die(faces=faces)))
            else:  # Pure number
                modifier += int(token)

        return {"dice": dice_terms, "modifier": modifier}

    def evaluate_hit_dice(self, hit_dice: dict[str, list[DiePool] | int]) -> int:
        """Roll parsed hit dice and return total HP (minimum 1)."""
        modifier = hit_dice.get("modifier", 0)
        total = modifier if isinstance(modifier, int) else 0
        dice = hit_dice.get("dice", [])
        if isinstance(dice, list):
            for die_pool in dice:
                if not isinstance(die_pool, DiePool):
                    continue
                for _ in range(die_pool.count):
                    total += random.randint(1, die_pool.die.faces)
        return max(1, total)

    def roll_hit_dice_expression(self, expression: str) -> int:
        """Parse and roll a hit-dice expression like ``2d8+2``."""
        return self.evaluate_hit_dice(self.parse_hit_dice(expression))
