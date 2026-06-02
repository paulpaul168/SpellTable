# Third-party assets

## AoE spell effects

Assets live under `frontend/public/aoe-effects/themes/` (`pixel` and `realistic`). Theme selection is per-scene via `gridSettings.aoeEffectTheme` (`pixel`, `realistic`, or `none` for solid shapes without animations).

### Pixel theme (CC0 / public domain)

Animated AoE sprites under `frontend/public/aoe-effects/themes/pixel/` are derived from:

- **Pixel Art Spells** by DevWizard — [OpenGameArt](https://opengameart.org/content/pixel-art-spells) (CC0)
- **Free Pixel Effects Pack** by CodeManu — [OpenGameArt](https://opengameart.org/content/free-pixel-effects-pack) (public domain)
- **Kenney Smoke Particles** — [kenney.nl](https://kenney.nl/assets/smoke-particles) / [OpenGameArt mirror](https://opengameart.org/content/smoke-particle-assets) (CC0)

Rebuild or refresh assets with:

```bash
# Download sources into .tmp-aoe-downloads/ (see scripts/build-aoe-effects.py), then:
python3 scripts/build-aoe-effects.py
```

Spirit Guardian variants (necrotic / radiant) reuse the phantom orbit effect with CSS tint filters.

Optional **RagnaPixel Particle FX** free demo (CC-BY 4.0, credit Raphael Hatencia) was not bundled automatically; itch.io requires a browser download. CC0 smoke/tint alternatives are used for fog and cloudkill.

### Realistic theme (video loops)

MVP loops (`fireball`, `lightning-bolt`, `fog-cloud`) ship as WebM VP9 under `frontend/public/aoe-effects/themes/realistic/`. Each effect’s `meta.json` lists the intended stock source and license.

| Effect | Intended source | License |
|--------|-----------------|---------|
| fireball | [Mixkit — fire / explosion clips](https://mixkit.co/free-stock-video/fire/) | Mixkit Free License |
| lightning-bolt | [Mixkit — storm / lightning](https://mixkit.co/free-stock-video/storm/) | Mixkit Free License |
| fog-cloud | [Mixkit — smoke](https://mixkit.co/free-stock-video/smoke/) | Mixkit Free License |

Replace placeholder masters in `scripts/aoe-realistic-sources/<effect>/master.mp4` (download from the URLs above in a browser), then rebuild:

```bash
python3 scripts/build-aoe-effects-realistic.py --effect fireball
python3 scripts/build-aoe-effects-realistic.py --effect lightning-bolt
python3 scripts/build-aoe-effects-realistic.py --effect fog-cloud
```

Additional spells can be added the same way; see `scripts/aoe-realistic-sources/*/meta.json` for per-clip attribution fields.
