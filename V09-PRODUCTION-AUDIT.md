# Ashford Rebirth V0.9 production audit

The independent reconstruction starts at rollback commit [5dde998](https://github.com/gulfcoastorganics-ai/Ashenfeild-Rebirth/commit/5dde998f09812ae939445d07259eb7cab48452d8). The original Sites game remains a separate visual reference. The audit covers the safehouse, Last Stop Market, patrol car, Ashford Clinic, and the nine-stage opening campaign.

| Rank / severity | System | Evidence at V0.8 | V0.9 implementation or remaining work | Expected effect | Effort | External spend |
| --- | --- | --- | --- | --- | --- | --- |
| 1 / High | Graphics settings | The five-second FPS check ran before play and persisted a slow-frame downgrade over Auto. | Separate the saved mode from the render tier. Auto measures active play, starts at Balanced and can recover after 12 seconds of sustained headroom. Add manual Performance, Balanced and Quality. | User-selected quality persists; weak devices can reduce pixel and shadow cost. | Medium | $0 |
| 2 / High | Scene submission | Foliage and road cracks use map-wide instance bounds. Repeated frames, shelves and fixtures still submit as separate meshes. | Region-cull foliage and road cracks, use lighter canopy geometry, and instance compatible static props within each region. Preserve collision and per-prop shadow flags. | Fewer offscreen triangles and reduced repeated submissions. The regional batches can add calls to views spanning several regions. | Medium | $0 |
| 3 / High | Touch and camera | A camera position could stay across a wall during interpolation. Sprint and look lacked complete pointer-capture cleanup. | Constrain the actual camera position every rendered frame. Make look, joystick and sprint track independent pointers and clear input on blur or canceled capture. | Fewer camera clips and stuck inputs. | Medium | $0 |
| 4 / Medium | Visual composition | Market panes were flat with separate transparent grime, clinic curtains were slabs, and the cruiser side read as a plain box. | Use procedural glass weathering, warmed register lighting, pleated side-ward curtains, cooler clinic task lighting, and cruiser trim and signage. Keep all route and encounter coordinates. | Clearer scene and landmark identity without imported models or full-screen effects. | Medium | $0 |
| 5 / Medium | Enemy CPU and resources | Every live enemy ran a cover check each simulation step, including dormant enemies. Removed enemies retained a torso material clone in renderer bookkeeping. | Test attack distance and eligibility before the cover query. Dispose the clone on despawn while keeping the shared texture. | Reduce unnecessary CPU and release transient material resources. | Low | $0 |
| 6 / Medium | Movement and survival | The gait loop used elapsed time and stepped against walls. Food and water readouts were hidden on touch layouts. Survival drain could bottom out at zero without invoking defeat. | Blend gait by distance traveled, show mobile food and water, and route lethal survival drain through defeat. Save on page hide and reuse validated wave progress on reload. | Better motion at contact, visible survival state, reliable ending and checkpoint behavior. | Medium | $0 |
| 7 / Medium | Navigation and combat | Bounded A* creates per-search arrays. Four infected already have separate speeds, attack windows and silhouettes. | Preserve the current pathing and attack balance. Movement, collision, real attacks and normal-rules clinic victory are regression gates. | Keeps the route and enemy behavior intact. Pursuit pathfinding remains a candidate for dedicated CPU profiling. | Low | $0 |
| 8 / Medium | Runtime availability | A cold start needs the pinned Three.js CDN module and WebGL2. Rendering, saves and procedural art run in the browser. | Keep the static deployment and pinned runtime. Optional local vendoring would need license handling and a build-size decision. | No new service, dependency or asset cost. CDN startup remains an availability dependency. | Low | $0 |
| 9 / Medium | Asset fidelity and verification | The survivor and enemies use primitive meshes and pivot animation. Chromium CI does not represent a Chromebook or mobile GPU. | Preserve the original pivot rigs and infected gameplay. Improve backpack details and grounded gait. Use comparable rendering captures plus separate gameplay tests. | Presentation improves incrementally. Authored character rigs, convincing hand poses, IK and device profiling remain open. | Medium | $0 |

## Verification

The existing workflow covers syntax and deterministic rules, four WebGL scenes, HUD and flashlight, keyboard traversal, a normal-rules opening campaign, mobile input, and combat. The smoke test now checks all four graphics modes and reload persistence. The mobile test adds real simultaneous emulated touch pointers for movement and sprint.

The optional matched comparison uses one headless Chromium/SwiftShader process, a repeatable random seed, scripted camera fixtures, a 1200×720 viewport, device pixel ratio 1 and manual Performance (0.85 render ratio, shadows disabled). It parks simulation for each frame sample. The result records frame intervals, JavaScript render callback durations, startup readiness, draw calls, triangles, live geometry and texture counts. Source changes alter the procedural world, so scenery composition need not be pixel-identical. GPU timing, memory in bytes, and battery impact require device profiling. Counts are renderer counters, and samples include browser scheduling and software rendering.

```sh
git worktree add --detach ../ashford-v08 5dde998f09812ae939445d07259eb7cab48452d8
npm install --no-audit --no-fund
npx playwright install chromium
node tests/compare-render.mjs ../ashford-v08
```

The comparison writes eight PNGs and `benchmarks.json` under `artifacts/v09-comparison/`. For a hardware sample, play the same route, open the FPS panel with **P**, and select **SAVE REPORT**. Measure Performance and Balanced on the target Chromebook and on Android/iOS before setting hardware FPS claims.

## Remaining release priorities

1. Profile real ChromeOS, Android and iOS devices, then set sustainable frame-time and temperature targets for each tier.
2. Improve survivor and infected anatomy with reusable, licensed models only if measured asset and GPU budgets permit. Add authored locomotion and foot placement without changing combat timing.
3. Profile the clinic defense on target hardware. Optimize path search and shadow casters only where trace data shows a material bottleneck.
