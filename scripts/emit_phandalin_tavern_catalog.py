#!/usr/bin/env python3
"""Emit frontend/public/tavern-seeds/phandalin-tresendar-manor.json — run from repo root."""

from __future__ import annotations

import json
from pathlib import Path


def R(
    name: str,
    desc: str,
    cost: int = 0,
    days: int = 0,
    fx: object | None = None,
    order: int = 0,
    archived: bool = False,
    group: str | None = None,
) -> dict:
    o: dict = {
        "name": name,
        "description": desc,
        "purchase_cost_gp": cost,
        "setup_days": days,
        "sort_order": order,
        "is_archived": archived,
    }
    if fx is not None:
        o["effect_json"] = fx
    if group:
        o["group"] = group
    return o


def main() -> None:
    n = 0

    def so() -> int:
        nonlocal n
        n += 1
        return n * 10

    defs: list[dict] = []

    # --- Renovation queue (placeholders / planning) ---
    for nm in (
        "Renovation queue: Garden",
        "Renovation queue: Vault",
        "Renovation queue: Cobbled Street",
        "Renovation queue: Stage",
        "Renovation queue: Snug",
    ):
        defs.append(
            R(
                nm,
                "Planning flag — mark purchased when work begins. Adjust cost/days in catalog edit if needed.",
                0,
                0,
                None,
                so(),
                group="queue",
            )
        )

    # --- Manor: required one-time ---
    defs += [
        R(
            "[Manor] City Permits and Guild Licenses",
            "250 gp upfront, 1 day. Enables repairs/improvements; legal compliance.",
            250,
            1,
            None,
            so(),
            group="manor_required_once",
        ),
        R(
            "[Manor] Gutting, Cleaning, Structural and Cosmetic Repairs",
            "1,000 gp, 12 days. Enables further improvements; minimal furnishings baseline; long rest HP +1 until next LR.",
            1000,
            12,
            None,
            so(),
            group="manor_required_once",
        ),
    ]

    # --- Manor: regular ---
    defs += [
        R(
            "[Manor] Guild Contract Fees",
            "5 gp/tenday. Enables improvements; legal compliance during renovations/business.",
            0,
            0,
            {"kind": "recurring_cost_gp_per_tenday", "amount": 5},
            so(),
            group="manor_regular",
        ),
        R(
            "[Manor] City Services and Regular Maintenance",
            "5 gp/tenday. Water/sewer; guilds prevent disrepair.",
            0,
            0,
            {"kind": "recurring_cost_gp_per_tenday", "amount": 5},
            so(),
            group="manor_regular",
        ),
        R(
            "[Manor] Membership — Fellowship of Innkeepers",
            "2 gp/tenday if operating as tavern/inn; party covered.",
            0,
            0,
            {"kind": "recurring_cost_gp_per_tenday", "amount": 2},
            so(),
            group="manor_regular",
        ),
        R(
            "[Manor] Additional Guild Memberships (each)",
            "2 gp/tenday per additional guild (brewers, musicians, magists, smiths, etc.).",
            0,
            0,
            {"kind": "recurring_cost_gp_per_tenday", "amount": 2},
            so(),
            group="manor_regular",
        ),
    ]

    # --- Manor services & upgrades (selected mechanical rows) ---
    defs += [
        R(
            "[Manor] Basic Manor Staff",
            "15 gp/tenday, 3 days. Prereq: Furnishings Basic, Kitchen Cheap. THP = half level on LR.",
            100,
            3,
            {"kind": "recurring_cost_gp_per_tenday", "amount": 15},
            so(),
            group="manor_upgrade",
        ),
        R(
            "[Manor] Manor Service Staff",
            "30 gp/tenday, 5 days. Prereq: Basic Staff, Furnishings Comfortable, Kitchen Mod, Larder Cheap. THP = level on LR; servants' quarters.",
            100,
            5,
            {"kind": "recurring_cost_gp_per_tenday", "amount": 30},
            so(),
            group="manor_upgrade",
        ),
        R(
            "[Manor] Manor Noble Staff",
            "50 gp/tenday, 10 days. Prereq: Service Staff, Furnishings Lavish, Barracks, Shrine or Library, Cobbled Streets, Kitchen Quality, Larder Mod, Cellar Mod. Noble benefits.",
            100,
            10,
            {"kind": "recurring_cost_gp_per_tenday", "amount": 50},
            so(),
            group="manor_upgrade",
        ),
        R(
            "[Manor] Manor Furnishings — Minimal",
            "20 gp, 5 days. HP bonus tier 0 on LR (see doc).",
            20,
            5,
            None,
            so(),
            group="manor_upgrade",
        ),
        R(
            "[Manor] Manor Furnishings — Basic",
            "200 gp, 5 days. HP bonus tier +3 on LR.",
            200,
            5,
            None,
            so(),
            group="manor_upgrade",
        ),
        R(
            "[Manor] Manor Furnishings — Comfortable",
            "400 gp, 5 days. HP bonus tier +9 on LR.",
            400,
            5,
            None,
            so(),
            group="manor_upgrade",
        ),
        R(
            "[Manor] Manor Furnishings — Lavish",
            "1,200 gp, 5 days. HP bonus tier +27 on LR.",
            1200,
            5,
            None,
            so(),
            group="manor_upgrade",
        ),
        R(
            "[Manor] Vault — Basic",
            "400 gp, 10 days. DC 18 lock; 50 cu ft; traps per DMG; door not magic.",
            400,
            10,
            None,
            so(),
            group="manor_upgrade",
        ),
        R(
            "[Manor] Vault — Moderate",
            "900 gp, 10 days. DC 23; 500 cu ft.",
            900,
            10,
            None,
            so(),
            group="manor_upgrade",
        ),
        R(
            "[Manor] Vault — Complex",
            "1,800 gp, 10 days. DC 30; 5,000 cu ft; 1 deadly trap option; magic passphrase option.",
            1800,
            10,
            None,
            so(),
            group="manor_upgrade",
        ),
        R(
            "[Manor] Security Enhancements",
            "200 gp, 2 days. Heavy cover vs outside assault; harder doors/windows.",
            200,
            2,
            None,
            so(),
            group="manor_upgrade",
        ),
        R(
            "[Manor] Magical Security System (minimum)",
            "500+ gp, 5+ days. Prereq: Security Enhancements. Alarm 1st dusk–dawn; scalable per doc.",
            500,
            5,
            None,
            so(),
            group="manor_upgrade",
        ),
        R(
            "[Manor] Barracks",
            "100 gp + 30 gp/tenday, 4 days. Prereq: Basic Staff, Security. 4 guards + veteran master at arms.",
            100,
            4,
            [
                {"kind": "recurring_cost_gp_per_tenday", "amount": 30},
                {"kind": "flag", "key": "manor_barracks"},
            ],
            so(),
            group="manor_upgrade",
        ),
        R(
            "[Manor] Noble Retinue (per 20 soldiers block)",
            "100 gp per 20 soldiers + 30 gp per 10 soldiers/tenday (max 70); 12 days; Prereq Barracks, Noble Staff.",
            100,
            12,
            {"kind": "flag", "key": "noble_retinue"},
            so(),
            group="manor_upgrade",
        ),
        R(
            "[Manor] Basic Manor Insurance",
            "10 gp/tenday, 1 day. Fire/storm/flood/subsidence.",
            0,
            1,
            [
                {"kind": "recurring_cost_gp_per_tenday", "amount": 10},
                {"kind": "flag", "key": "manor_insurance_basic"},
            ],
            so(),
            group="manor_upgrade",
        ),
        R(
            "[Manor] Enhanced Manor Insurance",
            "20 gp/tenday, 1 day. Prereq: Basic Manor Insurance. Hostile physical/magical damage.",
            0,
            1,
            [
                {"kind": "recurring_cost_gp_per_tenday", "amount": 20},
                {"kind": "flag", "key": "manor_insurance_enhanced"},
            ],
            so(),
            group="manor_upgrade",
        ),
        R(
            "[Manor] Local Informants",
            "15 gp/tenday, 3 days. Prereq: Basic Manor Staff. Defenders not surprised; neighbourhood intel.",
            0,
            3,
            {"kind": "recurring_cost_gp_per_tenday", "amount": 15},
            so(),
            group="manor_upgrade",
        ),
        R(
            "[Manor] Information Connection (each org)",
            "20 gp/tenday, 7 days. Prereq: Local Informants, Basic Tavern Staff. Advantage on deals/recall with chosen guild/faction.",
            0,
            7,
            {"kind": "recurring_cost_gp_per_tenday", "amount": 20},
            so(),
            group="manor_upgrade",
        ),
        R(
            "[Manor] Spy Network (each org)",
            "40 gp/tenday, 30 days. Prereq: Information Connection, Snug. 1 question + 1 order per tenday.",
            0,
            30,
            {"kind": "recurring_cost_gp_per_tenday", "amount": 40},
            so(),
            group="manor_upgrade",
        ),
        R(
            "[Manor] Garden (each roof side, max 2)",
            "300 gp, 12 days. Prereq: Basic Manor Staff. Inspiration once; herbs; uses roof space.",
            300,
            12,
            None,
            so(),
            group="manor_upgrade",
        ),
        R(
            "[Manor] Shrine",
            "1,000 gp, 7 days. Prereq: Basic Manor Staff. Divine prep slot bonus; Religion advantage.",
            1000,
            7,
            None,
            so(),
            group="manor_upgrade",
        ),
        R(
            "[Manor] Library",
            "1,000 gp, 7 days. Prereq: Basic Manor Staff. Arcane prep slot bonus; Int checks except Religion.",
            1000,
            7,
            None,
            so(),
            group="manor_upgrade",
        ),
        R(
            "[Manor] Clinic",
            "200 gp + 10 gp/tenday, 6 days. Prereq: Basic Manor Staff. Medicine advantage on LR; death save feature after 7 LRs.",
            200,
            6,
            {"kind": "recurring_cost_gp_per_tenday", "amount": 10},
            so(),
            group="manor_upgrade",
        ),
        R(
            "[Manor] Laboratory",
            "300 gp + 25 gp/tenday, 9 days. Prereq: Basic Staff, Vault. Random potion/tenday; request common potion.",
            300,
            9,
            {"kind": "recurring_cost_gp_per_tenday", "amount": 25},
            so(),
            group="manor_upgrade",
        ),
        R(
            "[Manor] Smithy",
            "400 gp + 25 gp/tenday, 8 days. Prereq: Basic Staff, Vault. Random metal gear/tenday; maintenance reduction.",
            400,
            8,
            {"kind": "recurring_cost_gp_per_tenday", "amount": 25},
            so(),
            group="manor_upgrade",
        ),
        R(
            "[Manor] House Finance Office",
            "150 gp + 15 gp/tenday, 8 days. Prereq: Service Staff, Vault. Reduces guild fees / loss risk (narrative).",
            150,
            8,
            {"kind": "recurring_cost_gp_per_tenday", "amount": 15},
            so(),
            group="manor_upgrade",
        ),
        R(
            "[Manor] Training Course",
            "150 gp, 4 days. Speed +5 or +1 init for a month after training tendays.",
            150,
            4,
            None,
            so(),
            group="manor_upgrade",
        ),
        R(
            "[Manor] Cobbled Street",
            "200 gp, 15 days. Half travel time around manor; +1 business roll if Basic Tavern Staff; Persuasion advantage vs neighbours.",
            200,
            15,
            {"kind": "business_roll_bonus", "amount": 1},
            so(),
            group="manor_upgrade",
        ),
        R(
            "[Manor] Custom: Cartography Studio",
            "200 gp, 5 days. Cartographer advantage after 7 LRs; Work downtime profit doubled with tools.",
            200,
            5,
            None,
            so(),
            group="manor_upgrade",
        ),
        R(
            "[Manor] Custom Manor Renovation",
            "Cost TBD. Discuss with DM.",
            0,
            0,
            None,
            so(),
            group="manor_custom",
        ),
    ]

    # --- Tavern: core staffing & insurance (matches ~74 gp baseline when combined) ---
    defs += [
        R(
            "[Tavern] Basic Tavern Staff",
            "10 gp/tenday, 2 days. Required to operate tavern.",
            0,
            2,
            [
                {"kind": "recurring_cost_gp_per_tenday", "amount": 10},
                {"kind": "flag", "key": "basic_tavern_staff"},
            ],
            so(),
            group="tavern_core",
        ),
        R(
            "[Tavern] Tavern Service Staff",
            "15 gp/tenday, 4 days. Prereq: Basic Staff, Taproom Mod, Kitchen Mod. Valuation +1; required for Quality Taproom.",
            0,
            4,
            [
                {"kind": "recurring_cost_gp_per_tenday", "amount": 15},
                {"kind": "valuation_bonus", "amount": 1},
            ],
            so(),
            group="tavern_core",
        ),
        R(
            "[Tavern] Tavern Bouncers",
            "10 gp/tenday, 6 days. Prereq: Basic Staff, Taproom Cheap. Violence/crime risk; 2 bandits; synergy Barracks/Noble Retinue per doc.",
            0,
            6,
            [
                {"kind": "recurring_cost_gp_per_tenday", "amount": 10},
                {"kind": "flag", "key": "tavern_bouncers"},
            ],
            so(),
            group="tavern_core",
        ),
        R(
            "[Tavern] Tavern Preventative Maintenance",
            "10 gp/tenday. May reduce future expenses.",
            0,
            0,
            {"kind": "recurring_cost_gp_per_tenday", "amount": 10},
            so(),
            group="tavern_core",
        ),
        R(
            "[Tavern] Basic Tavern Insurance",
            "10 gp/tenday, 1 day. Natural disasters. Halved if Basic Manor Insurance.",
            0,
            1,
            [
                {"kind": "recurring_cost_gp_per_tenday", "amount": 10},
                {"kind": "flag", "key": "tavern_insurance_basic"},
            ],
            so(),
            group="tavern_core",
        ),
        R(
            "[Tavern] Enhanced Tavern Insurance",
            "20 gp/tenday, 1 day. Prereq: Basic Tavern Insurance. Hostile damage. Halved if Enhanced Manor Insurance.",
            0,
            1,
            [
                {"kind": "recurring_cost_gp_per_tenday", "amount": 20},
                {"kind": "flag", "key": "tavern_insurance_enhanced"},
            ],
            so(),
            group="tavern_core",
        ),
        R(
            "[Tavern] Membership — Fellowship of Innkeepers",
            "2 gp/tenday (duplicate of manor line if not combined — archive one if using single entry).",
            0,
            0,
            {"kind": "recurring_cost_gp_per_tenday", "amount": 2},
            so(),
            group="tavern_regular",
        ),
        R(
            "[Tavern] Guild Contract Fees (tavern op)",
            "5 gp/tenday if tracked separately from manor.",
            0,
            0,
            {"kind": "recurring_cost_gp_per_tenday", "amount": 5},
            so(),
            group="tavern_regular",
        ),
        R(
            "[Tavern] City Services (tavern)",
            "5 gp/tenday if tracked separately from manor.",
            0,
            0,
            {"kind": "recurring_cost_gp_per_tenday", "amount": 5},
            so(),
            group="tavern_regular",
        ),
    ]

    # Taproom / kitchen / cellar tiers
    for label, cost, days, v in (
        ("Cheap", 200, 12, 1),
        ("Moderate", 500, 12, 3),
        ("Quality", 1000, 12, 5),
    ):
        defs.append(
            R(
                f"[Tavern] Taproom ({label})",
                f"{cost} gp, {days} days. Valuation +{v}. Minimum cheap to operate.",
                cost,
                days,
                {"kind": "valuation_bonus", "amount": v},
                so(),
                group="tavern_structure",
            )
        )
    for label, cost, days, v in (
        ("Cheap", 200, 7, 1),
        ("Moderate", 500, 7, 3),
        ("Quality", 1000, 7, 5),
    ):
        defs.append(
            R(
                f"[Tavern] Kitchen ({label})",
                f"{cost} gp, {days} days. Valuation +{v}. Enables Hold Feast.",
                cost,
                days,
                {"kind": "valuation_bonus", "amount": v},
                so(),
                group="tavern_structure",
            )
        )
    for label, cost, days, v in (
        ("Cheap", 200, 3, 1),
        ("Moderate", 500, 3, 3),
        ("Quality", 1000, 3, 5),
    ):
        defs.append(
            R(
                f"[Tavern] Larder ({label})",
                f"{cost} gp, {days} days. Prereq Kitchen Cheap. Valuation +{v}.",
                cost,
                days,
                {"kind": "valuation_bonus", "amount": v},
                so(),
                group="tavern_structure",
            )
        )
    for label, cost, days, v in (
        ("Cheap", 400, 5, 1),
        ("Moderate", 650, 5, 3),
        ("Quality", 800, 5, 5),
    ):
        defs.append(
            R(
                f"[Tavern] Cellar ({label})",
                f"{cost} gp, {days} days. Valuation +{v}. Smuggling downtime.",
                cost,
                days,
                {"kind": "valuation_bonus", "amount": v},
                so(),
                group="tavern_structure",
            )
        )
    for label, cost, days, v in (
        ("Cheap", 200, 6, 2),
        ("Moderate", 500, 6, 3),
        ("Quality", 1000, 6, 4),
    ):
        defs.append(
            R(
                f"[Tavern] Privy ({label})",
                f"{cost} gp, {days} days. Prereq Taproom Cheap. Valuation +{v}.",
                cost,
                days,
                {"kind": "valuation_bonus", "amount": v},
                so(),
                group="tavern_structure",
            )
        )

    defs += [
        R(
            "[Tavern] Brewery — Cheap",
            "200 gp, 5 days. Prereq Cellar Cheap. Valuation +1; half cellar; Brewing downtime.",
            200,
            5,
            {"kind": "valuation_bonus", "amount": 1},
            so(),
            group="tavern_structure",
        ),
        R(
            "[Tavern] Brewery — Moderate",
            "450 gp, 5 days. Valuation +3.",
            450,
            5,
            {"kind": "valuation_bonus", "amount": 3},
            so(),
            group="tavern_structure",
        ),
        R(
            "[Tavern] Brewery — Quality",
            "600 gp, 5 days. Valuation +5.",
            600,
            5,
            {"kind": "valuation_bonus", "amount": 5},
            so(),
            group="tavern_structure",
        ),
        R(
            "[Tavern] Distillery — Cheap",
            "400 gp, 5 days. Prereq Cellar Cheap. Valuation +1.",
            400,
            5,
            {"kind": "valuation_bonus", "amount": 1},
            so(),
            group="tavern_structure",
        ),
        R(
            "[Tavern] Distillery — Moderate",
            "650 gp, 5 days. Valuation +3.",
            650,
            5,
            {"kind": "valuation_bonus", "amount": 3},
            so(),
            group="tavern_structure",
        ),
        R(
            "[Tavern] Distillery — Quality",
            "800 gp, 5 days. Valuation +5.",
            800,
            5,
            {"kind": "valuation_bonus", "amount": 5},
            so(),
            group="tavern_structure",
        ),
        R(
            "[Tavern] Winery — Cheap",
            "500 gp, 7 days. Prereq Cellar Moderate. Valuation +2; vineyard; half cellar.",
            500,
            7,
            {"kind": "valuation_bonus", "amount": 2},
            so(),
            group="tavern_structure",
        ),
        R(
            "[Tavern] Winery — Moderate",
            "750 gp, 7 days. Valuation +4.",
            750,
            7,
            {"kind": "valuation_bonus", "amount": 4},
            so(),
            group="tavern_structure",
        ),
        R(
            "[Tavern] Winery — Quality",
            "1,200 gp, 7 days. Valuation +6.",
            1200,
            7,
            {"kind": "valuation_bonus", "amount": 6},
            so(),
            group="tavern_structure",
        ),
        R(
            "[Tavern] Steam-Powered Tap",
            "650 gp, 10 days. Prereq Cellar w/ beer space. Valuation +4. Beer Festival downtime.",
            650,
            10,
            {"kind": "valuation_bonus", "amount": 4},
            so(),
            group="tavern_structure",
        ),
        R(
            "[Tavern] Beer Garden",
            "200 gp, 3 days. Prereq Taproom Cheap. Valuation +2. Outdoor BBQ; not winter.",
            200,
            3,
            {"kind": "valuation_bonus", "amount": 2},
            so(),
            group="tavern_structure",
        ),
        R(
            "[Tavern] Stage (per taproom/saloon/beer garden)",
            "200 gp, 3 days. Prereq Taproom Cheap, Service Staff. Valuation +1. Perform downtime.",
            200,
            3,
            {"kind": "valuation_bonus", "amount": 1},
            so(),
            group="tavern_structure",
        ),
        R(
            "[Tavern] Dance Floor (per indoor stage)",
            "300 gp, 4 days. Prereq Entertainment, Stage. Valuation +1. Dance Night downtime.",
            300,
            4,
            {"kind": "valuation_bonus", "amount": 1},
            so(),
            group="tavern_structure",
        ),
        R(
            "[Tavern] Snug",
            "400 gp, 6 days. Prereq Taproom Cheap. Valuation +1. Spying downtime.",
            400,
            6,
            {"kind": "valuation_bonus", "amount": 1},
            so(),
            group="tavern_structure",
        ),
        R(
            "[Tavern] Tavern Entertainment (per stage)",
            "15 gp/tenday, 6 days. Prereq Basic Staff, Taproom Cheap, Stage. Valuation +1; d6 odd +1 / even +3 to business table (DM).",
            0,
            6,
            [
                {"kind": "recurring_cost_gp_per_tenday", "amount": 15},
                {"kind": "valuation_bonus", "amount": 1},
            ],
            so(),
            group="tavern_structure",
        ),
        R(
            "[Tavern] Saloon Bar — Cheap",
            "500 gp, 12 days. Prereq Taproom Cheap, Kitchen Cheap, Snug, Entertainment. Valuation +2. Carousing advantage.",
            500,
            12,
            {"kind": "valuation_bonus", "amount": 2},
            so(),
            group="tavern_structure",
        ),
        R(
            "[Tavern] Saloon Bar — Moderate",
            "700 gp, 12 days. Valuation +4.",
            700,
            12,
            {"kind": "valuation_bonus", "amount": 4},
            so(),
            group="tavern_structure",
        ),
        R(
            "[Tavern] Saloon Bar — Quality",
            "1,200 gp, 12 days. Valuation +6.",
            1200,
            12,
            {"kind": "valuation_bonus", "amount": 6},
            so(),
            group="tavern_structure",
        ),
        R(
            "[Tavern] Feasting Hall — Cheap",
            "500 gp, 8 days. Prereq Service Staff, Kitchen Mod, Larder Mod. Valuation +2. Banquet downtime.",
            500,
            8,
            {"kind": "valuation_bonus", "amount": 2},
            so(),
            group="tavern_structure",
        ),
        R(
            "[Tavern] Feasting Hall — Moderate",
            "750 gp, 8 days. Valuation +4.",
            750,
            8,
            {"kind": "valuation_bonus", "amount": 4},
            so(),
            group="tavern_structure",
        ),
        R(
            "[Tavern] Feasting Hall — Quality",
            "1,200 gp, 8 days. Valuation +6.",
            1200,
            8,
            {"kind": "valuation_bonus", "amount": 6},
            so(),
            group="tavern_structure",
        ),
        R(
            "[Tavern] Business Office",
            "200 gp, 6 days. Prereq Taproom Cheap, Basic Staff. Valuation +1. Marketing downtime.",
            200,
            6,
            {"kind": "valuation_bonus", "amount": 1},
            so(),
            group="tavern_structure",
        ),
        R(
            "[Tavern] Splendorous Window",
            "Special: valuation +1 (stack with DM approval).",
            0,
            0,
            {"kind": "valuation_bonus", "amount": 1},
            so(),
            group="tavern_structure",
        ),
    ]

    # Guest rooms 1–6
    rooms = [
        (1, 400, 1),
        (2, 650, 3),
        (3, 900, 5),
        (4, 1150, 7),
        (5, 1400, 9),
        (6, 1650, 11),
    ]
    for rnum, cost, v in rooms:
        defs.append(
            R(
                f"[Tavern] Guest Rooms ({rnum} room{'s' if rnum > 1 else ''})",
                f"{cost} gp, 10 days. Valuation +{v}. Recruit hirelings downtime. Prereq per doc.",
                cost,
                10,
                {"kind": "valuation_bonus", "amount": v},
                so(),
                group="tavern_structure",
            )
        )

    defs += [
        R(
            "[Tavern] Stable — Cheap",
            "400 gp, 20 days. Prereq Guest 1+. Valuation +2.",
            400,
            20,
            {"kind": "valuation_bonus", "amount": 2},
            so(),
            group="tavern_structure",
        ),
        R(
            "[Tavern] Stable — Moderate",
            "650 gp, 20 days. Valuation +4.",
            650,
            20,
            {"kind": "valuation_bonus", "amount": 4},
            so(),
            group="tavern_structure",
        ),
        R(
            "[Tavern] Stable — Quality",
            "800 gp, 20 days. Valuation +6.",
            800,
            20,
            {"kind": "valuation_bonus", "amount": 6},
            so(),
            group="tavern_structure",
        ),
        R(
            "[Tavern] Coach House — Cheap",
            "400 gp, 20 days. Prereq Guest 4+, Stable Quality. Valuation +1. Noble connection downtime.",
            400,
            20,
            {"kind": "valuation_bonus", "amount": 1},
            so(),
            group="tavern_structure",
        ),
        R(
            "[Tavern] Coach House — Moderate",
            "650 gp, 20 days. Valuation +3.",
            650,
            20,
            {"kind": "valuation_bonus", "amount": 3},
            so(),
            group="tavern_structure",
        ),
        R(
            "[Tavern] Coach House — Quality",
            "800 gp, 20 days. Valuation +5.",
            800,
            20,
            {"kind": "valuation_bonus", "amount": 5},
            so(),
            group="tavern_structure",
        ),
        R(
            "[Tavern] Custom Tavern Renovation",
            "Cost TBD. Discuss with DM.",
            0,
            0,
            None,
            so(),
            group="tavern_custom",
        ),
    ]

    out = {
        "version": 1,
        "catalog_name": "Tresendar Manor / Phandalin (Dragon Heist style)",
        "definitions": defs,
    }

    root = Path(__file__).resolve().parents[1]
    dest = root / "frontend" / "public" / "tavern-seeds" / "phandalin-tresendar-manor.json"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(out, indent=2), encoding="utf-8")
    print(f"Wrote {len(defs)} definitions to {dest}")


if __name__ == "__main__":
    main()
