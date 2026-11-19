# V0.16 profiling and performance

The V0.15.2 baseline is `2320f6d2007e7576c2c6e1af5007c35d24058600`.
The camera sweep rejects distant boxes before testing axes. Enemy updates
reuse sensory inputs, skip distant inactive decisions and avoid a second
distance calculation for stationary infected. Player movement now uses
scalar directions. Indoor views cull remote furniture groups only when the
camera and player are both well inside one room. The existing adaptive
governor, manual overrides, effect budgets and per-preset pixel ratios are
in use.

The benchmark uses SwiftShader through Chromium 141 at 1000×640 on the same
host, viewport, device pixel ratio and preset for both sides.
Static route and loot fixtures pause the simulation to isolate frame
delivery. Live comparisons start with the same number of infected and issue
repeatable pistol commands. The two-infected live fixture represents the
director's additional population cap with comparable fixture actors on both
builds. The separate sandbox gameplay test records a real seeded encounter
and its reload.

```bash
git worktree add --detach ../ashford-v015 2320f6d2007e7576c2c6e1af5007c35d24058600
npm install
npx playwright install chromium
export ASHFORD_BENCHMARK_FRAMES=12
node tests/compare-render.mjs ../ashford-v015 performance --route --fallback
node tests/compare-render.mjs ../ashford-v015 quality --indoors
node tests/compare-render.mjs ../ashford-v015 performance --crowd --live --fallback
node tests/compare-render.mjs ../ashford-v015 performance --scavenge --fallback
node tests/compare-render.mjs ../ashford-v015 performance --encounters --live --fallback
ASHFORD_BENCHMARK_FRAMES=24 node tests/compare-render.mjs ../ashford-v015 performance --route --fallback --reverse
```

Each original view records three 12-frame windows per build. The reversed
route uses three 24-frame windows per build. Columns include measured
draw calls, triangles, resident texture counts and scene objects. Scene
objects count the scene graph, including hidden parts. FPS and p95 describe
browser frame delivery under software rendering. The per-section profiler
measures synchronous time through each update and render submission.
It cannot isolate completed GPU work, shader execution, driver queue latency
or garbage collection.

The game asset directory still occupies 2.35 MiB. It contains no new binary
dependencies for the sandbox. See the [prior asset size estimates](PERFORMANCE-VALIDATION.md)
for unpacked texture estimates. Physical device measurements are pending.

## Results

Cells read **V0.15.2 → V0.16.0**. Lower frame times are better.

| Preset and fixture | FPS | p50 ms | p95 ms | Draw calls | Triangles | Textures | Scene objects |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Performance, route · safehouse | 15.4 → 18.6 | 66.7 → 66.6 | 133.3 → 83.4 | 192 → 192 | 13,717 → 13,717 | 17 → 17 | 716 → 730 |
| Performance, route · market | 6.2 → 15.0 | 116.7 → 66.7 | 483.3 → 133.3 | 150 → 150 | 14,464 → 14,464 | 26 → 26 | 718 → 732 |
| Performance, route · patrol | 10.0 → 12.9 | 83.4 → 83.3 | 383.4 → 166.8 | 276 → 276 | 20,408 → 20,408 | 42 → 42 | 718 → 732 |
| Performance, route · clinic | 13.4 → 12.6 | 83.3 → 83.3 | 133.3 → 183.4 | 202 → 202 | 17,281 → 17,281 | 42 → 42 | 718 → 732 |
| Performance, reverse-order repeat · safehouse | 16.4 → 16.0 | 66.6 → 66.7 | 83.4 → 83.4 | 192 → 192 | 13,717 → 13,717 | 17 → 17 | 716 → 730 |
| Performance, reverse-order repeat · market | 14.0 → 14.3 | 66.7 → 66.7 | 133.3 → 133.3 | 150 → 150 | 14,464 → 14,464 | 26 → 26 | 718 → 732 |
| Performance, reverse-order repeat · patrol | 10.6 → 11.6 | 99.9 → 83.3 | 166.8 → 166.6 | 276 → 276 | 20,408 → 20,408 | 42 → 42 | 718 → 732 |
| Performance, reverse-order repeat · clinic | 12.2 → 12.5 | 83.4 → 83.4 | 150.0 → 100.1 | 202 → 202 | 17,281 → 17,281 | 42 → 42 | 718 → 732 |
| Quality, detailed rigs · safehouse | 3.4 → 3.4 | 333.2 → 316.7 | 633.3 → 433.4 | 177 → 177 | 24,875 → 24,875 | 41 → 40 | 766 → 780 |
| Quality, detailed rigs · market | 2.9 → 3.2 | 333.3 → 316.6 | 933.3 → 633.3 | 103 → 97 | 32,022 → 31,590 | 64 → 62 | 807 → 821 |
| Performance, scavenging · footlocker | 14.3 → 12.9 | 66.7 → 83.3 | 150.1 → 183.4 | 290 → 294 | 18,994 → 19,032 | 27 → 27 | 716 → 730 |
| Performance, live combat · one infected | 7.3 → 7.9 | 100.0 → 100.1 | 316.6 → 283.4 | 124 → 125 | 10,986 → 10,998 | 24 → 31 | 662 → 676 |
| Performance, live combat · six infected | 6.3 → 7.3 | 133.3 → 133.3 | 583.2 → 250.0 | 232 → 233 | 22,776 → 22,788 | 26 → 33 | 799 → 813 |
| Performance, encounter-size fixture · two infected | 6.6 → 7.3 | 116.7 → 116.6 | 366.7 → 266.7 | 144 → 145 | 13,148 → 13,160 | 24 → 31 | 688 → 702 |

The first lightweight route showed large differences in the market and on the
patrol road. Changing build order and doubling the windows put the market at
133 ms p95 in both builds and the patrol road at about 167 ms in both builds.
Clinic tail time moved in opposite directions across the two passes.
Quality-mode market and the six-infected live fixture showed better p95 in
their shorter runs. The footlocker view submitted four additional draws and
its p95 moved from 150 to 183 ms. These timings establish mixed outcomes
under this CPU renderer. The graphics hardware target and the exact cause of
individual spikes remain open.

[Raw frames and window summaries](review/v016-swiftshader.json)

## Live encounter CPU profile

The natural encounter browser test captured 13 frames with the Performance
preset. Simulation work measured 0.3 ms at p50 and 1.2 ms at p95. Camera and
world updates measured 0.1 and 0.2 ms. Synchronous render submission measured
2.5 and 4.7 ms. This trace is a short V0.16 sample for diagnosing future
changes. The matched live fixtures above include full frame delivery in both
builds. [Raw profiler sample](review/v016-encounter-profile.json)
