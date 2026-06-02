# Third-party assets

## AoE spell effects (CC0 / public domain)

Animated AoE sprites under `frontend/public/aoe-effects/` are derived from:

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
