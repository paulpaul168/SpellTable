"""
This module contains the monster models.
"""

from pydantic import BaseModel

class Challenge(BaseModel):
    """
    A challenge model.
    """

    rating: float
    xp: float

class HitPoints(BaseModel):
    """
    A hit points model.
    """

    average: int
    hit_dice: str

class Monster(BaseModel):
    """
    A monster model.
    """

    name: str
    challenge: Challenge
    hp: HitPoints
