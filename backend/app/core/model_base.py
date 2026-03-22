from pydantic import BaseModel, ConfigDict


class ModelBase(BaseModel):
    # So that enums are serializable
    model_config = ConfigDict(use_enum_values=True)
