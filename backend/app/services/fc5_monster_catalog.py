"""
Optional BYO Fight Club 5e (FC5) monster catalog.

Indexes `<monster>` entries from XML under FC5_ROOT (e.g. Complete_Compendium_5e.xml)
and converts them to SpellTable-shaped dicts. Disabled when FC5_ROOT is unset.
Content is never committed — personal/BYO only.
"""

from __future__ import annotations

import os
import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from pathlib import Path

from loguru import logger

_HP_RE = re.compile(r"^\s*(\d+)\s*(?:\(([^)]+)\))?\s*$")
_SPEED_PART_RE = re.compile(
    r"(?:^|,\s*)(?:(walk|fly|swim|climb|burrow)\s+)?(\d+)\s*ft\.?",
    re.IGNORECASE,
)
_SKILL_RE = re.compile(r"([A-Za-z][A-Za-z' ]+?)\s*([+-]\d+)")
_SAVE_RE = re.compile(r"(Str|Dex|Con|Int|Wis|Cha)\s*([+-]\d+)", re.IGNORECASE)
_CHALLENGE_RE = re.compile(r"^\s*(\d+)(?:\s*/\s*(\d+))?\s*$")
_SOURCE_RE = re.compile(r"Source:\s*(.+)", re.IGNORECASE | re.DOTALL)
_SPELL_ABILITY_RE = re.compile(
    r"spellcasting ability is\s+(\w+)",
    re.IGNORECASE,
)
_SPELL_DC_RE = re.compile(r"spell save DC\s+(\d+)", re.IGNORECASE)
_SPELL_ATK_RE = re.compile(r"([+-]\d+)\s+to hit with spell attacks", re.IGNORECASE)
_SPELL_LINE_RE = re.compile(
    r"[•\-\*]\s*(Cantrips?|At will|\d+(?:st|nd|rd|th)\s+level|\d+/day)[^\n:]*:\s*(.+)",
    re.IGNORECASE,
)
_LEVEL_IN_LINE_RE = re.compile(r"(\d+)(?:st|nd|rd|th)\s+level", re.IGNORECASE)
_PER_DAY_RE = re.compile(r"(\d+)\s*/\s*day", re.IGNORECASE)

_SIZE_MAP = {
    "T": "Tiny",
    "S": "Small",
    "M": "Medium",
    "L": "Large",
    "H": "Huge",
    "G": "Gargantuan",
    "TINY": "Tiny",
    "SMALL": "Small",
    "MEDIUM": "Medium",
    "LARGE": "Large",
    "HUGE": "Huge",
    "GARGANTUAN": "Gargantuan",
}

_PREFERRED_FILES = (
    "Complete_Compendium_5e.xml",
    "Core_Rulebooks_5e.xml",
    "System_Reference_Document_5e.xml",
)


@dataclass(frozen=True)
class Fc5CreatureSummary:
    id: str
    name: str
    source: str | None
    size: str | None
    challenge: float | None
    ac: int | None
    hp_average: int | None
    creature_type: str | None


class Fc5MonsterCatalogService:
    _instance: Fc5MonsterCatalogService | None = None

    def __new__(cls) -> Fc5MonsterCatalogService:
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False  # type: ignore[attr-defined]
        return cls._instance

    def __init__(self) -> None:
        if getattr(self, "_initialized", False):
            return
        self._initialized = True
        self._root: Path | None = None
        self._summaries: list[Fc5CreatureSummary] | None = None
        self._monsters: dict[str, dict] = {}
        self._root_mtime_token: str | None = None

    @staticmethod
    def configured_root() -> Path | None:
        raw = os.environ.get("FC5_ROOT", "").strip()
        if not raw:
            return None
        path = Path(raw)
        return path if path.is_dir() else None

    def is_available(self) -> bool:
        return self.configured_root() is not None

    def _dir_token(self, root: Path) -> str:
        try:
            newest = max(
                (p.stat().st_mtime for p in root.glob("*.xml")),
                default=0.0,
            )
            return f"{root}:{newest}"
        except OSError:
            return str(root)

    def _xml_files(self, root: Path) -> list[Path]:
        preferred = [root / name for name in _PREFERRED_FILES if (root / name).is_file()]
        if preferred:
            # Prefer the largest/most complete first file only when Complete exists
            complete = root / "Complete_Compendium_5e.xml"
            if complete.is_file():
                return [complete]
            return preferred
        return sorted(root.glob("*.xml"))

    def _refresh_if_needed(self) -> bool:
        root = self.configured_root()
        if root is None:
            self._root = None
            self._summaries = None
            self._monsters = {}
            self._root_mtime_token = None
            return False

        token = self._dir_token(root)
        if (
            self._summaries is not None
            and self._root == root
            and self._root_mtime_token == token
        ):
            return True

        self._root = root
        self._root_mtime_token = token
        self._summaries, self._monsters = self._scan(root)
        logger.info(
            "FC5 monster catalog loaded: {} creatures from {}",
            len(self._summaries),
            root,
        )
        return True

    def list_creatures(
        self,
        query: str | None = None,
        *,
        limit: int | None = 200,
    ) -> list[Fc5CreatureSummary] | None:
        if not self._refresh_if_needed() or self._summaries is None:
            return None
        items = list(self._summaries)
        if query and query.strip():
            q = query.strip().lower()

            def rank(c: Fc5CreatureSummary) -> tuple[int, str]:
                name = c.name.lower()
                if name == q:
                    return (0, name)
                if name.startswith(q):
                    return (1, name)
                if re.search(rf"\b{re.escape(q)}\b", name):
                    return (2, name)
                if q in name or q in c.id.lower():
                    return (3, name)
                if (c.creature_type or "").lower().find(q) >= 0:
                    return (4, name)
                if (c.source or "").lower().find(q) >= 0:
                    return (5, name)
                return (9, name)

            items = [
                c
                for c in items
                if q in c.name.lower()
                or q in c.id.lower()
                or (c.source or "").lower().find(q) >= 0
                or (c.creature_type or "").lower().find(q) >= 0
            ]
            items.sort(key=rank)
        if limit is not None and limit > 0:
            return items[:limit]
        return items

    def get_creature_monster(self, creature_id: str) -> dict | None:
        if not self._refresh_if_needed():
            return None
        monster = self._monsters.get(creature_id)
        if monster is None:
            return None
        # Return a shallow copy so callers can mutate safely
        return dict(monster)

    def _scan(
        self, root: Path
    ) -> tuple[list[Fc5CreatureSummary], dict[str, dict]]:
        summaries: list[Fc5CreatureSummary] = []
        monsters: dict[str, dict] = {}
        slug_counts: dict[str, int] = {}

        for path in self._xml_files(root):
            try:
                for _event, el in ET.iterparse(path, events=("end",)):
                    if el.tag != "monster":
                        continue
                    name = (el.findtext("name") or "").strip()
                    if not name:
                        el.clear()
                        continue
                    base_slug = self._slugify(name)
                    n = slug_counts.get(base_slug, 0) + 1
                    slug_counts[base_slug] = n
                    creature_id = base_slug if n == 1 else f"{base_slug}--{n}"

                    monster = self._monster_from_element(el, creature_id)
                    summary = Fc5CreatureSummary(
                        id=creature_id,
                        name=name,
                        source=monster.get("fc5_source"),
                        size=monster.get("size"),
                        challenge=(monster.get("challenge") or {}).get("rating"),
                        ac=(monster.get("armor") or {}).get("ac"),
                        hp_average=(monster.get("hp") or {}).get("average"),
                        creature_type=monster.get("fc5_creature_type"),
                    )
                    summaries.append(summary)
                    monsters[creature_id] = monster
                    el.clear()
            except OSError as exc:
                logger.warning("Skipping unreadable FC5 file {}: {}", path, exc)
            except ET.ParseError as exc:
                logger.warning("Failed to parse FC5 file {}: {}", path, exc)

        summaries.sort(key=lambda c: c.name.lower())
        return summaries, monsters

    def _monster_from_element(self, el: ET.Element, creature_id: str) -> dict:
        name = (el.findtext("name") or creature_id).strip()
        size = self._parse_size(el.findtext("size"))
        alignment = self._normalize_alignment(el.findtext("alignment") or "unaligned")
        ac, armor_type, shield = self._parse_ac(el.findtext("ac") or "10")
        hp_avg, hit_dice = self._parse_hp(el.findtext("hp") or "1")
        speed = self._parse_speed(el.findtext("speed") or "30 ft.")
        challenge_rating = self._parse_challenge(el.findtext("cr") or "0") or 0.0

        ability_scores = {
            "strength": self._parse_int(el.findtext("str")) or 10,
            "dexterity": self._parse_int(el.findtext("dex")) or 10,
            "constitution": self._parse_int(el.findtext("con")) or 10,
            "intelligence": self._parse_int(el.findtext("int")) or 10,
            "wisdom": self._parse_int(el.findtext("wis")) or 10,
            "charisma": self._parse_int(el.findtext("cha")) or 10,
        }

        passive = self._parse_int(el.findtext("passive")) or 10
        senses = self._parse_senses(el.findtext("senses") or "", passive)
        languages = self._parse_languages(el.findtext("languages") or "")
        skills = self._parse_skills(el.findtext("skill") or "")
        saving_throws = self._parse_saves(el.findtext("save") or "")

        descriptions = self._named_blocks(el, "trait")
        actions = self._named_blocks(el, "action")
        reactions = self._named_blocks(el, "reaction")
        legendary_actions = self._named_blocks(el, "legendary")

        creature_type = (el.findtext("type") or "").strip() or None
        source = self._parse_source(el.findtext("description") or "")

        if creature_type:
            descriptions = [
                {"title": "Type", "description": creature_type},
                *descriptions,
            ]

        spellcasting = self._parse_spellcasting(el)

        return {
            "name": name,
            "size": size,
            "alignment": alignment,
            "armor": {
                "ac": ac,
                "type": armor_type,
                "shield": shield,
            },
            "hp": {
                "average": hp_avg or 1,
                "hit_dice": hit_dice or "1d8",
            },
            "speed": speed,
            "ability_scores": ability_scores,
            "saving_throws": saving_throws,
            "skills": skills,
            "damage_resistances": self._parse_damage_list(el.findtext("resist")),
            "damage_immunities": self._parse_damage_list(el.findtext("immune")),
            "condition_immunities": self._parse_condition_list(
                el.findtext("conditionImmune")
            ),
            "senses": senses,
            "languages": languages,
            "challenge": {
                "rating": challenge_rating,
                "xp": 0,
            },
            "descriptions": descriptions,
            "actions": actions,
            "reactions": reactions,
            "legendary_actions": legendary_actions,
            "spellcasting": spellcasting,
            "fc5_id": creature_id,
            "fc5_source": source,
            "fc5_creature_type": creature_type,
        }

    def _parse_spellcasting(self, el: ET.Element) -> dict | None:
        slots_raw = (el.findtext("slots") or "").strip()
        spells_csv = (el.findtext("spells") or "").strip()
        sc_texts: list[str] = []
        for trait in el.findall("trait"):
            tname = (trait.findtext("name") or "").lower()
            if "spell" in tname:
                sc_texts.append(trait.findtext("text") or "")

        if not slots_raw and not spells_csv and not sc_texts:
            return None

        joined = "\n".join(sc_texts)
        ability = None
        am = _SPELL_ABILITY_RE.search(joined)
        if am:
            ability = am.group(1).capitalize()
        save_dc = self._parse_int(
            (_SPELL_DC_RE.search(joined).group(1) if _SPELL_DC_RE.search(joined) else None)
        )
        atk_m = _SPELL_ATK_RE.search(joined)
        attack_bonus = int(atk_m.group(1)) if atk_m else None

        slots = self._parse_slots(slots_raw)
        spells = self._parse_spells_from_text(joined)
        if not spells and spells_csv:
            spells = [
                {"name": n.strip(), "level": 0, "usage": "slot"}
                for n in spells_csv.split(",")
                if n.strip()
            ]

        if not slots and not spells:
            return None

        return {
            "ability": ability,
            "save_dc": save_dc,
            "attack_bonus": attack_bonus,
            "slots": slots,
            "spells": spells,
        }

    @staticmethod
    def _parse_slots(raw: str) -> list[int] | None:
        if not raw.strip():
            return None
        parts: list[int] = []
        for p in raw.split(","):
            p = p.strip()
            if not p:
                continue
            try:
                parts.append(int(p))
            except ValueError:
                parts.append(0)
        if not parts:
            return None
        # FC5: first value is cantrip placeholder; rest are L1–L9
        level_slots = parts[1:] if len(parts) > 1 else parts
        while len(level_slots) < 9:
            level_slots.append(0)
        return level_slots[:9]

    @staticmethod
    def _parse_spells_from_text(text: str) -> list[dict]:
        out: list[dict] = []
        seen: set[str] = set()
        for line in text.splitlines():
            m = _SPELL_LINE_RE.search(line.strip())
            if not m:
                continue
            header = m.group(1)
            names_blob = m.group(2)
            level = 0
            usage = "slot"
            per_day = None
            header_l = header.lower()
            if "cantrip" in header_l or "at will" in header_l:
                level = 0
                usage = "at_will"
            elif _PER_DAY_RE.search(header):
                usage = "per_day"
                per_day = int(_PER_DAY_RE.search(header).group(1))  # type: ignore[union-attr]
                level = 0
            else:
                lm = _LEVEL_IN_LINE_RE.search(header)
                if lm:
                    level = int(lm.group(1))
            for name in re.split(r",|;", names_blob):
                spell_name = name.strip().rstrip(".")
                if not spell_name:
                    continue
                key = spell_name.lower()
                if key in seen:
                    continue
                seen.add(key)
                entry: dict = {
                    "name": spell_name,
                    "level": level,
                    "usage": usage,
                }
                if per_day is not None:
                    entry["per_day"] = per_day
                out.append(entry)
        return out

    @staticmethod
    def _named_blocks(el: ET.Element, tag: str) -> list[dict]:
        out: list[dict] = []
        for child in el.findall(tag):
            title = (child.findtext("name") or tag).strip()
            # Join multiple <text> nodes if present
            texts = [
                (t.text or "").strip()
                for t in child.findall("text")
                if (t.text or "").strip()
            ]
            if not texts:
                raw = (child.findtext("text") or "").strip()
                texts = [raw] if raw else ["—"]
            out.append({"title": title, "description": "\n".join(texts)})
        return out

    @staticmethod
    def _slugify(name: str) -> str:
        slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
        return slug or "creature"

    @staticmethod
    def _parse_int(value: str | None) -> int | None:
        if value is None or str(value).strip() == "":
            return None
        raw = str(value).strip()
        try:
            return int(raw)
        except ValueError:
            m = re.match(r"^(-?\d+)", raw)
            return int(m.group(1)) if m else None

    @staticmethod
    def _parse_size(raw: str | None) -> str:
        key = (raw or "M").strip()
        return _SIZE_MAP.get(key, _SIZE_MAP.get(key.upper(), "Medium"))

    @staticmethod
    def _parse_ac(raw: str) -> tuple[int, str, bool]:
        ac = 10
        m = re.match(r"^\s*(\d+)", raw or "")
        if m:
            ac = int(m.group(1))
        lower = (raw or "").lower()
        shield = "shield" in lower
        armor_type = "Natural Armor"
        for label, value in (
            ("plate", "Plate"),
            ("splint", "Splint"),
            ("chain mail", "Chain Mail"),
            ("ring mail", "Ring Mail"),
            ("half plate", "Half Plate"),
            ("breastplate", "Breastplate"),
            ("scale mail", "Scale Mail"),
            ("chain shirt", "Chain Shirt"),
            ("hide", "Hide"),
            ("studded leather", "Studded Leather"),
            ("leather", "Leather"),
            ("padded", "Padded"),
            ("natural armor", "Natural Armor"),
        ):
            if label in lower:
                armor_type = value
                break
        return ac, armor_type, shield

    @staticmethod
    def _parse_hp(raw: str) -> tuple[int | None, str | None]:
        m = _HP_RE.match(raw or "")
        if not m:
            return None, None
        avg = int(m.group(1))
        dice = (m.group(2) or "").strip() or None
        return avg, dice

    @staticmethod
    def _parse_speed(raw: str) -> dict[str, int | None]:
        speed: dict[str, int | None] = {
            "walk": None,
            "fly": None,
            "swim": None,
            "climb": None,
            "burrow": None,
        }
        if not raw:
            speed["walk"] = 30
            return speed
        first = True
        for m in _SPEED_PART_RE.finditer(raw):
            kind = (m.group(1) or "").lower()
            value = int(m.group(2))
            if not kind:
                if first:
                    speed["walk"] = value
                    first = False
                continue
            if kind in speed:
                speed[kind] = value
            first = False
        if speed["walk"] is None:
            speed["walk"] = 30
        return speed

    @staticmethod
    def _parse_challenge(raw: str) -> float | None:
        text = (raw or "").strip()
        if not text:
            return 0.0
        m = _CHALLENGE_RE.match(text)
        if not m:
            try:
                return float(text)
            except ValueError:
                return None
        num = int(m.group(1))
        den = m.group(2)
        if den:
            return num / int(den)
        return float(num)

    @staticmethod
    def _parse_skills(raw: str) -> list[dict]:
        out: list[dict] = []
        for m in _SKILL_RE.finditer(raw or ""):
            out.append({"skill": m.group(1).strip(), "modifier": int(m.group(2))})
        return out

    @staticmethod
    def _parse_saves(raw: str) -> list[dict]:
        out: list[dict] = []
        for m in _SAVE_RE.finditer(raw or ""):
            out.append(
                {
                    "saving_throw": m.group(1).upper(),
                    "modifier": int(m.group(2)),
                }
            )
        return out

    @staticmethod
    def _parse_senses(raw: str, passive: int) -> dict:
        result: dict = {"passive_perception": passive}
        dm = re.search(r"darkvision\s+(\d+)", raw or "", re.IGNORECASE)
        if dm:
            result["darkvision"] = int(dm.group(1))
        return result

    @staticmethod
    def _parse_languages(raw: str) -> list[str]:
        if not raw or raw.strip() in {"—", "-", "—"}:
            return []
        return [p.strip() for p in re.split(r",|;", raw) if p.strip()]

    @staticmethod
    def _parse_damage_list(raw: str | None) -> list[str]:
        if not raw or not raw.strip():
            return []
        # Keep free-form; import path can sanitize to enum
        return [p.strip() for p in re.split(r",|;", raw) if p.strip()]

    @staticmethod
    def _parse_condition_list(raw: str | None) -> list[str]:
        if not raw or not raw.strip():
            return []
        return [p.strip() for p in re.split(r",|;", raw) if p.strip()]

    @staticmethod
    def _parse_source(raw: str) -> str | None:
        m = _SOURCE_RE.search(raw or "")
        if not m:
            return None
        text = re.sub(r"\s+", " ", m.group(1)).strip()
        return text[:120] if text else None

    @staticmethod
    def _normalize_alignment(raw: str) -> str:
        value = (raw or "unaligned").strip().lower().replace("-", " ").replace("_", " ")
        mapping = {
            "lawful good": "Lawful Good",
            "neutral good": "Neutral Good",
            "chaotic good": "Chaotic Good",
            "lawful neutral": "Lawful Neutral",
            "neutral": "Neutral",
            "true neutral": "Neutral",
            "chaotic neutral": "Chaotic Neutral",
            "lawful evil": "Lawful Evil",
            "neutral evil": "Neutral Evil",
            "chaotic evil": "Chaotic Evil",
            "unaligned": "Unaligned",
            "any alignment": "Unaligned",
            "any": "Unaligned",
        }
        return mapping.get(value, "Unaligned")
