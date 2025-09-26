"""
This module provides services related to monster management in the game.
"""
import json
from typing import List

from ..core.constants import MONSTERS_DIR
from ..models.monster import Monster

class MonsterService:

    MONSTER_FILE_PATH = MONSTERS_DIR + "/monsters.json"

    def __new__(cls):
        """Singleton pattern to ensure only one instance of MonsterService exists."""
        if not hasattr(cls, "instance"):
            cls.instance = super(MonsterService, cls).__new__(cls)
        return cls.instance

    def load_monsters(self) -> List[Monster]:
        """Load all monsters."""
        return self.__load_monsters_from_json()

    def create_monster(self, monster: Monster) -> bool:
        """Create a new monster. Returns True if the monster was created, False if a monster with the same name already exists."""
        monsters = self.__load_monsters_from_json()
        if any(m.name == monster.name for m in monsters):
            return False
        monsters.append(monster)
        self.__save_monsters_to_json(monsters)
        return True

    def update_monster(self, monster_name: str, monster: Monster) -> bool:
        """Update an existing monster. Returns True if the monster was updated, False if the monster does not exist."""
        monsters = self.__load_monsters_from_json()
        for i, m in enumerate(monsters):
            if m.name == monster_name:
                monsters[i] = monster
                self.__save_monsters_to_json(monsters)
                return True
        return False

    def delete_monster(self, monster_name: str) -> bool:
        """Delete a monster by name. Returns True if a monster was deleted, False otherwise."""
        monsters = self.__load_monsters_from_json()
        initial_count = len(monsters)
        monsters = [monster for monster in monsters if monster.name != monster_name]
        self.__save_monsters_to_json(monsters)
        return len(monsters) < initial_count

    def __load_monsters_from_json(self) -> List[Monster]:
        with open(file=self.MONSTER_FILE_PATH, mode="r", encoding="utf-8") as file:
            data = json.load(file)
        return [Monster(**monster_dict) for monster_dict in data]

    def __save_monsters_to_json(self, monsters: List[Monster]) -> None:
        with open(file=self.MONSTER_FILE_PATH, mode="w", encoding="utf-8") as file:
            json.dump([monster.model_dump() for monster in monsters], file, indent=2)
