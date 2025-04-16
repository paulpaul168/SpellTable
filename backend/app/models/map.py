"""
This module contains the map models.
"""

from typing import Any, Dict, Optional

from pydantic import BaseModel


class MapData(BaseModel):
    """
    A map data model.
    """

    name: str
    folder: Optional[str] = None
    data: Dict[str, Any]


class FolderItem(BaseModel):
    """
    A folder item model.
    """

    name: str
    type: str = "folder"
    path: str
    parent: Optional[str] = None
