"""
Tavern simulation API: state, catalog, purchases, day advancement, tenday settlement.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from loguru import logger
from sqlalchemy.orm import Session

from ..core.auth import get_current_active_user, require_admin_role
from ..core.database import get_db
from ..core.tavern_business_table import (
    business_table_preview_payload,
    business_table_reference_rows,
    resolve_business_table_with_manual_sum,
)
from ..core.tavern_rules import (
    VALID_TAVERN_CONDITIONS,
    aggregate_effects,
    business_check_total,
    multipliers_for_condition,
    normalize_condition,
    settle_tenday_net,
)
from ..models.campaign import Campaign
from ..models.campaign_tavern import (
    CampaignTavernState,
    TavernActiveEffectsSummary,
    TavernAdvanceDaysBody,
    TavernBundleResponse,
    TavernBusinessPreviewBody,
    TavernBusinessPreviewResponse,
    TavernBusinessTableResponse,
    TavernBusinessTableRowRef,
    TavernCatalogEntry,
    TavernCatalogExportResponse,
    TavernCatalogImportBody,
    TavernCatalogImportResult,
    TavernInstanceStatus,
    TavernLedgerEntry,
    TavernLedgerEntryPatch,
    TavernLedgerEntryResponse,
    TavernLedgerManualBody,
    TavernOptionDefinition,
    TavernOptionDefinitionCreate,
    TavernOptionDefinitionResponse,
    TavernOptionDefinitionUpdate,
    TavernOptionInstance,
    TavernOptionInstanceCreate,
    TavernOptionInstancePatch,
    TavernOptionInstanceResponse,
    TavernSettleTendayBody,
    TavernSettleTendayResult,
    TavernStateResponse,
    TavernStateUpdate,
)
from ..models.user import User

router = APIRouter()


def _campaign_access(campaign: Campaign | None, user: User) -> None:
    if not campaign:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")
    if user.role != "admin" and user not in campaign.users:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this campaign",
        )


def _get_campaign(db: Session, campaign_id: int) -> Campaign | None:
    return db.query(Campaign).filter(Campaign.id == campaign_id).first()


def _get_or_create_state(db: Session, campaign_id: int) -> CampaignTavernState:
    row = (
        db.query(CampaignTavernState)
        .filter(CampaignTavernState.campaign_id == campaign_id)
        .first()
    )
    if row:
        return row
    row = CampaignTavernState(campaign_id=campaign_id)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def _promote_instances(db: Session, campaign_id: int, current_day: int) -> None:
    pending = (
        db.query(TavernOptionInstance)
        .filter(
            TavernOptionInstance.campaign_id == campaign_id,
            TavernOptionInstance.status == TavernInstanceStatus.PENDING_SETUP,
            TavernOptionInstance.activates_on_day <= current_day,
        )
        .all()
    )
    for inst in pending:
        inst.status = TavernInstanceStatus.ACTIVE
    if pending:
        db.commit()


def _active_instance_effects(db: Session, campaign_id: int) -> dict:
    instances = (
        db.query(TavernOptionInstance)
        .filter(
            TavernOptionInstance.campaign_id == campaign_id,
            TavernOptionInstance.status == TavernInstanceStatus.ACTIVE,
        )
        .all()
    )
    effects: list[dict | None] = []
    for inst in instances:
        defn = (
            db.query(TavernOptionDefinition)
            .filter(TavernOptionDefinition.id == inst.definition_id)
            .first()
        )
        if defn:
            effects.append(defn.effect_json if isinstance(defn.effect_json, dict) else None)
    return aggregate_effects(effects)


def _build_bundle(db: Session, campaign_id: int) -> TavernBundleResponse:
    state = _get_or_create_state(db, campaign_id)
    definitions = (
        db.query(TavernOptionDefinition)
        .filter(TavernOptionDefinition.campaign_id == campaign_id)
        .order_by(
            TavernOptionDefinition.sort_order,
            TavernOptionDefinition.id,
        )
        .all()
    )
    instances = (
        db.query(TavernOptionInstance)
        .filter(TavernOptionInstance.campaign_id == campaign_id)
        .order_by(TavernOptionInstance.id.desc())
        .all()
    )
    ae = _active_instance_effects(db, campaign_id)
    pm, lm = multipliers_for_condition(state.condition)
    ledger_rows = (
        db.query(TavernLedgerEntry)
        .filter(TavernLedgerEntry.campaign_id == campaign_id)
        .order_by(TavernLedgerEntry.id.desc())
        .limit(50)
        .all()
    )
    return TavernBundleResponse(
        state=TavernStateResponse.model_validate(state),
        definitions=[TavernOptionDefinitionResponse.model_validate(d) for d in definitions],
        instances=[TavernOptionInstanceResponse.model_validate(i) for i in instances],
        active_effects=TavernActiveEffectsSummary(**ae),
        multipliers={"profit": pm, "loss": lm},
        ledger=[TavernLedgerEntryResponse.model_validate(e) for e in reversed(ledger_rows)],
    )


@router.get(
    "/campaigns/{campaign_id}/tavern",
    response_model=TavernBundleResponse,
)
async def get_tavern(
    campaign_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    campaign = _get_campaign(db, campaign_id)
    _campaign_access(campaign, current_user)
    return _build_bundle(db, campaign_id)


@router.get(
    "/campaigns/{campaign_id}/tavern/business-table",
    response_model=TavernBusinessTableResponse,
)
async def get_tavern_business_table(
    campaign_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    campaign = _get_campaign(db, campaign_id)
    _campaign_access(campaign, current_user)
    rows = [TavernBusinessTableRowRef(**r) for r in business_table_reference_rows()]
    return TavernBusinessTableResponse(
        formula_de="1d100 + Bewertung + sonstige Boni (einmal pro Tenday)",
        formula_en="1d100 + valuation + other bonuses (once per tenday)",
        rows=rows,
    )


@router.post(
    "/campaigns/{campaign_id}/tavern/business-table-preview",
    response_model=TavernBusinessPreviewResponse,
)
async def preview_tavern_business_table(
    campaign_id: int,
    body: TavernBusinessPreviewBody,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    campaign = _get_campaign(db, campaign_id)
    _campaign_access(campaign, current_user)
    state = _get_or_create_state(db, campaign_id)
    ae = _active_instance_effects(db, campaign_id)
    check_total = business_check_total(
        body.d100_roll,
        state.valuation,
        state.situational_business_bonus,
        ae["valuation_bonus"],
        ae["business_roll_bonus"],
    )
    if check_total is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not compute business check total",
        )
    modifier_breakdown = {
        "d100": body.d100_roll,
        "valuation": state.valuation,
        "valuation_bonus_upgrades": ae["valuation_bonus"],
        "situational_bonus": state.situational_business_bonus,
        "roll_bonus_upgrades": ae["business_roll_bonus"],
    }
    payload = business_table_preview_payload(
        d100_roll=body.d100_roll,
        check_total=check_total,
        modifier_breakdown=modifier_breakdown,
    )
    return TavernBusinessPreviewResponse(**payload)


def _definition_to_catalog_entry(d: TavernOptionDefinition) -> TavernCatalogEntry:
    return TavernCatalogEntry(
        name=d.name,
        description=d.description,
        purchase_cost_gp=d.purchase_cost_gp,
        setup_days=d.setup_days,
        effect_json=d.effect_json,
        sort_order=d.sort_order,
        is_archived=d.is_archived,
        group=None,
    )


@router.get(
    "/campaigns/{campaign_id}/tavern/catalog-export",
    response_model=TavernCatalogExportResponse,
)
async def export_tavern_catalog(
    campaign_id: int,
    catalog_name: str | None = Query(None),
    _admin: User = Depends(require_admin_role),
    db: Session = Depends(get_db),
):
    campaign = _get_campaign(db, campaign_id)
    _campaign_access(campaign, _admin)
    definitions = (
        db.query(TavernOptionDefinition)
        .filter(TavernOptionDefinition.campaign_id == campaign_id)
        .order_by(TavernOptionDefinition.sort_order, TavernOptionDefinition.id)
        .all()
    )
    return TavernCatalogExportResponse(
        catalog_name=catalog_name,
        definitions=[_definition_to_catalog_entry(d) for d in definitions],
    )


@router.post(
    "/campaigns/{campaign_id}/tavern/catalog-import",
    response_model=TavernCatalogImportResult,
)
async def import_tavern_catalog(
    campaign_id: int,
    body: TavernCatalogImportBody,
    _admin: User = Depends(require_admin_role),
    db: Session = Depends(get_db),
):
    campaign = _get_campaign(db, campaign_id)
    _campaign_access(campaign, _admin)
    _get_or_create_state(db, campaign_id)

    def _normalize_effect(ej: dict | list | None) -> dict | list | None:
        if ej is None:
            return None
        if isinstance(ej, dict):
            return ej
        if isinstance(ej, list):
            cleaned: list[dict] = []
            for item in ej:
                if isinstance(item, dict):
                    cleaned.append(item)
            return cleaned or None
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="effect_json must be an object, array of objects, or null",
        )

    if body.mode == "replace_all":
        db.query(TavernOptionInstance).filter(
            TavernOptionInstance.campaign_id == campaign_id
        ).delete()
        db.query(TavernOptionDefinition).filter(
            TavernOptionDefinition.campaign_id == campaign_id
        ).delete()
        db.commit()

    existing: set[str] = set()
    if body.mode == "append":
        for (nm,) in (
            db.query(TavernOptionDefinition.name)
            .filter(TavernOptionDefinition.campaign_id == campaign_id)
            .all()
        ):
            existing.add(nm.strip())

    added = 0
    skipped = 0
    for entry in body.definitions:
        name = entry.name.strip()
        if not name:
            continue
        if body.mode == "append" and name in existing:
            skipped += 1
            continue
        db.add(
            TavernOptionDefinition(
                campaign_id=campaign_id,
                name=name,
                description=entry.description,
                purchase_cost_gp=entry.purchase_cost_gp,
                setup_days=entry.setup_days,
                effect_json=_normalize_effect(entry.effect_json),
                sort_order=entry.sort_order,
                is_archived=entry.is_archived,
            )
        )
        existing.add(name)
        added += 1
    db.commit()
    logger.info(
        "Tavern catalog import campaign_id={} mode={} added={} skipped={}",
        campaign_id,
        body.mode,
        added,
        skipped,
    )
    return TavernCatalogImportResult(
        bundle=_build_bundle(db, campaign_id),
        added=added,
        skipped=skipped,
    )


@router.put(
    "/campaigns/{campaign_id}/tavern/state",
    response_model=TavernBundleResponse,
)
async def update_tavern_state(
    campaign_id: int,
    body: TavernStateUpdate,
    _admin: User = Depends(require_admin_role),
    db: Session = Depends(get_db),
):
    campaign = _get_campaign(db, campaign_id)
    _campaign_access(campaign, _admin)
    state = _get_or_create_state(db, campaign_id)
    data = body.model_dump(exclude_unset=True)
    if "condition" in data and data["condition"] is not None:
        c = normalize_condition(data["condition"])
        if c not in VALID_TAVERN_CONDITIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid condition. Use one of: {sorted(VALID_TAVERN_CONDITIONS)}",
            )
        data["condition"] = c
    for key, val in data.items():
        setattr(state, key, val)
    db.commit()
    db.refresh(state)
    _promote_instances(db, campaign_id, state.current_day)
    return _build_bundle(db, campaign_id)


@router.post(
    "/campaigns/{campaign_id}/tavern/advance-days",
    response_model=TavernBundleResponse,
)
async def advance_tavern_days(
    campaign_id: int,
    body: TavernAdvanceDaysBody,
    _admin: User = Depends(require_admin_role),
    db: Session = Depends(get_db),
):
    campaign = _get_campaign(db, campaign_id)
    _campaign_access(campaign, _admin)
    state = _get_or_create_state(db, campaign_id)
    state.current_day += body.days
    db.commit()
    _promote_instances(db, campaign_id, state.current_day)
    return _build_bundle(db, campaign_id)


@router.post(
    "/campaigns/{campaign_id}/tavern/definitions",
    response_model=TavernBundleResponse,
)
async def create_tavern_definition(
    campaign_id: int,
    body: TavernOptionDefinitionCreate,
    _admin: User = Depends(require_admin_role),
    db: Session = Depends(get_db),
):
    campaign = _get_campaign(db, campaign_id)
    _campaign_access(campaign, _admin)
    _get_or_create_state(db, campaign_id)
    row = TavernOptionDefinition(
        campaign_id=campaign_id,
        name=body.name.strip(),
        description=body.description,
        purchase_cost_gp=body.purchase_cost_gp,
        setup_days=body.setup_days,
        effect_json=body.effect_json,
        sort_order=body.sort_order,
    )
    db.add(row)
    db.commit()
    return _build_bundle(db, campaign_id)


@router.put(
    "/campaigns/{campaign_id}/tavern/definitions/{definition_id}",
    response_model=TavernBundleResponse,
)
async def update_tavern_definition(
    campaign_id: int,
    definition_id: int,
    body: TavernOptionDefinitionUpdate,
    _admin: User = Depends(require_admin_role),
    db: Session = Depends(get_db),
):
    campaign = _get_campaign(db, campaign_id)
    _campaign_access(campaign, _admin)
    row = (
        db.query(TavernOptionDefinition)
        .filter(
            TavernOptionDefinition.id == definition_id,
            TavernOptionDefinition.campaign_id == campaign_id,
        )
        .first()
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Definition not found")
    data = body.model_dump(exclude_unset=True)
    if "name" in data and data["name"] is not None:
        data["name"] = data["name"].strip()
    for key, val in data.items():
        setattr(row, key, val)
    db.commit()
    return _build_bundle(db, campaign_id)


@router.post(
    "/campaigns/{campaign_id}/tavern/instances",
    response_model=TavernBundleResponse,
)
async def create_tavern_instance(
    campaign_id: int,
    body: TavernOptionInstanceCreate,
    _admin: User = Depends(require_admin_role),
    db: Session = Depends(get_db),
):
    campaign = _get_campaign(db, campaign_id)
    _campaign_access(campaign, _admin)
    state = _get_or_create_state(db, campaign_id)
    defn = (
        db.query(TavernOptionDefinition)
        .filter(
            TavernOptionDefinition.id == body.definition_id,
            TavernOptionDefinition.campaign_id == campaign_id,
        )
        .first()
    )
    if not defn:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Definition not found")
    purchased = state.current_day
    activates = purchased + defn.setup_days
    st = (
        TavernInstanceStatus.ACTIVE
        if activates <= state.current_day
        else TavernInstanceStatus.PENDING_SETUP
    )
    inst = TavernOptionInstance(
        campaign_id=campaign_id,
        definition_id=defn.id,
        status=st,
        purchased_on_day=purchased,
        activates_on_day=activates,
    )
    db.add(inst)
    db.commit()
    _promote_instances(db, campaign_id, state.current_day)
    return _build_bundle(db, campaign_id)


@router.patch(
    "/campaigns/{campaign_id}/tavern/instances/{instance_id}",
    response_model=TavernBundleResponse,
)
async def patch_tavern_instance(
    campaign_id: int,
    instance_id: int,
    body: TavernOptionInstancePatch,
    _admin: User = Depends(require_admin_role),
    db: Session = Depends(get_db),
):
    campaign = _get_campaign(db, campaign_id)
    _campaign_access(campaign, _admin)
    inst = (
        db.query(TavernOptionInstance)
        .filter(
            TavernOptionInstance.id == instance_id,
            TavernOptionInstance.campaign_id == campaign_id,
        )
        .first()
    )
    if not inst:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instance not found")
    if body.status is not None:
        if body.status != TavernInstanceStatus.CANCELLED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only status 'cancelled' is supported",
            )
        inst.status = TavernInstanceStatus.CANCELLED
    db.commit()
    return _build_bundle(db, campaign_id)


@router.post(
    "/campaigns/{campaign_id}/tavern/settle-tenday",
    response_model=TavernSettleTendayResult,
)
async def settle_tavern_tenday(
    campaign_id: int,
    body: TavernSettleTendayBody,
    _admin: User = Depends(require_admin_role),
    db: Session = Depends(get_db),
):
    campaign = _get_campaign(db, campaign_id)
    _campaign_access(campaign, _admin)
    state = _get_or_create_state(db, campaign_id)
    ae = _active_instance_effects(db, campaign_id)

    check_total = business_check_total(
        body.d100_roll,
        state.valuation,
        state.situational_business_bonus,
        ae["valuation_bonus"],
        ae["business_roll_bonus"],
    )

    business_table_detail = None
    if body.use_business_table:
        if body.d100_roll is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="d100_roll (1–100) is required when use_business_table is true",
            )
        if check_total is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Could not compute business check total",
            )
        if body.effect_dice_sum is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="effect_dice_sum is required when use_business_table (sum of Nd10, or 0 if break even)",
            )
        try:
            business_table_detail = resolve_business_table_with_manual_sum(
                check_total, body.effect_dice_sum
            )
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
        raw_gp = int(business_table_detail["raw_table_gp"])
        is_profit = bool(business_table_detail["is_profit"])
    else:
        raw_gp = body.raw_table_gp
        is_profit = body.is_profit

    try:
        settlement = settle_tenday_net(
            raw_table_gp=raw_gp,
            is_profit=is_profit,
            condition=state.condition,
            fixed_income_gp_per_tenday=ae["fixed_income_gp_per_tenday"],
            recurring_cost_gp_per_tenday=ae["recurring_cost_gp_per_tenday"],
            manual_adjustment_gp=body.manual_adjustment_gp,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e

    preview: dict = {
        "settlement": settlement,
        "d100_roll": body.d100_roll,
        "business_check_total": check_total,
        "active_flags": ae["flags"],
    }
    if business_table_detail is not None:
        preview["business_table"] = business_table_detail
    ledger_entry = None
    treasury_after = None
    if body.apply:
        state.treasury_gp += settlement["net_change_gp"]
        db.add(
            TavernLedgerEntry(
                campaign_id=campaign_id,
                settled_day=state.current_day,
                payload_json=preview,
                net_change_gp=settlement["net_change_gp"],
            )
        )
        db.commit()
        db.refresh(state)
        treasury_after = state.treasury_gp
        le = (
            db.query(TavernLedgerEntry)
            .filter(TavernLedgerEntry.campaign_id == campaign_id)
            .order_by(TavernLedgerEntry.id.desc())
            .first()
        )
        if le:
            ledger_entry = TavernLedgerEntryResponse.model_validate(le)
    return TavernSettleTendayResult(
        preview=preview,
        treasury_gp_after=treasury_after,
        ledger_entry=ledger_entry,
    )


@router.post(
    "/campaigns/{campaign_id}/tavern/ledger",
    response_model=TavernBundleResponse,
)
async def add_tavern_ledger_entry(
    campaign_id: int,
    body: TavernLedgerManualBody,
    _admin: User = Depends(require_admin_role),
    db: Session = Depends(get_db),
):
    campaign = _get_campaign(db, campaign_id)
    _campaign_access(campaign, _admin)
    state = _get_or_create_state(db, campaign_id)
    payload: dict = {
        "manual_entry": True,
        "note": body.note or "",
        "settlement": {"net_change_gp": body.net_change_gp, "manual": True},
    }
    state.treasury_gp += body.net_change_gp
    db.add(
        TavernLedgerEntry(
            campaign_id=campaign_id,
            settled_day=body.settled_day,
            payload_json=payload,
            net_change_gp=body.net_change_gp,
        )
    )
    db.commit()
    return _build_bundle(db, campaign_id)


@router.patch(
    "/campaigns/{campaign_id}/tavern/ledger/{entry_id}",
    response_model=TavernBundleResponse,
)
async def patch_tavern_ledger_entry(
    campaign_id: int,
    entry_id: int,
    body: TavernLedgerEntryPatch,
    _admin: User = Depends(require_admin_role),
    db: Session = Depends(get_db),
):
    campaign = _get_campaign(db, campaign_id)
    _campaign_access(campaign, _admin)
    state = _get_or_create_state(db, campaign_id)
    entry = (
        db.query(TavernLedgerEntry)
        .filter(
            TavernLedgerEntry.id == entry_id,
            TavernLedgerEntry.campaign_id == campaign_id,
        )
        .first()
    )
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ledger entry not found")
    if body.net_change_gp is not None:
        delta = body.net_change_gp - entry.net_change_gp
        state.treasury_gp += delta
        entry.net_change_gp = body.net_change_gp
    if body.settled_day is not None:
        entry.settled_day = body.settled_day
    if body.payload_json is not None:
        entry.payload_json = body.payload_json
    db.commit()
    return _build_bundle(db, campaign_id)


@router.delete(
    "/campaigns/{campaign_id}/tavern/ledger/{entry_id}",
    response_model=TavernBundleResponse,
)
async def delete_tavern_ledger_entry(
    campaign_id: int,
    entry_id: int,
    _admin: User = Depends(require_admin_role),
    db: Session = Depends(get_db),
):
    campaign = _get_campaign(db, campaign_id)
    _campaign_access(campaign, _admin)
    state = _get_or_create_state(db, campaign_id)
    entry = (
        db.query(TavernLedgerEntry)
        .filter(
            TavernLedgerEntry.id == entry_id,
            TavernLedgerEntry.campaign_id == campaign_id,
        )
        .first()
    )
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ledger entry not found")
    state.treasury_gp -= entry.net_change_gp
    db.delete(entry)
    db.commit()
    return _build_bundle(db, campaign_id)
