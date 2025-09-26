"""
This module contains the monster models.
"""
from typing import Optional

from pydantic import BaseModel

from ..core.types import CreatureSize, DamageType, Condition, Language, SavingThrow, Skill, Armor, Alignment


class ArmorClass(BaseModel):
    ac: int
    type: Armor = Armor.NATURAL_ARMOR
    shield: bool = False


class HitPoints(BaseModel):
    average: int
    hit_dice: str


class Speed(BaseModel):
    walk: Optional[int] = None
    fly: Optional[int] = None
    swim: Optional[int] = None
    burrow: Optional[int] = None
    climb: Optional[int] = None


class AbilityScores(BaseModel):
    strength: int
    dexterity: int
    constitution: int
    intelligence: int
    wisdom: int
    charisma: int


class SavingThrowModifier(BaseModel):
    saving_throw: SavingThrow
    modifier: int


class SkillModifier(BaseModel):
    skill: Skill
    modifier: int


class Senses(BaseModel):
    passive_perception: int
    darkvision: Optional[int] = None


class Challenge(BaseModel):
    rating: float
    xp: float


class Description(BaseModel):
    title: str
    description: str


# A monster model.
class Monster(BaseModel):
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
