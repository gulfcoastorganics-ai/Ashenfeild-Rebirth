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
host, build order, viewport, device pixel ratio and preset for both sides.
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
```

Each measured view records three 12-frame windows per build, measured
draw calls, triangles, resident texture counts and scene objects. Scene
objects count the scene graph, including hidden parts. FPS and p95 describe
browser frame delivery under software rendering. The per-section profiler
measures synchronous time through each update and render submission.
It cannot isolate completed GPU work, shader execution, driver queue latency
or garbage collection.

The game asset directory still occupies 2.35 MiB. It contains no new binary
dependencies for the sandbox. See the [prior asset size estimates](PERFORMANCE-VALIDATION.md)
for unpacked texture estimates. Physical device measurements are pending.
