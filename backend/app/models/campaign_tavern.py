"""
Per-campaign tavern simulation: state, option catalog, purchases, ledger.
"""

from datetime import datetime
from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, Field
from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from .user import Base


class TavernInstanceStatus(StrEnum):
    PENDING_SETUP = "pending_setup"
    ACTIVE = "active"
    CANCELLED = "cancelled"


class CampaignTavernState(Base):
    __tablename__ = "campaign_tavern_states"

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"), unique=True, nullable=False)
    current_day = Column(Integer, default=0, nullable=False)
    valuation = Column(Integer, default=0, nullable=False)
    condition = Column(String(32), default="modest", nullable=False)
    situational_business_bonus = Column(Integer, default=0, nullable=False)
    treasury_gp = Column(Integer, default=0, nullable=False)
    days_per_tenday = Column(Integer, default=10, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    campaign = relationship("Campaign", back_populates="tavern_state")


class TavernOptionDefinition(Base):
    __tablename__ = "tavern_option_definitions"

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"), nullable=False)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    purchase_cost_gp = Column(Integer, default=0, nullable=False)
    setup_days = Column(Integer, default=0, nullable=False)
    effect_json = Column(JSON, nullable=True)
    sort_order = Column(Integer, default=0, nullable=False)
    is_archived = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    campaign = relationship("Campaign", back_populates="tavern_option_definitions")
    instances = relationship(
        "TavernOptionInstance", back_populates="definition", cascade="all, delete-orphan"
    )


class TavernOptionInstance(Base):
    __tablename__ = "tavern_option_instances"

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"), nullable=False)
    definition_id = Column(
        Integer, ForeignKey("tavern_option_definitions.id"), nullable=False
    )
    status = Column(String(32), default=TavernInstanceStatus.PENDING_SETUP, nullable=False)
    purchased_on_day = Column(Integer, nullable=False)
    activates_on_day = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    campaign = relationship("Campaign", back_populates="tavern_option_instances")
    definition = relationship("TavernOptionDefinition", back_populates="instances")


class TavernLedgerEntry(Base):
    __tablename__ = "tavern_ledger_entries"

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"), nullable=False)
    settled_day = Column(Integer, nullable=False)
    payload_json = Column(JSON, nullable=False)
    net_change_gp = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    campaign = relationship("Campaign", back_populates="tavern_ledger_entries")


# --- Pydantic API schemas ---


class TavernStateResponse(BaseModel):
    id: int
    campaign_id: int
    current_day: int
    valuation: int
    condition: str
    situational_business_bonus: int
    treasury_gp: int
    days_per_tenday: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TavernStateUpdate(BaseModel):
    current_day: int | None = None
    valuation: int | None = None
    condition: str | None = None
    situational_business_bonus: int | None = None
    treasury_gp: int | None = None
    days_per_tenday: int | None = None


class TavernAdvanceDaysBody(BaseModel):
    days: int = Field(..., ge=1, le=3650)


class TavernOptionDefinitionCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: str | None = None
    purchase_cost_gp: int = Field(default=0, ge=0)
    setup_days: int = Field(default=0, ge=0)
    effect_json: dict | list | None = None
    sort_order: int = 0


class TavernOptionDefinitionUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=200)
    description: str | None = None
    purchase_cost_gp: int | None = Field(None, ge=0)
    setup_days: int | None = Field(None, ge=0)
    effect_json: dict | list | None = None
    sort_order: int | None = None
    is_archived: bool | None = None


class TavernOptionDefinitionResponse(BaseModel):
    id: int
    campaign_id: int
    name: str
    description: str | None
    purchase_cost_gp: int
    setup_days: int
    effect_json: dict | list | None
    sort_order: int
    is_archived: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TavernOptionInstanceResponse(BaseModel):
    id: int
    campaign_id: int
    definition_id: int
    status: str
    purchased_on_day: int
    activates_on_day: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TavernOptionInstanceCreate(BaseModel):
    definition_id: int


class TavernOptionInstancePatch(BaseModel):
    status: str | None = None  # cancelled only in v1


class TavernSettleTendayBody(BaseModel):
    d100_roll: int | None = Field(None, ge=1, le=100)
    raw_table_gp: int = Field(default=0, ge=0)
    is_profit: bool = True
    manual_adjustment_gp: int = 0
    apply: bool = False
    use_business_table: bool = Field(
        default=False,
        description="If True, require d100_roll and effect_dice_sum (manual Nd10 total for the row).",
    )
    effect_dice_sum: int | None = Field(
        None,
        ge=0,
        description="Sum of Nd10 after table lookup; 0 for break-even row. Required when use_business_table.",
    )


class TavernBusinessTableRowRef(BaseModel):
    result_band: str
    row_id: str
    label_de: str
    label_en: str
    effect_dice: str
    dice_to_roll: str = ""
    sum_range: str = ""
    outcome: str
    narrative_hint: str | None = None


class TavernBusinessPreviewBody(BaseModel):
    d100_roll: int = Field(..., ge=1, le=100)


class TavernBusinessPreviewResponse(BaseModel):
    d100_roll: int
    check_total: int
    modifier_breakdown: dict[str, int]
    row_id: str
    label_de: str
    label_en: str
    effect_dice: str
    dice_to_roll_de: str
    d10_count: int
    outcome: str
    instruction_de: str
    instruction_en: str
    effect_dice_sum_min: int
    effect_dice_sum_max: int
    narrative_hint: str | None = None


class TavernBusinessTableResponse(BaseModel):
    formula_de: str
    formula_en: str
    rows: list[TavernBusinessTableRowRef]


class TavernActiveEffectsSummary(BaseModel):
    fixed_income_gp_per_tenday: int
    recurring_cost_gp_per_tenday: int
    business_roll_bonus: int
    valuation_bonus: int = 0
    flags: list[str]


class TavernLedgerEntryResponse(BaseModel):
    id: int
    campaign_id: int
    settled_day: int
    payload_json: dict
    net_change_gp: int
    created_at: datetime

    class Config:
        from_attributes = True


class TavernBundleResponse(BaseModel):
    state: TavernStateResponse
    definitions: list[TavernOptionDefinitionResponse]
    instances: list[TavernOptionInstanceResponse]
    active_effects: TavernActiveEffectsSummary
    multipliers: dict[str, int]
    ledger: list[TavernLedgerEntryResponse]


class TavernSettleTendayResult(BaseModel):
    preview: dict
    treasury_gp_after: int | None = None
    ledger_entry: TavernLedgerEntryResponse | None = None


class TavernCatalogEntry(BaseModel):
    """Portable catalog row (no DB id). effect_json may be a dict or list of effect dicts."""

    name: str = Field(..., min_length=1, max_length=200)
    description: str | None = None
    purchase_cost_gp: int = Field(default=0, ge=0)
    setup_days: int = Field(default=0, ge=0)
    effect_json: dict | list | None = None
    sort_order: int = 0
    is_archived: bool = False
    group: str | None = Field(None, max_length=80)


class TavernCatalogExportResponse(BaseModel):
    version: int = 1
    catalog_name: str | None = None
    definitions: list[TavernCatalogEntry]


class TavernCatalogImportBody(BaseModel):
    """append: skip names that already exist. replace_all: delete all instances and definitions first."""

    mode: Literal["append", "replace_all"]
    definitions: list[TavernCatalogEntry]
    catalog_name: str | None = None


class TavernCatalogImportResult(BaseModel):
    bundle: TavernBundleResponse
    added: int
    skipped: int
