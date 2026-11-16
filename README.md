# DEAD ZONE: AFTERMATH — Ashford Rebirth

> **Independent reconstruction prototype · NOT the recovered Sites v7.1 source**

A small, original-code third-person 3D browser survival game built from the remembered *Dead Zone: Aftermath* opening-route brief while the original Sites source is inaccessible. This repo deliberately keeps the reconstruction on its own branch to prevent accidental confusion with the original game's commit history.

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
