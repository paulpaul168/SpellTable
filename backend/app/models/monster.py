"""
This module contains the monster models.
"""

from pydantic import field_validator

from ..core.model_base import ModelBase
from ..core.types import (
    Alignment,
    Armor,
    Condition,
    CreatureSize,
    DamageType,
    Language,
    SavingThrow,
    Skill,
)


class ArmorClass(ModelBase):
    ac: int
    type: Armor = Armor.NATURAL_ARMOR
    shield: bool = False


class HitPoints(ModelBase):
    average: int
    hit_dice: str


class Speed(ModelBase):
    walk: int | None = None
    fly: int | None = None
    swim: int | None = None
    burrow: int | None = None
    climb: int | None = None


class AbilityScores(ModelBase):
    strength: int
    dexterity: int
    constitution: int
    intelligence: int
    wisdom: int
    charisma: int


class SavingThrowModifier(ModelBase):
    saving_throw: SavingThrow
    modifier: int


class SkillModifier(ModelBase):
    skill: Skill
    modifier: int


class Senses(ModelBase):
    passive_perception: int
    darkvision: int | None = None


class Challenge(ModelBase):
    rating: float
    xp: float


class Description(ModelBase):
    title: str
    description: str


# A monster model.
class Monster(ModelBase):
    name: str
    size: CreatureSize
    alignment: Alignment
    armor: ArmorClass
    hp: HitPoints
    speed: Speed

    ability_scores: AbilityScores | None = None

    saving_throws: list[SavingThrowModifier] | None = []
    skills: list[SkillModifier] | None = []
    damage_resistances: list[DamageType] | None = []
    damage_immunities: list[DamageType] | None = []
    condition_immunities: list[Condition] | None = []
    senses: Senses | None = None
    languages: list[Language] = []
    challenge: Challenge

    descriptions: list[Description] | None = []
    actions: list[Description] | None = []
    reactions: list[Description] | None = []
    legendary_actions: list[Description] | None = []

    @field_validator('size', mode='before')
    @classmethod
    def normalize_size(cls, value):
        if isinstance(value, str):
            formatted_value = value.replace('_', ' ').replace('-', ' ').strip().lower()
            for e in CreatureSize:
                if e.value.lower() == formatted_value or e.name.lower() == formatted_value:
                    return e
        return value

    @field_validator('alignment', mode='before')
    @classmethod
    def normalize_alignment(cls, value):
        if isinstance(value, str):
            formatted_value = value.replace('_', ' ').replace('-', ' ').strip().lower()
            for e in Alignment:
                if e.value.lower() == formatted_value or e.name.lower() == formatted_value:
                    return e
        return value

    @field_validator('armor', mode='before')
    @classmethod
    def normalize_armor(cls, value):
        if isinstance(value, dict) and 'type' in value and isinstance(value['type'], str):
            formatted_value = value['type'].replace('_', ' ').replace('-', ' ').strip().lower()
            for e in Armor:
                if e.value.lower() == formatted_value or e.name.lower() == formatted_value:
                    value['type'] = e
        return value
