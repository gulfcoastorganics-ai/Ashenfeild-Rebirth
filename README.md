# DEAD ZONE: AFTERMATH — Ashford Rebirth

> **Independent reconstruction prototype · NOT the recovered Sites v7.1 source**

A small, original-code third-person 3D browser survival game built from the remembered *Dead Zone: Aftermath* opening-route brief while the original Sites source is inaccessible. This repo deliberately keeps the reconstruction on its own branch to prevent accidental confusion with the original game's commit history.

## V0.9 — Opening-route production pass

Market storefront and register lighting, clinic side-ward curtains and fluorescent
lighting, and patrol-car trim were refined using procedural art. Regional instance
batches cull street details more precisely. The survivor's foot cycle follows
actual distance traveled, and the smoothed camera is constrained by solid walls.

The pause menu offers **Auto**, **Performance**, **Balanced** and **Quality**.
**Auto** starts at Balanced and adapts during play without changing the saved
selection. **Performance** reduces resolution and disables shadows and ambient
particles. **Balanced** caps render pixel ratio at 1.0. **Quality** raises that
cap to 1.6 on high-density screens. Press **P** to see the effective tier and
export local measurements.

See the [V0.9 production audit](V09-PRODUCTION-AUDIT.md) for findings, rollback,
the matched render comparison, and hardware verification limits.

## V0.8 — Screenshot-Reference Visual Overhaul

**Reference:** User-supplied ChromeOS screenshot of the *original* Ashford 3D clinic, used only for composition and styling guidance. This is still a separate, original-code reconstruction—not an export of the Sites v7.1 game, its models, or its animation rigs.

- Recreated the **clinic's recognizably cinematic composition**: worn gray/cream checkerboard floor, teal middle wall band, off-white upper wall, lower concrete skirting, central steel door, supply/medic directional labels, overhead fluorescent tube and triage counter.
- Preserved solid collision, original world coordinates and stage triggers. Environmental dressing is visual-only.
- Updated the **survivor silhouette** with fitted red-black plaid, tapered jacket, brown trousers and a green structured backpack with straps, pockets and metal hardware.
- Added a non-interactive blue-shirted **clinic guard** beside a refined Dr. Vale NPC, approximating the reference's two-survivor composition without changing dialogue.
- Pulled the third-person camera in for a more expressive over-the-shoulder view.
- Corrected screenshot-review occlusion from near-camera ceiling fixtures and moved clinic curtains to the side wards; reshaped heads toward human proportions.
- Improved the **Graphics: Performance** fallback so low-FPS browsers with device-pixel ratio 1 also reduce rendering cost, including 0.85 resolution scale and disabled shadows.
- Reorganized the HUD around compact **health/stamina**, a left-side **field objective**, top-right **day/weather-survival readout**, functional **LIGHT** toggle (L), and a bottom-right **weapon card**, retaining mobile and inventory controls.
- No paid models, external textures, new skeletons or production deployment.

### Tests
Run \`npm run check\`, \`npm run test:reference\`, \`npm run test:visual\`, \`npm run test:campaign\`, \`npm run test:route\`, \`npm run test:mobile\` and \`npm run test:combat\`. V0.8 CI captures \`artifacts/v08-reference-clinic.png\` and \`v08-reference-market.png\`.

**Performance:** The cinematic layout is a visual approximation—not a claim of AAA photorealism. Rendering tests use headless Chromium/SwiftShader. Real Chromebook/Android/iPhone hardware must be profiled separately.

## V0.7 — Visual Fidelity & GPU Optimization

V0.7 improves the **independent reconstruction**, not the inaccessible original Sites source.

**Visual pass:** Last Stop Market, Ashford Clinic and the safehouse now use differentiated, weathered procedural wall/floor textures. The four infected archetypes reuse distinct worn-fabric maps and mottled skin; their original rigs, silhouettes and animation pivots remain intact.

**GPU/resource pass:** Common opaque PBR materials are cached, sphere/cylinder geometry is reused, and repetitive shelves, products, puddles, road markings, debris, storefront grime and tree foliage are rendered as grouped instances. Distant point lights outside their attenuation radius are disabled. Transient combat effects keep disposable geometry separate from shared assets.

**QA:** The new `npm run test:visual` captures safehouse, market, patrol and clinic screenshots while checking draw calls, GPU geometry counts and triangles in Chromium. The existing normal-rules campaign, WebGL, route, mobile and combat tests remain mandatory.

```bash
npm install
npx playwright install chromium
npm run check
npm run test:visual
npm run test:campaign
```

For a **real Chromebook comparison**, play the game locally, press **P**, choose **SAVE REPORT**, and compare Default versus Graphics: Performance. GitHub Actions uses SwiftShader software rendering, *not a Chromebook or smartphone GPU*. See [VISUAL-QA.md](VISUAL-QA.md).

## V0.6 — Normal-rule survival and local profiling

This phase is still an **independent reconstruction**, not recovered Sites v7.1 code.

- **X / DODGE** triggers a stamina-costing evasive roll with collision checks, a short damage-avoidance window and cooldown. The mobile HUD shows **DODGE**.
- **Q / R** turn the camera left/right on keyboard, allowing combat aiming without a mouse drag.
- The FPS overlay (**P** or **FPS**) now includes **SAVE REPORT**, which downloads `ashford-v06-performance.json` containing local browser FPS, p50/p95 frame time, draw calls, triangles, geometries, pixel ratio, viewport and frame samples. No remote data upload.
- New `src/survival.mjs` keeps dodge and frame statistics deterministic and covered by unit tests.
- `npm run test:campaign` scripts a **normal-rules** opening route using physical keyboard controls, bandage use, aiming, real pistol/melee hits and dodging. It does **not** teleport, enable invulnerability, spawn staged enemies or trigger the test-only kill helper. It uses read-only localhost QA coordinates to guide its keyboard actions; this is not a human playthrough.
- Existing WebGL, route, mobile and controlled-combat regression checks remain intact.

### Collect a real Chromebook performance report

Run the game locally using the instructions below. Once playing, press **P**, choose **SAVE REPORT**, and save the JSON file. Repeat in **Graphics: Performance** mode (Pause menu) for a comparison. The browser cannot report GPU FPS from GitHub's headless SwiftShader tests, so profiling on the actual Chromebook remains essential.

**Current deployment note:** GitHub Pages is not verified live. Do not treat the recovery placeholder `main` as a game deployment.

## V0.5 — Combat & Character Fidelity

This is the **independent reconstruction branch**, not original Sites v7.1 source.

- Unified pistol and crowbar range, damage and directional hit tests in `src/combat.mjs`; bullets cannot pass collision cover.
- Added hit/kill crosshair feedback and short survivor animation overlays for strikes, recoil, running and breathing without changing the existing character skeleton.
- Infected attacks now anticipate (Runner fast, Brute heavy, Spitter ranged), with strike distance and line of sight rechecked at resolution time. Non-Brute enemies can have a windup interrupted by a successful hit.
- Updated survivor plaid material with more realistic fading, procedural fibers and weathering using a small reusable canvas texture.
- New browser combat integration test drives real **F** and **Space** keyboard actions against a localhost-only test encounter and checks actual health, kills and enemy damage. No test-only call to `hurtEnemy` or `finishWave` is used.
- Earlier route, mobile, WebGL and checkpoint tests are retained.

```bash
npm install
npx playwright install chromium
npm run check
npm run test:combat
```

The combat test uses a localhost-only encounter arrangement and suppresses damage **only for the multi-enemy weapon tests** to make software-rendered CI deterministic; it separately verifies an enemy can injure the player with damage enabled. It does **not** certify a complete unaided survival playthrough or hardware FPS. See [COMBAT-QA.md](COMBAT-QA.md).

## V0.4 — Navigation, traversal tests and visual quality

This remains an **independent reconstruction**, not recovered Sites v7.1 source.

- Added bounded clearance-aware A* paths with no diagonal corner clipping and cached pursuit waypoints for infected.
- Reduced road-detail rendering from 260 individual static meshes to four instanced batches.
- Expanded the plaid survivor's straps, seams and clothing wear; improved infected silhouettes without replacing rigs.
- Added reused geometry and clearer ambient lighting/material details in Last Stop Market and Ashford Clinic.
- Added an optional FPS diagnostics panel (**P** on keyboard or **FPS** button) reporting sampled FPS, 95th-percentile frame time, draw calls, triangles and pixel ratio.
- Extended GitHub Actions with a **keyboard-driven opening route** and a **390×844 mobile Chrome emulation** test.

```bash
npm install
npx playwright install chromium
npm run check
npm run test:browser
npm run test:route
npm run test:mobile
```

**QA qualifications:** The route test travels using real keyboard movement and collisions, but uses localhost-only damage suppression to isolate traversal and test-only resolution for the clinic defense. It is not a full combat balance or human playthrough test. The emulated phone and SwiftShader measurements are not real hardware benchmarks. Use the in-game FPS overlay to measure your Chromebook and real phone.

## V0.3 browser QA and frame pacing

The V0.3 branch adds a real Chromium/WebGL smoke test and a scripted nine-objective mission flow check, plus a time-step fix to reduce slow-motion movement on low-end GPUs. It generates screenshot artifacts in GitHub Actions.

- Run the deterministic tests: `npm run check`
- Run browser tests after `npm install` and `npx playwright install chromium`: `npm run test:browser`
- Read [BROWSER-QA.md](BROWSER-QA.md) for the exact test scope and the still-unverified manual route and mobile checks.

The game is **not yet published to GitHub Pages**; the expected URL currently returns 404. Configure Pages separately before describing it as a live playable public build.

## v0.2 audit improvements

The v0.2 audit branch improves the reconstruction without changing the original Sites production game:

- Camera collision with walls, corrected movement/facing, closer third-person framing
- Camera-directed melee/pistol targeting with basic wall occlusion
- Doorway-aware infected pursuit, collision checks, and a readable Spitter windup
- Checkpoint validation, improved mission trigger distances, explicit clinic-gate completion
- Road grit, puddles, storefront grime, cooler clinic wayfinding, street debris, atmospheric particles
- Auto/Performance graphics preset (Pause menu) and automatic low-FPS downgrade
- Modular deterministic logic tests and CI verification

**Verification:** Helper logic checks ran successfully; full browser gameplay and device FPS are **not yet verified**. See [AUDIT.md](AUDIT.md) for findings, risk and the manual QA checklist.

### Automated checks (Node.js 22+)

```bash
npm run check
```

## What is implemented

- Procedural 3D Ashford street and safehouse, Last Stop Market (warm counter lighting, aisles, Mara), Ashford Clinic (cool ward, beds, curtains, wayfinding, Dr. Vale) and a patrol car
- Plaid-shirt survivor, backpack, sprinting, stamina/health/hunger/thirst HUD, third-person follow camera
- Four infected types: Walker, Runner, Brute, Spitter; basic pursuit, melee and ranged attacks
- Crowbar melee and pistol ammunition combat, pickup interactions, NPC conversations, local save/restart
- Nine-stage introductory mission culminating in a clinic defense
- Inventory with consumable water, food and bandages
- Minimap, objective waypoint, checkpoint persistence, desktop keyboard/mouse and mobile touch controls
- Procedural material and geometry assets; no paid assets or generated images required

**Visual note:** Geometry, textures, character models, dialogue, quest details and animations are original approximations. The actual v7.1 Sites assets and source were not available; this is not a visually faithful copy or the original 84-file deployment.

## Play via GitHub Pages

In repository **Settings → Pages**, under **Build and deployment**, choose **Deploy from a branch**, select **reconstruction-prototype**, select **/(root)**, and save. The page URL normally becomes:

https://gulfcoastorganics-ai.github.io/Ashenfeild-Rebirth/

That URL is **not confirmed active** until Pages is configured and its first deployment succeeds.

## Play locally on a Chromebook

In the Linux terminal:

```bash
git clone --single-branch --branch reconstruction-prototype https://github.com/gulfcoastorganics-ai/Ashenfeild-Rebirth.git
cd Ashenfeild-Rebirth
python3 -m http.server 8000
```

Open **http://localhost:8000** in Chrome.

Requires WebGL and an internet connection for the pinned Three.js ES module from jsDelivr. All game art/world generation and save data otherwise run locally in the browser.

## Controls

| Desktop | Action |
| --- | --- |
| W A S D / arrows | Walk |
| Shift | Sprint |
| Drag on game | Rotate camera |
| E | Interact at waypoint |
| Mouse click / Space | Crowbar attack |
| F / right mouse click | Pistol fire (after pickup) |
| I | Inventory and consumables |
| Escape | Pause / resume |

Mobile uses a virtual movement stick and **USE / FIRE / HIT / RUN** buttons.

## Project safety and provenance

- The original Sites production page remains independent: https://dead-zone-ashford-3d.easyfirefly2.chatgpt.site/
- The original production was identified as v7.1, Site version 17, source commit `1c2eb8fbba4fc8587078c1608f6ddfdeac5146c2` — **none of that original Git history is present here**.
- **main** is reserved as a source-recovery notice and has not been replaced with reconstructed game files.
- **reconstruction-prototype** contains this independent build and its own new commit history. Never pass these commits off as original Sites commits.
- No production deployment or modification is performed by this project.
- Because this destination repository is public, review any subsequently recovered history for secrets before pushing it.

## Validation and limitations

Verified on the connector: committed files retrievable, JavaScript parses after stripping its import statement, all direct HUD element IDs resolve, and no obvious GitHub/OpenAI secret patterns were found. Full gameplay, mobile hardware, FPS, sound autoplay, asset parity and Pages deployment have **not** been browser-tested. This is a playable-intent prototype, not a QA-certified release.

### Recovery remains separate

If the genuine Sites Git bundle becomes available, preserve its commit ancestry and import into a separate source-recovery branch or dedicated repository after security review. Do not overwrite it with this recreation.
