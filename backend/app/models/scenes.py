"""
This module contains the scene models.
"""

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


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

    model_config = ConfigDict(populate_by_name=True)

    id: str
    name: str
    folder: str | None = None
    maps: list[dict[str, Any]] = []
    active_map_id: str | None = Field(default=None, alias="activeMapId")
    grid_settings: dict[str, Any] = Field(
        default_factory=lambda: {"showGrid": True, "gridSize": 50},
        alias="gridSettings",
    )
    initiative_order: list[dict[str, Any]] = Field(
        default_factory=list,
        alias="initiativeOrder",
    )
    show_current_player: bool = Field(default=True, alias="showCurrentPlayer")
    images: list[SceneImage] = []


class FolderCreateRequest(BaseModel):
    """
    A folder create request model.
    """

    folder_name: str
    parent_folder: str | None = None


class FolderRenameRequest(BaseModel):
    """
    A folder rename request model.
    """

    new_name: str
