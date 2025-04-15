from pydantic import BaseModel
from typing import Dict, Any, Optional


class MapData(BaseModel):
    name: str
    folder: Optional[str] = None
    data: Dict[str, Any]


class FolderItem(BaseModel):
    name: str
    type: str = "folder"
    path: str
    parent: Optional[str] = None
