# Ashford Rebirth V0.15.2

This pass builds on V0.14 at `e4aeb7292b3dfa88e5647a9e914c836ed2f4f67d` and
reuses its reconstruction assets. Review PR #13, PR #14, then this branch.
The existing save format and opening route still use the original reconstruction
rules. This pass adds no external assets, services or dependencies.

| Area | What shipped | Evidence |
| --- | --- | --- |
| Adaptive rendering | Auto tries cheaper character models before lowering the render preset. Explicit character and graphics settings remain available. Near characters get most animation and shadow work. The existing interior culling stays active in Performance. | [Performance results and reproduction](PERFORMANCE-VALIDATION.md), [deterministic tests](../tests/production.test.mjs) |
| Combat and camera | Camera arm retracts around solid geometry. Aiming tightens framing and shoulder swap persists. Crowbar strike arcs, directional stagger, a short animation hold, muzzle flash, tracers and impact debris use reusable resources. | [Combat and controls](COMBAT-CAMERA-OVERHAUL.md), [browser checks](../tests/reference-visual.mjs) |
| Infected behavior | Staggered sight checks, event-driven hearing, brief search, separated steering, staggered attack starts and spitter stand-off. The clinic alarm keeps the scripted wave on the objective. | [AI rules](ZOMBIE-AI.md), [normal-rules campaign](../tests/campaign-survival.mjs) |
| Atmosphere and accessibility | Four synthesized room tones, intermittent stingers and restrained fluorescent fluctuations, audible low-health feedback, a directional damage label and touch-button feedback. | [Audio mixer](../src/audio.mjs), [browser checks](../tests/reference-visual.mjs) |

## Local verification

The V0.14 baseline and V0.15 implementation passed the existing syntax and
rules, visual, reference, campaign, WebGL smoke, keyboard route, mobile
emulation and combat suites. V0.15 ran 29 deterministic tests, including five
new tests for adaptive settings, the camera sweep and infected decisions.
The browser reference test also covered camera recovery, detail toggling,
failed asset downloads, graphics resource stability, audio pause and mute, and
effect pool limits. Mobile emulation exercised independent movement and sprint
with simultaneous touch pointers.

## Remaining work

The game uses its existing authored motion library and a procedural fallback.
Terrain-aware foot placement, exact weapon-socket placement for muzzle effects,
authored scene audio, dedicated flank maneuvers and optional rain and persistent
decals are deferred. The existing HUD and inventory design remain in use. Test
the rendered build on a physical Chromebook and on iOS and Android before
treating 60 FPS desktop or 30 FPS mobile as met. Standard controller input is
implemented and needs a physical controller playthrough.

## Review and capture

Run `npm install`, `npx playwright install chromium` and `npm run
test:reference` to record repeatable screenshot fixtures, including the narrow
clinic view. Run `npm run test:campaign` for the safehouse, Last Stop Market,
patrol car, clinic defense and final gate. The campaign test uses keyboard input,
the inventory and regular damage rules. It saves the start of the defense and
the finale to `artifacts/`.

For a short gameplay recording, serve the branch locally from one origin using
`python3 -m http.server 8000`. Start a new save in a separate browser profile,
leave the safehouse, rotate around the market doorway, and capture a clinic
fight with a dodge and pistol shot. Record the preset, character setting and
motion setting. Press **P** during the same run and choose **SAVE REPORT** for
frame-time telemetry.
