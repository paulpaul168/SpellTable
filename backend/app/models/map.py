"""
This module contains the map models.
"""

from typing import Any

from pydantic import BaseModel


class MapData(BaseModel):
    """
    A map data model.
    """

    name: str
    folder: str | None = None
    data: dict[str, Any]


class FolderItem(BaseModel):
    """
    A folder item model.
    """

    name: str
    type: str = "folder"
    path: str
    parent: str | None = None


class FolderRenameRequest(BaseModel):
    """
    A folder rename request model.
    """

    new_name: str


class MapOrderRequest(BaseModel):
    """
    Persist map order within a folder (or root when folder is null/empty).
    """

    folder: str | None = None
    filenames: list[str]
