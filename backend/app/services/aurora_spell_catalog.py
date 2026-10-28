"""
Optional BYO Aurora spell catalog.

Reads Spell elements from AURORA_ELEMENTS_ROOT when set. Never required for
core monster management — disabled when the env var is unset or the path is
missing. Operators mount their own licensed Aurora XML; it is not shipped in
the public image/repo.
"""

from __future__ import annotations

import os
import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from pathlib import Path

from loguru import logger


@dataclass(frozen=True)
class SpellCatalogEntry:
    id: str
    name: str
    level: int
    school: str | None = None
    source: str | None = None


@dataclass(frozen=True)
class SpellCatalogDetail(SpellCatalogEntry):
    description_html: str | None = None


_ELEMENT_OPEN_RE = re.compile(
    r'<element\b([^>]*)\btype\s*=\s*"Spell"([^>]*)>',
    re.IGNORECASE,
)
_ATTR_RE = re.compile(r'(\w+)\s*=\s*"([^"]*)"')


class AuroraSpellCatalogService:
    """Singleton catalog built from Aurora XML under AURORA_ELEMENTS_ROOT."""

    _instance: AuroraSpellCatalogService | None = None

    def __new__(cls) -> AuroraSpellCatalogService:
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False  # type: ignore[attr-defined]
        return cls._instance

    def __init__(self) -> None:
        if getattr(self, "_initialized", False):
            return
        self._initialized = True
        self._root: Path | None = None
        self._entries: list[SpellCatalogEntry] | None = None
        self._by_id: dict[str, tuple[Path, str]] = {}
        self._root_mtime_token: str | None = None

    @staticmethod
    def configured_root() -> Path | None:
        raw = os.environ.get("AURORA_ELEMENTS_ROOT", "").strip()
        if not raw:
            return None
        path = Path(raw)
        if not path.is_dir():
            return None
        return path

    def is_available(self) -> bool:
        return self.configured_root() is not None

    def _refresh_if_needed(self) -> bool:
        root = self.configured_root()
        if root is None:
            self._root = None
            self._entries = None
            self._by_id = {}
            self._root_mtime_token = None
            return False

        token = self._dir_token(root)
        if self._entries is not None and self._root == root and self._root_mtime_token == token:
            return True

        self._root = root
        self._root_mtime_token = token
        self._entries, self._by_id = self._scan(root)
        logger.info(
            "Aurora spell catalog loaded: {} spells from {}",
            len(self._entries),
            root,
        )
        return True

    @staticmethod
    def _dir_token(root: Path) -> str:
        try:
            newest = max(
                (p.stat().st_mtime for p in root.rglob("*.xml")),
                default=0.0,
            )
            return f"{root}:{newest}"
        except OSError:
            return str(root)

    def list_spells(self, query: str | None = None) -> list[SpellCatalogEntry] | None:
        if not self._refresh_if_needed() or self._entries is None:
            return None
        if not query or not query.strip():
            return list(self._entries)
        q = query.strip().lower()
        return [
            e
            for e in self._entries
            if q in e.name.lower() or q in e.id.lower()
        ]

    def get_spell(self, spell_id: str) -> SpellCatalogDetail | None:
        if not self._refresh_if_needed():
            return None
        loc = self._by_id.get(spell_id)
        if loc is None:
            return None
        path, _name = loc
        return self._parse_detail(path, spell_id)

    def _scan(
        self, root: Path
    ) -> tuple[list[SpellCatalogEntry], dict[str, tuple[Path, str]]]:
        entries: list[SpellCatalogEntry] = []
        by_id: dict[str, tuple[Path, str]] = {}
        for path in sorted(root.rglob("*.xml")):
            try:
                text = path.read_text(encoding="utf-8", errors="replace")
            except OSError as exc:
                logger.warning("Skipping unreadable Aurora file {}: {}", path, exc)
                continue
            for match in _ELEMENT_OPEN_RE.finditer(text):
                attrs_blob = f"{match.group(1)} {match.group(2)}"
                attrs = dict(_ATTR_RE.findall(attrs_blob))
                spell_id = attrs.get("id")
                name = attrs.get("name")
                if not spell_id or not name:
                    continue
                # Pull a small window after the open tag for setters
                window = text[match.end() : match.end() + 2500]
                level = self._extract_set_int(window, "level") or 0
                school = self._extract_set(window, "school")
                source = attrs.get("source")
                entry = SpellCatalogEntry(
                    id=spell_id,
                    name=name,
                    level=level,
                    school=school,
                    source=source,
                )
                if spell_id not in by_id:
                    entries.append(entry)
                    by_id[spell_id] = (path, name)
        entries.sort(key=lambda e: (e.level, e.name.lower()))
        return entries, by_id

    @staticmethod
    def _extract_set(window: str, name: str) -> str | None:
        m = re.search(
            rf'<set\s+name="{re.escape(name)}"\s*>([^<]*)</set>',
            window,
            re.IGNORECASE,
        )
        if not m:
            return None
        value = m.group(1).strip()
        return value or None

    @classmethod
    def _extract_set_int(cls, window: str, name: str) -> int | None:
        raw = cls._extract_set(window, name)
        if raw is None:
            return None
        try:
            return int(raw)
        except ValueError:
            return None

    def _parse_detail(self, path: Path, spell_id: str) -> SpellCatalogDetail | None:
        try:
            tree = ET.parse(path)
        except ET.ParseError as exc:
            logger.warning("Failed to parse {}: {}", path, exc)
            return None
        root = tree.getroot()
        for el in root.iter("element"):
            if el.attrib.get("type") != "Spell":
                continue
            if el.attrib.get("id") != spell_id:
                continue
            setters = {
                s.attrib.get("name"): (s.text or "").strip()
                for s in el.findall("setters/set")
                if s.attrib.get("name")
            }
            level_raw = setters.get("level", "0")
            try:
                level = int(level_raw)
            except ValueError:
                level = 0
            desc_el = el.find("description")
            description_html = None
            if desc_el is not None:
                # Serialize inner HTML of description
                parts = [desc_el.text or ""]
                for child in list(desc_el):
                    parts.append(ET.tostring(child, encoding="unicode"))
                    parts.append(child.tail or "")
                description_html = "".join(parts).strip() or None
            return SpellCatalogDetail(
                id=spell_id,
                name=el.attrib.get("name") or spell_id,
                level=level,
                school=setters.get("school") or None,
                source=el.attrib.get("source"),
                description_html=description_html,
            )
        return None
