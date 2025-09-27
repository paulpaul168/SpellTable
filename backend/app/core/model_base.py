from pydantic import ConfigDict, BaseModel


class ModelBase(BaseModel):
    # So that enums are serializable
    model_config = ConfigDict(use_enum_values=True)
