"""
This module provides services related to monster management in the game.
"""
import hashlib
import json
from typing import List

from ..core.constants import MONSTERS_DIR
from ..models.monster import Monster

class MonsterService:

    MONSTER_FILE_PATH: str = MONSTERS_DIR + "/monsters.json"

    # When loading the file content (monsters) from the disk a cache mechanism is used to avoid unmarshalling the JSON
    # content every time a monster is requested. The cache is invalidated when the file changes. Despite the binary
    # content of a file being read every time when a monster is requested for hash calculation, this is still more
    # efficient than reading the file content and unmarshalling the JSON every time as JSON unmarshalling is quite
    # expensive in terms of performance and the majority of the time there are no changes to the file.
    monster_file_hash: str = ''
    monster_cache: List[Monster] = None

    def __new__(cls):
        """Singleton pattern to ensure only one instance of MonsterService exists."""
        if not hasattr(cls, "instance"):
            cls.instance = super(MonsterService, cls).__new__(cls)
        return cls.instance

    def load_monsters(self) -> List[Monster]:
        """Load all monsters."""
        return self.__load_monsters_from_file()

    def load_monster(self, monster_name: str) -> Monster | None:
        """Load a monster by name. Returns None if the monster does not exist."""
        monsters = self.__load_monsters_from_file()
        for monster in monsters:
            if monster.name == monster_name:
                return monster
        return None

    def create_monster(self, monster: Monster) -> bool:
        """Create a new monster. Returns True if the monster was created, False if a monster with the same name already exists."""
        monsters = self.__load_monsters_from_file()
        if any(m.name == monster.name for m in monsters):
            return False
        monsters.append(monster)
        self.__save_monsters_to_file(monsters)
        return True

    def update_monster(self, monster_name: str, monster: Monster) -> bool:
        """Update an existing monster. Returns True if the monster was updated, False if the monster does not exist."""
        monsters = self.__load_monsters_from_file()
        for i, m in enumerate(monsters):
            if m.name == monster_name:
                monsters[i] = monster
                self.__save_monsters_to_file(monsters)
                return True
        return False

    def delete_monster(self, monster_name: str) -> bool:
        """Delete a monster by name. Returns True if a monster was deleted, False otherwise."""
        monsters = self.__load_monsters_from_file()
        initial_count = len(monsters)
        monsters = [monster for monster in monsters if monster.name != monster_name]
        self.__save_monsters_to_file(monsters)
        return len(monsters) < initial_count

    def __load_monsters_from_file(self, ignore_cache=False) -> List[Monster]:
        if not ignore_cache:
            current_hash = self.__calculate_file_hash(self.MONSTER_FILE_PATH)
            if self.monster_file_hash == current_hash and self.monster_cache is not None:
                return self.monster_cache
            self.monster_file_hash = current_hash

        with open(file=self.MONSTER_FILE_PATH, mode="r", encoding="utf-8") as file:
            data = json.load(file)

        self.monster_cache = [Monster(**monster_dict) for monster_dict in data]
        return self.monster_cache

    def __save_monsters_to_file(self, monsters: List[Monster]) -> None:
        self.monster_file_hash = ''
        with open(file=self.MONSTER_FILE_PATH, mode="w", encoding="utf-8") as file:
            json.dump([monster.model_dump() for monster in monsters], file, indent=2)

    def __calculate_file_hash(self, file_path: str, algorithm='sha256') -> str:
        hash_function = hashlib.new(algorithm)
        with open(file_path, 'rb') as file:
            while chunk := file.read(8192):
                hash_function.update(chunk)
        return hash_function.hexdigest()
