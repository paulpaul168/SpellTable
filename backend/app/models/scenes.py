"""
This module contains the scene models.
"""

from typing import Any, Optional

from pydantic import BaseModel


class SceneImage(BaseModel):
    """
    A scene image model.
    """

    id: str
    name: str
    path: str


class SceneData(BaseModel):
    """
    A scene data model.
    """

    id: str
    name: str
    folder: Optional[str] = None
    maps: list[dict[str, Any]] = []
    activeMapId: Optional[str] = None
    gridSettings: dict[str, Any] = {"showGrid": True, "gridSize": 50}
    initiativeOrder: list[dict[str, Any]] = []
    showCurrentPlayer: bool = True
    images: list[SceneImage] = []


class FolderCreateRequest(BaseModel):
    """
    A folder create request model.
    """

    folder_name: str
    parent_folder: Optional[str] = None


class FolderRenameRequest(BaseModel):
    """
    A folder rename request model.
    """

    new_name: str
