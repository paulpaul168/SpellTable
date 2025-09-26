"""
This module contains the dice model.
"""

from pydantic import BaseModel


class Die(BaseModel):

    faces: int


class DiePool(BaseModel):

    count: int
    die: Die


class ComplexDiePool(BaseModel):

    pools: list[DiePool]
