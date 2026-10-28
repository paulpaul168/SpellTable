"""
Optional BYO Aurora creature catalog.

Official aurorabuilder packs do not ship full Monster Manual stat blocks
(copyright). They do ship Companion (and optionally custom type="Monster")
elements with setters for AC/HP/speed/abilities/actions. This service indexes
those under AURORA_ELEMENTS_ROOT and converts them to SpellTable-shaped dicts.

Disabled when AURORA_ELEMENTS_ROOT is unset. Content is never committed.
"""

from __future__ import annotations

import html
import os
import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from pathlib import Path

from loguru import logger

from ..core.constants import xp_for_challenge

_ATTR_RE = re.compile(r'(\w+)\s*=\s*"([^"]*)"')
_CREATURE_OPEN_RE = re.compile(
    r'<element\b([^>]*)\btype\s*=\s*"(Monster|Companion)"([^>]*)>',
    re.IGNORECASE,
)
_REF_OPEN_RE = re.compile(
    r'<element\b([^>]*)\btype\s*=\s*"(Companion Trait|Companion Action|Monster Trait|Monster Action|Trait|Action)"([^>]*)>',
    re.IGNORECASE,
)
_HP_RE = re.compile(
    r"^\s*(\d+)\s*(?:\(([^)]+)\))?\s*$",
)
_SPEED_PART_RE = re.compile(
    r"(?:^|,\s*)(?:(walk|fly|swim|climb|burrow)\s+)?(\d+)\s*ft\.?",
    re.IGNORECASE,
)
_SKILL_RE = re.compile(
    r"([A-Za-z][A-Za-z' ]+?)\s*([+-]\d+)",
)
_CHALLENGE_RE = re.compile(r"^\s*(\d+)(?:\s*/\s*(\d+))?\s*$")


@dataclass(frozen=True)
class AuroraCreatureSummary:
    id: str
    name: str
    source: str | None
    size: str | None
    challenge: float | None
    ac: int | None
    hp_average: int | None
    creature_type: str  # Monster | Companion


class AuroraMonsterCatalogService:
    _instance: AuroraMonsterCatalogService | None = None

    def __new__(cls) -> AuroraMonsterCatalogService:
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False  # type: ignore[attr-defined]
        return cls._instance

    def __init__(self) -> None:
        if getattr(self, "_initialized", False):
            return
        self._initialized = True
        self._root: Path | None = None
        self._summaries: list[AuroraCreatureSummary] | None = None
        self._creature_files: dict[str, Path] = {}
        self._ref_cache: dict[str, tuple[str, str]] = {}  # id -> (title, plain text)
        self._root_mtime_token: str | None = None

    @staticmethod
    def configured_root() -> Path | None:
        raw = os.environ.get("AURORA_ELEMENTS_ROOT", "").strip()
        if not raw:
            return None
        path = Path(raw)
        return path if path.is_dir() else None

    def is_available(self) -> bool:
        return self.configured_root() is not None

    def _dir_token(self, root: Path) -> str:
        try:
            newest = max(
                (p.stat().st_mtime for p in root.rglob("*.xml")),
                default=0.0,
            )
            return f"{root}:{newest}"
        except OSError:
            return str(root)

    def _refresh_if_needed(self) -> bool:
        root = self.configured_root()
        if root is None:
            self._root = None
            self._summaries = None
            self._creature_files = {}
            self._ref_cache = {}
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
        self._summaries, self._creature_files, self._ref_cache = self._scan(root)
        logger.info(
            "Aurora creature catalog loaded: {} creatures from {}",
            len(self._summaries),
            root,
        )
        return True

    def list_creatures(
        self, query: str | None = None
    ) -> list[AuroraCreatureSummary] | None:
        if not self._refresh_if_needed() or self._summaries is None:
            return None
        if not query or not query.strip():
            return list(self._summaries)
        q = query.strip().lower()
        return [
            c
            for c in self._summaries
            if q in c.name.lower() or q in c.id.lower() or (c.source or "").lower().find(q) >= 0
        ]

    def get_creature_monster(self, creature_id: str) -> dict | None:
        """Return a SpellTable-shaped monster dict, or None."""
        if not self._refresh_if_needed():
            return None
        path = self._creature_files.get(creature_id)
        if path is None:
            return None
        return self._parse_creature(path, creature_id)

    def _scan(
        self, root: Path
    ) -> tuple[
        list[AuroraCreatureSummary],
        dict[str, Path],
        dict[str, tuple[str, str]],
    ]:
        summaries: list[AuroraCreatureSummary] = []
        creature_files: dict[str, Path] = {}
        refs: dict[str, tuple[str, str]] = {}

        for path in sorted(root.rglob("*.xml")):
            try:
                text = path.read_text(encoding="utf-8", errors="replace")
            except OSError as exc:
                logger.warning("Skipping unreadable Aurora file {}: {}", path, exc)
                continue

            for match in _REF_OPEN_RE.finditer(text):
                attrs = dict(_ATTR_RE.findall(f"{match.group(1)} {match.group(3)}"))
                ref_id = attrs.get("id")
                name = attrs.get("name")
                if not ref_id or not name:
                    continue
                window = text[match.end() : match.end() + 4000]
                desc = self._extract_description_text(window)
                if ref_id not in refs:
                    refs[ref_id] = (name, desc)

            for match in _CREATURE_OPEN_RE.finditer(text):
                attrs = dict(_ATTR_RE.findall(f"{match.group(1)} {match.group(3)}"))
                creature_id = attrs.get("id")
                name = attrs.get("name")
                ctype = match.group(2)
                if not creature_id or not name:
                    continue
                window = self._element_body_window(text, match.end())
                setters = self._extract_setters(window)
                hp_avg, _ = self._parse_hp(setters.get("hp", ""))
                summary = AuroraCreatureSummary(
                    id=creature_id,
                    name=name,
                    source=attrs.get("source"),
                    size=setters.get("size"),
                    challenge=self._parse_challenge(setters.get("challenge", "")),
                    ac=self._parse_int(setters.get("ac")),
                    hp_average=hp_avg,
                    creature_type=ctype,
                )
                if creature_id not in creature_files:
                    summaries.append(summary)
                    creature_files[creature_id] = path

        summaries.sort(key=lambda c: c.name.lower())
        return summaries, creature_files, refs

    def _parse_creature(self, path: Path, creature_id: str) -> dict | None:
        try:
            tree = ET.parse(path)
        except ET.ParseError as exc:
            logger.warning("Failed to parse {}: {}", path, exc)
            return None

        root = tree.getroot()
        el = None
        for candidate in root.iter("element"):
            if candidate.attrib.get("id") == creature_id and candidate.attrib.get(
                "type"
            ) in ("Monster", "Companion"):
                el = candidate
                break
        if el is None:
            return None

        setters = {
            s.attrib.get("name"): (s.text or "").strip()
            for s in el.findall("setters/set")
            if s.attrib.get("name")
        }

        hp_avg, hit_dice = self._parse_hp(setters.get("hp", "1"))
        speed = self._parse_speed(setters.get("speed", "30 ft."))
        challenge_rating = self._parse_challenge(setters.get("challenge", "0")) or 0.0

        ability_scores = {
            "strength": self._parse_int(setters.get("strength")) or 10,
            "dexterity": self._parse_int(setters.get("dexterity")) or 10,
            "constitution": self._parse_int(setters.get("constitution")) or 10,
            "intelligence": self._parse_int(setters.get("intelligence")) or 10,
            "wisdom": self._parse_int(setters.get("wisdom")) or 10,
            "charisma": self._parse_int(setters.get("charisma")) or 10,
        }

        skills = self._parse_skills(setters.get("skills", ""))
        senses = self._parse_senses(setters.get("senses", ""))
        languages = self._parse_languages(setters.get("languages", ""))

        descriptions = self._resolve_refs(setters.get("traits", ""))
        actions = self._resolve_refs(setters.get("actions", ""))

        size_raw = (setters.get("size") or "Medium").strip()
        size = size_raw[:1].upper() + size_raw[1:].lower() if size_raw else "Medium"

        alignment = self._normalize_alignment(setters.get("alignment", "unaligned"))

        monster: dict = {
            "name": el.attrib.get("name") or creature_id,
            "size": size,
            "alignment": alignment,
            "armor": {
                "ac": self._parse_int(setters.get("ac")) or 10,
                "type": "Natural Armor",
                "shield": False,
            },
            "hp": {
                "average": hp_avg or 1,
                "hit_dice": hit_dice or "1d8",
            },
            "speed": speed,
            "ability_scores": ability_scores,
            "saving_throws": [],
            "skills": skills,
            "damage_resistances": [],
            "damage_immunities": [],
            "condition_immunities": [],
            "senses": senses,
            "languages": languages,
            "challenge": {
                "rating": challenge_rating,
                "xp": xp_for_challenge(challenge_rating),
            },
            "descriptions": descriptions,
            "actions": actions,
            "reactions": [],
            "legendary_actions": [],
            "spellcasting": None,
            # Extra metadata for UI (ignored by local Monster create if stripped)
            "aurora_id": creature_id,
            "aurora_source": el.attrib.get("source"),
            "aurora_creature_type": el.attrib.get("type"),
        }

        creature_kind = setters.get("type")
        if creature_kind:
            monster["descriptions"] = [
                {
                    "title": "Type",
                    "description": creature_kind,
                },
                *monster["descriptions"],
            ]

        return monster

    def _resolve_refs(self, csv_ids: str) -> list[dict]:
        out: list[dict] = []
        for raw in csv_ids.split(","):
            ref_id = raw.strip()
            if not ref_id:
                continue
            title, desc = self._ref_cache.get(ref_id, (ref_id, ""))
            out.append({"title": title, "description": desc or "—"})
        return out

    @staticmethod
    def _element_body_window(text: str, start: int, limit: int = 8000) -> str:
        """Slice from after an opening <element> until the matching close or next sibling."""
        chunk = text[start : start + limit]
        close = re.search(r"</element\s*>", chunk, re.IGNORECASE)
        if close:
            return chunk[: close.start()]
        next_el = re.search(r"<element\b", chunk, re.IGNORECASE)
        if next_el:
            return chunk[: next_el.start()]
        return chunk

    @staticmethod
    def _extract_setters(window: str) -> dict[str, str]:
        setters: dict[str, str] = {}
        # Prefer the first <setters>…</setters> block only
        block = re.search(
            r"<setters>(.*?)</setters>",
            window,
            re.IGNORECASE | re.DOTALL,
        )
        scope = block.group(1) if block else window
        for m in re.finditer(
            r'<set\s+name="([^"]+)"\s*>([^<]*)</set>',
            scope,
            re.IGNORECASE,
        ):
            setters[m.group(1)] = m.group(2).strip()
        return setters

    @staticmethod
    def _extract_description_text(window: str) -> str:
        # Prefer <sheet><description>…</description></sheet>, else first <description>
        sheet = re.search(
            r"<sheet>\s*<description>(.*?)</description>",
            window,
            re.IGNORECASE | re.DOTALL,
        )
        if sheet:
            return AuroraMonsterCatalogService._html_to_text(sheet.group(1))
        desc = re.search(
            r"<description>(.*?)</description>",
            window,
            re.IGNORECASE | re.DOTALL,
        )
        if desc:
            return AuroraMonsterCatalogService._html_to_text(desc.group(1))
        return ""

    @staticmethod
    def _html_to_text(raw: str) -> str:
        text = re.sub(r"<[^>]+>", " ", raw)
        text = html.unescape(text)
        return re.sub(r"\s+", " ", text).strip()

    @staticmethod
    def _parse_int(value: str | None) -> int | None:
        if value is None or value.strip() == "":
            return None
        raw = value.strip()
        try:
            return int(raw)
        except ValueError:
            m = re.match(r"^(-?\d+)", raw)
            if m:
                return int(m.group(1))
            return None

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
        # First bare "N ft." is walk
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
        if speed["walk"] is None and first:
            speed["walk"] = 30
        return speed

    @staticmethod
    def _parse_challenge(raw: str) -> float | None:
        m = _CHALLENGE_RE.match(raw or "")
        if not m:
            try:
                return float(raw)
            except (TypeError, ValueError):
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
            skill = m.group(1).strip()
            mod = int(m.group(2))
            out.append({"skill": skill, "modifier": mod})
        return out

    @staticmethod
    def _parse_senses(raw: str) -> dict | None:
        if not raw or raw.strip() in {"—", "-"}:
            return {"passive_perception": 10}
        passive = 10
        darkvision = None
        pm = re.search(r"passive Perception\s+(\d+)", raw, re.IGNORECASE)
        if pm:
            passive = int(pm.group(1))
        dm = re.search(r"darkvision\s+(\d+)", raw, re.IGNORECASE)
        if dm:
            darkvision = int(dm.group(1))
        result: dict = {"passive_perception": passive}
        if darkvision is not None:
            result["darkvision"] = darkvision
        return result

    @staticmethod
    def _parse_languages(raw: str) -> list[str]:
        if not raw or raw.strip() in {"—", "-", "—"}:
            return []
        # Keep free-form language strings; frontend treats them as strings
        parts = [p.strip() for p in re.split(r",|;", raw) if p.strip()]
        # Drop verbose "understands X but can't speak" into a single entry
        return parts

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
        }
        return mapping.get(value, "Unaligned")
