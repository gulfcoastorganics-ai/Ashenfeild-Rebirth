# Ashford Rebirth V0.13.1 asset integration

Baseline and rollback point `4372bd681f5a62f8f7d26b4d2fb4816078c7bbb3` is the V0.13 merge on `reconstruction-prototype`. The original v7.1 Sites game is a separate codebase.

## Changelog

| Scene | Changes |
| --- | --- |
| Safehouse | Photographed worn pine and painted plaster, a bed with a folded pillow, contact shadows, and a warmer Quality grade. |
| Last Stop Market | Ceramic floor, stained plaster, scratched storefront glass, a packed dry-goods carton, a warm counter light with cooler aisle light, and a streamed display shelf. |
| Ashford streets | Photographed asphalt with cracks and aggregate, curbside vegetation, and cooler outdoor exposure in Quality. |
| Ashford Clinic | Muted ceramic floor, weathered upper walls, a wheeled medical trolley, and a cooler ceiling-light grade in Quality. |
| Characters | Smaller player head proportions, jacket collar, backpack zipper, smoother head tracking during turns, heavier synthesized footsteps, and differentiated infected strides, body recoil, and collapses. |

## Graphics controls and loading

Choose **Graphics: Quality** in the pause menu to enable asset normal and roughness maps, the existing sky reflections and shadow preset, and the new room-dependent exposure and lighting color. **Fine surface detail in Quality** and **Scene color grading in Quality** can be switched independently. Auto keeps its adaptive Performance and Balanced modes. Performance and Balanced use diffuse maps with constant roughness. Static photos load after the initial scene, while the GLB and optional loader start when the player approaches the market. Missing assets retain the existing procedural surfaces and fixtures. Material variants share image uploads while retaining individual UV repeats. All new runtime artwork is served from the game origin, and the existing pinned Three.js CDN URL remains the only library request outside that origin.

See [ASSET_MANIFEST.md](ASSET_MANIFEST.md) for authors, exact upstream downloads, licenses, and byte counts. Run `python scripts/import-poly-haven.py` with Python, Pillow, and curl to regenerate the checked-in WebP and GLB files. The script verifies the 1K originals with the sizes and checksums published by Poly Haven. The shelf keeps its geometry and UVs. The import repacks its buffer and smaller images into a single binary glTF so no mesh or texture decoder is required.

## Source choices

- Poly Haven supplied the four CC0 material sets and the Shelf 01 mesh. The small shelf fits the market wall and is available under CC0. The Khronos Commercial Refrigerator has separate CC BY credits and would need a suitability and optimization pass before adoption.
- The FPS Asset Kit overlaps with the selected photo surfaces. Ludots' humanoid clips require a skin, named bones, and matching rest poses. Ashford moves rigid groups around pivots, so this version extends its existing procedural poses. It does not include third-party animation clips or character models.
- The render loop continues to use a single Three.js render pass. Postprocessing and realism-effects would add fill and bandwidth costs. The software results make ambient occlusion, bloom, and screen-space reflections unsuitable for the default upgrade. No Valle Morta code or third-party audio was copied.

## Review and reproducibility

Use the commands below with a spare checkout of the V0.13 baseline. A seeded scene and matching camera coordinates keep the before/after views comparable. The static benchmark records FPS, p95 frame times, draw calls, triangles, geometry and texture counts, and the renderer name. Screenshot capture parks gameplay. The separate `test:campaign` suite uses normal player inputs through the ending.

```sh
npm install --no-audit --no-fund
npx playwright install --with-deps chromium
git worktree add --detach ../ashford-v013-baseline 4372bd681f5a62f8f7d26b4d2fb4816078c7bbb3
node tests/compare-render.mjs ../ashford-v013-baseline performance
node tests/compare-render.mjs ../ashford-v013-baseline quality
```

The reported benchmark is Chromium SwiftShader. Run GPU benchmarks on an actual Chromebook and supported Android and iOS devices before treating 30 or 60 FPS as demonstrated targets. The hardware capture should include the route entrance, crowded clinic defense, and switching settings between runs.
