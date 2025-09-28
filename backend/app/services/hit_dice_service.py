import re
import threading
from typing import Dict, Union

from ..models.die import DiePool, Die


class HitDiceService:

    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        """Singleton pattern to ensure only one instance of HitDiceService exists."""
        if cls._instance is None:
            with cls._lock:
                # Another thread could have created the instance before we acquired the lock. So check that the
                # instance is still nonexistent.
                if not cls._instance:
                    cls._instance = super().__new__(cls)
        return cls._instance

    def parse_hit_dice(self, expression: str) -> Dict[str, Union[list[DiePool], int]]:
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
            if "d" in token.lower(): # Dice Term
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
            else: # Pure number
                modifier += int(token)

        return {"dice": dice_terms, "modifier": modifier}
