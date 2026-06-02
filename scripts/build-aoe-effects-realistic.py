#!/usr/bin/env python3
"""
Transcode sourced MP4/MOV clips into realistic AoE theme WebM loops.

Usage:
  python scripts/build-aoe-effects-realistic.py --effect fireball --input /tmp/fireball.mp4

Expects meta sidecar fields in EFFECTS dict or existing meta.json in sources/.
"""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "frontend" / "public" / "aoe-effects" / "themes" / "realistic"
SOURCES = ROOT / "scripts" / "aoe-realistic-sources"

# effect_id -> default meta (merged with per-effect meta.json in source folder if present)
EFFECT_DEFAULTS: dict[str, dict] = {
    "fireball": {
        "fit": "ball",
        "blendMode": "screen",
        "zoom": 1.15,
        "loop": True,
    },
    "lightning-bolt": {
        "fit": "line-fill",
        "blendMode": "screen",
        "loop": True,
    },
    "fog-cloud": {
        "fit": "ball",
        "blendMode": "screen",
        "loop": True,
    },
}


def run(cmd: list[str]) -> None:
    print("+", " ".join(cmd))
    subprocess.run(cmd, check=True)


def transcode(input_path: Path, dest_dir: Path, trim_sec: float = 3.0) -> None:
    dest_dir.mkdir(parents=True, exist_ok=True)
    webm = dest_dir / "loop.webm"
    tmp = dest_dir / "_tmp.mp4"

    # Normalize: trim, scale max 720, fps 24
    run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(input_path),
            "-t",
            str(trim_sec),
            "-vf",
            "scale='min(720,iw)':-2,fps=24",
            "-an",
            str(tmp),
        ]
    )

    # VP9 with alpha attempt; chromakey black for stock footage without alpha
    run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(tmp),
            "-vf",
            "colorkey=0x000000:0.35:0.1,format=yuva420p",
            "-c:v",
            "libvpx-vp9",
            "-b:v",
            "0",
            "-crf",
            "32",
            "-row-mt",
            "1",
            "-an",
            str(webm),
        ]
    )
    tmp.unlink(missing_ok=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--effect", required=True, help="effect id folder name")
    parser.add_argument("--input", type=Path, help="source video; default sources/<effect>/master.mp4")
    parser.add_argument("--trim", type=float, default=3.0)
    args = parser.parse_args()

    effect_id = args.effect
    input_path = args.input or (SOURCES / effect_id / "master.mp4")
    if not input_path.is_file():
        print(f"Missing input: {input_path}", file=sys.stderr)
        sys.exit(1)

    dest = OUT / effect_id
    transcode(input_path, dest, trim_sec=args.trim)

    meta_path = SOURCES / effect_id / "meta.json"
    meta: dict = dict(EFFECT_DEFAULTS.get(effect_id, {"fit": "ball", "loop": True}))
    if meta_path.is_file():
        meta.update(json.loads(meta_path.read_text()))
    meta["media"] = "loop.webm"
    (dest / "meta.json").write_text(json.dumps(meta, indent=2) + "\n")
    print(f"Wrote {dest}")


if __name__ == "__main__":
    main()
