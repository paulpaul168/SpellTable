"""
Business Results table (Taverne / Manor) — German rules from campaign doc.

Wurf pro Tenday: 1d100 + Valuation + sonstige Boni → lookup → Rohwert as Nd10 (manuell würfeln)
→ then Gewinn × Gewinn-Multiplikator / Verlust × Verlust-Multiplikator (condition).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal

Outcome = Literal["loss", "breakeven", "profit"]


@dataclass(frozen=True)
class BusinessTableRowDef:
    """One row; check_total must fall in [min_total, max_total] inclusive."""

    min_total: int
    max_total: int
    row_id: str
    label_de: str
    label_en: str
    d10_count: int
    outcome: Outcome
    narrative_hint: str | None = None


# Ordered by ascending score bands (lookup scans first match by min/max).
BUSINESS_TABLE_ROWS: tuple[BusinessTableRowDef, ...] = (
    BusinessTableRowDef(
        min_total=-10_000,
        max_total=0,
        row_id="catastrophic_loss",
        label_de="Katastrophaler Verlust",
        label_en="Catastrophic loss",
        d10_count=3,
        outcome="loss",
    ),
    BusinessTableRowDef(
        min_total=1,
        max_total=20,
        row_id="major_loss",
        label_de="Großer Verlust",
        label_en="Major loss",
        d10_count=2,
        outcome="loss",
    ),
    BusinessTableRowDef(
        min_total=21,
        max_total=40,
        row_id="minor_loss",
        label_de="Kleiner Verlust",
        label_en="Minor loss",
        d10_count=1,
        outcome="loss",
    ),
    BusinessTableRowDef(
        min_total=41,
        max_total=60,
        row_id="break_even",
        label_de="Ausgeglichen",
        label_en="Break even",
        d10_count=0,
        outcome="breakeven",
    ),
    BusinessTableRowDef(
        min_total=61,
        max_total=80,
        row_id="minor_profit",
        label_de="Kleiner Gewinn",
        label_en="Minor profit",
        d10_count=1,
        outcome="profit",
    ),
    BusinessTableRowDef(
        min_total=81,
        max_total=90,
        row_id="solid_profit",
        label_de="Solider Gewinn",
        label_en="Solid profit",
        d10_count=2,
        outcome="profit",
    ),
    BusinessTableRowDef(
        min_total=91,
        max_total=100,
        row_id="major_profit",
        label_de="Großer Gewinn",
        label_en="Major profit",
        d10_count=3,
        outcome="profit",
    ),
    BusinessTableRowDef(
        min_total=101,
        max_total=110,
        row_id="excellent_profit",
        label_de="Hervorragender Gewinn",
        label_en="Excellent profit",
        d10_count=4,
        outcome="profit",
    ),
    BusinessTableRowDef(
        min_total=111,
        max_total=120,
        row_id="exceptional_success",
        label_de="Außergewöhnlicher Erfolg",
        label_en="Exceptional success",
        d10_count=5,
        outcome="profit",
    ),
    BusinessTableRowDef(
        min_total=121,
        max_total=10_000,
        row_id="legendary_success",
        label_de="Legendärer Erfolg",
        label_en="Legendary success",
        d10_count=6,
        outcome="profit",
        narrative_hint="Kleines narratives Bonus-Ereignis (DM)",
    ),
)


def lookup_business_row(check_total: int) -> BusinessTableRowDef:
    for row in BUSINESS_TABLE_ROWS:
        if row.min_total <= check_total <= row.max_total:
            return row
    return BUSINESS_TABLE_ROWS[-1]


def effect_dice_label(row: BusinessTableRowDef) -> str:
    if row.d10_count == 0:
        return "0"
    sign = "-" if row.outcome == "loss" else "+"
    return f"{sign}{row.d10_count}d10"


def effect_dice_short_de(row: BusinessTableRowDef) -> str:
    """What to roll at the table, e.g. '3× W10'."""
    if row.d10_count == 0:
        return "—"
    return f"{row.d10_count}× W10"


def roll_sum_valid_range(row: BusinessTableRowDef) -> tuple[int, int]:
    n = row.d10_count
    if n == 0:
        return (0, 0)
    return (n, 10 * n)


def build_roll_instructions(row: BusinessTableRowDef) -> tuple[str, str, int, int]:
    """Human instructions + inclusive valid sum range for manual entry."""
    n = row.d10_count
    lo, hi = roll_sum_valid_range(row)
    if n == 0:
        return (
            "Kein W10-Wurf nötig. Trage bei „Summe W10“ eine 0 ein (Ausgleich).",
            "No d10 roll. Enter 0 for “Sum of d10” (break even).",
            0,
            0,
        )
    if row.outcome == "loss":
        de = (
            f"Würfle {n}× W10 (Zehnerwürfel), addiere alle Augen. "
            f"Gültige Summe: {lo}–{hi}. "
            "Das ist der Rohwert für den Verlust (danach × Verlust-Multiplikator der Condition)."
        )
        en = (
            f"Roll {n}d10 and add all results. Valid total: {lo}–{hi}. "
            "That raw value is then multiplied by the loss multiplier for your condition."
        )
    else:
        de = (
            f"Würfle {n}× W10, addiere alle Augen. "
            f"Gültige Summe: {lo}–{hi}. "
            "Das ist der Rohwert für den Gewinn (danach × Gewinn-Multiplikator der Condition)."
        )
        en = (
            f"Roll {n}d10 and add all results. Valid total: {lo}–{hi}. "
            "That raw value is then multiplied by the profit multiplier for your condition."
        )
    return de, en, lo, hi


def business_table_preview_payload(
    *,
    d100_roll: int,
    check_total: int,
    modifier_breakdown: dict[str, int],
) -> dict[str, Any]:
    row = lookup_business_row(check_total)
    inst_de, inst_en, sum_min, sum_max = build_roll_instructions(row)
    return {
        "d100_roll": d100_roll,
        "check_total": check_total,
        "modifier_breakdown": modifier_breakdown,
        "row_id": row.row_id,
        "label_de": row.label_de,
        "label_en": row.label_en,
        "effect_dice": effect_dice_label(row),
        "dice_to_roll_de": effect_dice_short_de(row),
        "d10_count": row.d10_count,
        "outcome": row.outcome,
        "instruction_de": inst_de,
        "instruction_en": inst_en,
        "effect_dice_sum_min": sum_min,
        "effect_dice_sum_max": sum_max,
        "narrative_hint": row.narrative_hint,
    }


def resolve_business_table_with_manual_sum(
    check_total: int, effect_dice_sum: int
) -> dict[str, Any]:
    """
    Validate manual sum of Nd10, return raw gp magnitude and profit flag for settlement.
    """
    row = lookup_business_row(check_total)
    n = row.d10_count
    lo, hi = roll_sum_valid_range(row)

    if effect_dice_sum < lo or effect_dice_sum > hi:
        raise ValueError(
            f"Summe der W10 muss zwischen {lo} und {hi} liegen (bei diesem Ergebnis: {n} W10). "
            f"Eingegeben: {effect_dice_sum}."
        )

    if row.outcome == "loss":
        raw_table_gp = effect_dice_sum
        is_profit = False
    elif row.outcome == "breakeven":
        raw_table_gp = 0
        is_profit = True
    else:
        raw_table_gp = effect_dice_sum
        is_profit = True

    return {
        "row_id": row.row_id,
        "label_de": row.label_de,
        "label_en": row.label_en,
        "check_total": check_total,
        "outcome": row.outcome,
        "d10_count": n,
        "effect_dice": effect_dice_label(row),
        "effect_dice_sum_entered": effect_dice_sum,
        "raw_table_gp": raw_table_gp,
        "is_profit": is_profit,
        "narrative_hint": row.narrative_hint,
    }


def business_table_reference_rows() -> list[dict[str, Any]]:
    """Static reference for API / UI (no rolls)."""
    out: list[dict[str, Any]] = []
    for row in BUSINESS_TABLE_ROWS:
        rmin, rmax = row.min_total, row.max_total
        if rmin <= -1000:
            band = f"≤ {rmax}"
        elif rmax >= 1000:
            band = f"≥ {rmin}"
        else:
            band = f"{rmin}–{rmax}"
        lo, hi = roll_sum_valid_range(row)
        out.append(
            {
                "result_band": band,
                "row_id": row.row_id,
                "label_de": row.label_de,
                "label_en": row.label_en,
                "effect_dice": effect_dice_label(row),
                "dice_to_roll": effect_dice_short_de(row),
                "sum_range": f"{lo}–{hi}" if row.d10_count else "0",
                "outcome": row.outcome,
                "narrative_hint": row.narrative_hint,
            }
        )
    return out
