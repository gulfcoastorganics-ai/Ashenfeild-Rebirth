# V0.15 performance validation

The V0.14 baseline is `e4aeb7292b3dfa88e5647a9e914c836ed2f4f67d`.
The benchmark uses headless Chromium 141.0.7390.37 with ANGLE SwiftShader on
a cloud Intel Xeon Platinum 8573C CPU at 1000×640 and device pixel ratio 1.
It seeds world randomness and places the player at the
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
ASHFORD_BENCHMARK_FRAMES=24 node tests/compare-render.mjs ../ashford-v014 performance --indoors --fallback --reverse
```

The asset directory occupies 2.35 MiB on disk in each build. The runtime
WebP material atlas and surface maps represent about 11.25 MiB of unique base
RGBA texels if all maps were loaded. Each GLB contains about 1.5 to 4.7 MiB of
base RGBA texels by image dimensions. These estimates exclude mipmaps, shared
images or renderer-generated textures, skin buffers and browser overhead.
Texture allocation counts describe Three.js objects. SwiftShader results do
not certify FPS or resident GPU memory on a Chromebook, Android phone or
iPhone.

## Results

Each cell reads **V0.14 → V0.15**. Lower frame times are better. The original
passes recorded 36 frames per comparison side. The repeat switched build order
and used 72 frames per side. Every V0.15 live window recorded frames with active
tracers. Infected moved and could die during those windows, so draw counts are
snapshots at the final frame.

| Preset and starting scene | FPS | p50 ms | p95 ms | Draw calls | Triangles | Textures |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Performance, lightweight, safehouse | 16.6 → 19.1 | 66.7 → 66.6 | 100.0 → 83.3 | 196 → 192 | 13,933 → 13,717 | 17 → 17 |
| Performance, lightweight, market | 15.5 → 12.1 | 66.6 → 83.3 | 133.4 → 183.4 | 149 → 150 | 13,884 → 14,464 | 26 → 26 |
| Performance, lightweight, safehouse repeat | 16.1 → 15.8 | 66.7 → 66.7 | 83.3 → 83.4 | 196 → 192 | 13,933 → 13,717 | 17 → 17 |
| Performance, lightweight, market repeat | 14.8 → 13.7 | 66.7 → 66.7 | 133.3 → 133.3 | 149 → 150 | 13,884 → 14,464 | 26 → 26 |
| Balanced, detailed, safehouse | 7.5 → 7.7 | 133.3 → 133.4 | 266.7 → 266.7 | 178 → 174 | 25,019 → 24,803 | 33 → 33 |
| Balanced, detailed, market | 6.9 → 6.8 | 150.0 → 150.1 | 300.0 → 283.3 | 102 → 103 | 31,442 → 32,022 | 54 → 54 |
| Quality, detailed, safehouse | 3.1 → 3.5 | 349.9 → 333.3 | 616.6 → 633.3 | 170 → 177 | 28,639 → 24,875 | 51 → 41 |
| Quality, detailed, market | 3.5 → 3.4 | 316.7 → 316.7 | 383.4 → 616.6 | 102 → 103 | 31,442 → 32,022 | 74 → 64 |
| Performance, lightweight, live pistol, one infected | 7.8 → 7.8 | 99.9 → 116.6 | 333.3 → 333.3 | 130 → 124 | 11,622 → 10,986 | 24 → 31 |
| Performance, lightweight, live pistol, six infected | 7.5 → 7.4 | 116.7 → 116.7 | 300.0 → 366.7 | 237 → 232 | 23,412 → 22,776 | 26 → 33 |

The lightweight market repeat matched V0.14's p95, while average FPS remained
lower in both passes. Quality market and six-infected live combat showed larger
tail-frame costs. The Quality camera fixtures also loaded one fewer rig in
V0.15 in each room, so the texture counts mix changes in actor participation
and renderer residency. Initial scene setup varied with run order and did
not establish a first-load improvement.

See the [individual window and frame samples](review/v015-swiftshader.json),
[matched indoor captures](review/v015-quality-comparison.jpg) and
[live combat captures](review/v015-combat-comparison.jpg). The combat stills
show the framing after the last measurement window. Tracer residency is
recorded in the run data.
