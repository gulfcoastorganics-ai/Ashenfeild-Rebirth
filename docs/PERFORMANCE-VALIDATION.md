# V0.15 performance validation

The V0.14 baseline is `e4aeb7292b3dfa88e5647a9e914c836ed2f4f67d`.
The benchmark uses headless Chromium with ANGLE SwiftShader at 1000×640 and
device pixel ratio 1. It seeds world randomness and places the player at the
same world coordinates and heading in both builds. The camera and culling
changes are part of the comparison. Presets and character selection are
fixed during each run. Timing samples are short and can vary with CPU load.

Three independent windows per view report frame p50, p95 and average FPS. The
script records frame sample arrays, draw calls, rendered triangles, allocated
geometries, texture counts and initialized skinned actors. Indoor samples park
the simulation after room assets settle. The live fixture restarts with one
or six infected, then fires from the same starting point.

```bash
git worktree add --detach ../ashford-v014 e4aeb7292b3dfa88e5647a9e914c836ed2f4f67d
npm install
npx playwright install chromium
export ASHFORD_BENCHMARK_FRAMES=12
node tests/compare-render.mjs ../ashford-v014 performance --indoors --fallback
node tests/compare-render.mjs ../ashford-v014 balanced --indoors
node tests/compare-render.mjs ../ashford-v014 quality --indoors
node tests/compare-render.mjs ../ashford-v014 performance --crowd --live --fallback
```

The asset directory occupies 2.35 MiB on disk in each build. The runtime
WebP material atlas and surface maps represent about 11.25 MiB of unique base
RGBA texels if all maps were loaded. Each GLB contains about 1.5 to 4.7 MiB of
base RGBA texels by image dimensions. These estimates exclude mipmaps, shared
images or renderer-generated textures, skin buffers and browser overhead.
Texture allocation counts describe Three.js objects. SwiftShader results do
not certify FPS or resident GPU memory on a Chromebook, Android phone or
iPhone.
