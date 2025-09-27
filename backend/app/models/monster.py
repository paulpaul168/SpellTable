"""
This module contains the monster models.
"""
from typing import Optional

from ..core.model_base import ModelBase
from ..core.types import CreatureSize, DamageType, Condition, Language, SavingThrow, Skill, Armor, Alignment


class ArmorClass(ModelBase):
    ac: int
    type: Armor = Armor.NATURAL_ARMOR
    shield: bool = False


class HitPoints(ModelBase):
    average: int
    hit_dice: str


class Speed(ModelBase):
    walk: Optional[int] = None
    fly: Optional[int] = None
    swim: Optional[int] = None
    burrow: Optional[int] = None
    climb: Optional[int] = None


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
    darkvision: Optional[int] = None


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
    alignment: Optional[Alignment] = None
    armor: ArmorClass
    hp: HitPoints
    speed: Speed

    ability_scores: Optional[AbilityScores] = None

    saving_throws: Optional[list[SavingThrowModifier]] = []
    skills: Optional[list[SkillModifier]] = []
    damage_resistances: Optional[list[DamageType]] = []
    damage_immunities: Optional[list[DamageType]] = []
    condition_immunities: Optional[list[Condition]] = []
    senses: Optional[Senses] = None
    languages: list[Language] = []
    challenge: Challenge

    descriptions: Optional[list[Description]] = []
    actions: Optional[list[Description]] = []
    reactions: Optional[list[Description]] = []
    legendary_actions: Optional[list[Description]] = []
