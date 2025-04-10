from pydantic import BaseModel
from typing import Dict, Any


class MapData(BaseModel):
    name: str
    data: Dict[str, Any]
