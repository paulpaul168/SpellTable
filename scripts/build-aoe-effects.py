#!/usr/bin/env python3
"""Copy and normalize CC0 AoE effect sprites into frontend/public/aoe-effects/."""

from __future__ import annotations

import json
import shutil
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / ".tmp-aoe-downloads"
OUT = ROOT / "frontend" / "public" / "aoe-effects"
FRAME_SIZE = 128


def write_meta(effect_dir: Path, meta: dict) -> None:
    effect_dir.mkdir(parents=True, exist_ok=True)
    (effect_dir / "meta.json").write_text(json.dumps(meta, indent=2) + "\n")


def trim_frame_to_square(frame: Image.Image, size: int = FRAME_SIZE, padding: int = 6) -> Image.Image:
    bbox = frame.split()[3].getbbox()
    if not bbox:
        return Image.new("RGBA", (size, size), (0, 0, 0, 0))
    cropped = frame.crop(bbox)
    cw, ch = cropped.size
    side = max(cw, ch) + padding * 2
    square = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    square.paste(cropped, ((side - cw) // 2, (side - ch) // 2))
    return square.resize((size, size), Image.Resampling.NEAREST)


def save_strip(frames: list[Image.Image], effect_id: str, meta_extra: dict) -> None:
    size = FRAME_SIZE
    strip = Image.new("RGBA", (size * len(frames), size))
    for i, frame in enumerate(frames):
        strip.paste(frame, (i * size, 0))
    effect_dir = OUT / effect_id
    effect_dir.mkdir(parents=True, exist_ok=True)
    strip.save(effect_dir / "sheet.png")
    meta = {
        "frameWidth": size,
        "frameHeight": size,
        "frameCount": len(frames),
        "fps": 12,
        "loop": True,
        "blendMode": "screen",
        "fit": "stretch",
        **meta_extra,
    }
    write_meta(effect_dir, meta)


def grid_to_strip(
    src: Path,
    effect_id: str,
    columns: int,
    rows: int,
    frame_indices: list[int] | None = None,
    cell: int = 100,
    **meta,
) -> None:
    sheet = Image.open(src).convert("RGBA")
    indices = frame_indices or list(range(columns * rows))
    frames = []
    for i in indices:
        col = i % columns
        row = i // columns
        raw = sheet.crop((col * cell, row * cell, col * cell + cell, row * cell + cell))
        frames.append(trim_frame_to_square(raw))
    save_strip(frames, effect_id, meta)


def build_smoke_strip(
    puff_dir: Path,
    effect_id: str,
    fps: int = 8,
    css_filter: str | None = None,
    size: int = 128,
    fit: str = "stretch",
) -> None:
    files = sorted(puff_dir.glob("*.png"))
    frames = []
    for f in files:
        im = Image.open(f).convert("RGBA")
        im = im.resize((size, size), Image.Resampling.NEAREST)
        frames.append(im)
    save_strip(
        frames,
        effect_id,
        {"fps": fps, "blendMode": "normal", "fit": fit, "filter": css_filter},
    )


def main() -> None:
    if OUT.exists():
        shutil.rmtree(OUT)
    (OUT / "licenses").mkdir(parents=True)

    fx = SRC / "free_pixel_effects"
    smoke = SRC / "smoke" / "PNG"

    # Full ball of fire
    grid_to_strip(
        fx / "11_fire_spritesheet.png",
        "fireball",
        8,
        8,
        list(range(20, 28)),
        fit="ball",
        zoom=2.6,
        fps=14,
    )

    # Horizontal flame band — wall of fire
    grid_to_strip(
        fx / "6_flamelash_spritesheet.png",
        "wall-of-fire",
        7,
        7,
        list(range(14, 28)),
        fit="line-fill",
        zoom=2.5,
        fps=12,
    )

    grid_to_strip(
        fx / "3_bluefire_spritesheet.png",
        "lightning-bolt",
        8,
        8,
        list(range(8, 24)),
        fit="line-fill",
        zoom=2.6,
        fps=14,
    )

    grid_to_strip(
        fx / "12_nebula_spritesheet.png",
        "call-lightning",
        8,
        8,
        list(range(0, 20)),
        fit="ball",
        zoom=2.4,
        fps=10,
    )

    grid_to_strip(
        fx / "19_freezing_spritesheet.png",
        "cone-of-cold",
        10,
        10,
        list(range(0, 24)),
        fit="cone",
        scale=1.7,
        fps=12,
    )

    grid_to_strip(
        fx / "9_brightfire_spritesheet.png",
        "meteor-swarm",
        8,
        8,
        list(range(16, 28)),
        fit="ball",
        zoom=2.5,
        fps=12,
    )

    grid_to_strip(
        fx / "6_flamelash_spritesheet.png",
        "burning-hands",
        7,
        7,
        list(range(12, 22)),
        fit="cone",
        scale=1.5,
        fps=14,
    )

    grid_to_strip(
        fx / "14_phantom_spritesheet.png",
        "spirit-guardians",
        8,
        8,
        list(range(0, 16)),
        fit="orbit",
        orbitCount=10,
        fps=10,
    )

    grid_to_strip(
        fx / "14_phantom_spritesheet.png",
        "spirit-guardians-necrotic",
        8,
        8,
        list(range(0, 16)),
        fit="orbit",
        orbitCount=10,
        fps=9,
        filter="brightness(0.55) saturate(1.2) hue-rotate(95deg) contrast(1.15)",
    )

    grid_to_strip(
        fx / "14_phantom_spritesheet.png",
        "spirit-guardians-radiant",
        8,
        8,
        list(range(0, 16)),
        fit="orbit",
        orbitCount=10,
        fps=11,
        filter="brightness(1.35) saturate(1.4) hue-rotate(-25deg) drop-shadow(0 0 6px rgba(255,220,120,0.9))",
    )

    grid_to_strip(
        fx / "18_midnight_spritesheet.png",
        "darkness",
        8,
        8,
        list(range(0, 16)),
        fit="stretch",
        fps=8,
    )

    build_smoke_strip(
        smoke / "White puff",
        "fog-cloud",
        fps=8,
        css_filter="grayscale(1) contrast(0.95)",
        size=128,
    )
    build_smoke_strip(
        smoke / "Black smoke",
        "cloudkill",
        fps=8,
        css_filter="hue-rotate(75deg) saturate(1.6) contrast(1.1)",
        size=128,
    )

    (OUT / "licenses" / "README.txt").write_text(
        "AoE effect sources (CC0 / public domain):\n"
        "- Free Pixel Effects Pack by CodeManu (OpenGameArt)\n"
        "- Kenney Smoke Particles (CC0, kenney.nl)\n"
    )

    index = {
        "fireball": {"label": "Fireball", "source": "CodeManu fire (ball)"},
        "wall-of-fire": {"label": "Wall of Fire", "source": "CodeManu flamelash (line-fill)"},
        "lightning-bolt": {"label": "Lightning Bolt", "source": "CodeManu bluefire (line-fill)"},
        "call-lightning": {"label": "Call Lightning", "source": "CodeManu nebula (ball)"},
        "cone-of-cold": {"label": "Cone of Cold", "source": "CodeManu freezing"},
        "spirit-guardians": {"label": "Spirit Guardians", "source": "CodeManu phantom"},
        "spirit-guardians-necrotic": {"label": "Spirit Guardians (Nekrotisch)", "source": "CodeManu phantom"},
        "spirit-guardians-radiant": {"label": "Spirit Guardians (Radiant)", "source": "CodeManu phantom"},
        "meteor-swarm": {"label": "Meteor Swarm", "source": "CodeManu brightfire"},
        "burning-hands": {"label": "Burning Hands", "source": "CodeManu flamelash"},
        "fog-cloud": {"label": "Fog Cloud", "source": "Kenney smoke"},
        "cloudkill": {"label": "Cloudkill", "source": "Kenney smoke"},
        "darkness": {"label": "Darkness", "source": "CodeManu midnight"},
    }
    (OUT / "index.json").write_text(json.dumps(index, indent=2) + "\n")
    print(f"Built {len([p for p in OUT.iterdir() if p.is_dir()])} effect folders under {OUT}")


if __name__ == "__main__":
    main()
