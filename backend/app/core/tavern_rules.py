"""
Tavern simulation rules: condition multipliers and effect_json parsing.

effect_json schema (v1) — each TavernOptionDefinition.effect_json is one object:

- Fixed income per tenday (no roll multiplier applied):
  {"kind": "fixed_income_gp_per_tenday", "amount": <int>}

- Recurring cost per tenday (subtracted after business result):
  {"kind": "recurring_cost_gp_per_tenday", "amount": <int>}

- Bonus added to the business check (1d100 + valuation + situational + these):
  {"kind": "business_roll_bonus", "amount": <int>}

- Named flag for display / future automation (bouncers, insurance_basic, etc.):
  {"kind": "flag", "key": "<str>"}

Unknown kinds are ignored when aggregating; invalid payloads are skipped safely.
"""

from __future__ import annotations

from typing import Any

# DM selects tier explicitly (not derived from valuation).
VALID_TAVERN_CONDITIONS: frozenset[str] = frozenset(
    {
        "squalid",
        "poor",
        "modest",
        "comfortable",
        "wealthy",
        "aristocratic",
    }
)

# (profit_multiplier, loss_multiplier)
CONDITION_MULTIPLIERS: dict[str, tuple[int, int]] = {
    "squalid": (1, 3),
    "poor": (3, 4),
    "modest": (5, 5),
    "comfortable": (7, 6),
    "wealthy": (9, 6),
    "aristocratic": (12, 4),
}


def normalize_condition(raw: str) -> str:
    return raw.strip().lower()


def multipliers_for_condition(condition: str) -> tuple[int, int]:
    key = normalize_condition(condition)
    if key not in CONDITION_MULTIPLIERS:
        return CONDITION_MULTIPLIERS["modest"]
    return CONDITION_MULTIPLIERS[key]


def effect_from_json(effect_json: Any) -> dict[str, Any] | None:
    if not isinstance(effect_json, dict):
        return None
    kind = effect_json.get("kind")
    if kind == "fixed_income_gp_per_tenday":
        amt = effect_json.get("amount")
        if isinstance(amt, int) and amt >= 0:
            return {"kind": kind, "amount": amt}
    elif kind == "recurring_cost_gp_per_tenday":
        amt = effect_json.get("amount")
        if isinstance(amt, int) and amt >= 0:
            return {"kind": kind, "amount": amt}
    elif kind == "business_roll_bonus":
        amt = effect_json.get("amount")
        if isinstance(amt, int):
            return {"kind": kind, "amount": amt}
    elif kind == "flag":
        key = effect_json.get("key")
        if isinstance(key, str) and key.strip():
            return {"kind": kind, "key": key.strip()}
    return None


def aggregate_effects(effect_dicts: list[dict[str, Any] | None]) -> dict[str, Any]:
    fixed_income = 0
    recurring = 0
    business_bonus = 0
    flags: list[str] = []
    for eff in effect_dicts:
        parsed = effect_from_json(eff)
        if not parsed:
            continue
        k = parsed["kind"]
        if k == "fixed_income_gp_per_tenday":
            fixed_income += int(parsed["amount"])
        elif k == "recurring_cost_gp_per_tenday":
            recurring += int(parsed["amount"])
        elif k == "business_roll_bonus":
            business_bonus += int(parsed["amount"])
        elif k == "flag":
            flags.append(str(parsed["key"]))
    return {
        "fixed_income_gp_per_tenday": fixed_income,
        "recurring_cost_gp_per_tenday": recurring,
        "business_roll_bonus": business_bonus,
        "flags": sorted(set(flags)),
    }


def business_check_total(
    d100_roll: int | None,
    valuation: int,
    situational_business_bonus: int,
    effect_business_bonus: int,
) -> int | None:
    if d100_roll is None:
        return None
    return d100_roll + valuation + situational_business_bonus + effect_business_bonus


def settle_tenday_net(
    *,
    raw_table_gp: int,
    is_profit: bool,
    condition: str,
    fixed_income_gp_per_tenday: int,
    recurring_cost_gp_per_tenday: int,
    manual_adjustment_gp: int = 0,
) -> dict[str, Any]:
    """
    Apply multipliers to raw table gp, then recurring/fixed and manual adjustment.

    Profit: +raw * profit_mult. Loss: -raw * loss_mult.
    Net = business_component - recurring + fixed + manual_adjustment.
    """
    if raw_table_gp < 0:
        raise ValueError("raw_table_gp must be non-negative")
    pm, lm = multipliers_for_condition(condition)
    if is_profit:
        business = raw_table_gp * pm
    else:
        business = -(raw_table_gp * lm)
    net = business - recurring_cost_gp_per_tenday + fixed_income_gp_per_tenday + manual_adjustment_gp
    return {
        "profit_multiplier": pm,
        "loss_multiplier": lm,
        "raw_table_gp": raw_table_gp,
        "is_profit": is_profit,
        "business_component_gp": business,
        "fixed_income_gp_per_tenday": fixed_income_gp_per_tenday,
        "recurring_cost_gp_per_tenday": recurring_cost_gp_per_tenday,
        "manual_adjustment_gp": manual_adjustment_gp,
        "net_change_gp": net,
    }
