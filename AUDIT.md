# Ashford Rebirth — v0.2 Code Audit & Improvement Record

**Audit target:** `reconstruction-prototype` — an independent reconstruction.  
**Source:** Three browser files committed in this repository, not the original v7.1 Sites checkout.  
**Original production:** v7.1, Site version 17. No changes made to the live Site.

## What the code inspection established

| Severity | Finding in v0.1 | v0.2 action | Verification |
| --- | --- | --- | --- |
| High | Survivor and infected orientation signs were reversed relative to forward movement | Corrected rotations and initially oriented camera toward the safehouse exit | Code inspection; not browser-playtested |
| High | Melee and gun attacks could select enemies behind walls | Added 2D line-of-sight collision tests and a tighter pistol targeting cone | 2D helper tests passed |
| High | Third-person camera did not account for building walls | Added collision raycast against solid scene geometry and moved camera closer | Static inspection only |
| High | Infected chased directly into clinic/market exterior walls | Added doorway pursuit goals and wall-aware movement | Deterministic entrance tests passed; full wave path unverified |
| Medium | Saved stage 8 could be forced backward to the clinic defense | Checkpoint normalization, stage-aware save and wave restore | Static review and helper checks |
| Medium | Mission 1 could complete while still inside the safehouse | Reduced exit arrival radius | Static review |
| Medium | Final route objective could auto-complete without explicit gate action | Require interacting with clinic entrance | Static review |
| Medium | Public-road material and market glass appeared flat | Procedural grit, puddles, storefront grime, clinic detailing, cones and particle dust | Implemented in code; visual comparison still needed |
| Medium | Spitter's attack windup had no posture telegraph | Added pre-attack torso lean | Implemented; visual verification pending |
| Medium | No user-controlled graphics setting | Added Auto / Performance preset and automatic slow-FPS fallback | Static review |
| Medium | No repeatable logic tests | Extracted collision/navigation helpers, added Node tests and GitHub Actions workflow | Helper cases executed in an isolated JS harness; GitHub Actions results pending |
| Low | Reduced-motion preference was not respected in modal transitions | Added CSS reduced-motion handling | Static inspection |

## Risk and unresolved limitations

1. **No full browser QA was possible in this session.** There is no verified live screenshot, FPS benchmark, gameplay video, network inspection, or end-to-end run.
2. **The game is a prototype, not a recovered v7.1 build.** Its geometry, textures, rigs, animations, scripts and story dialogue are independent approximations.
3. **Enemy navigation is doorway steering, not complete A\*.** Obstacle-dense regions can still create stuck enemies. The full clinic defense must be tested manually.
4. **Combat is simplified.** Gun targeting is a horizontal auto-target cone with wall occlusion, not a full 3D scoped projectile simulation.
5. **Graphics still use primitive procedural geometry.** A major asset-quality gap remains to reach commercially polished visual standards.
6. **No authoritative multiplayer, server saves, NPC schedules or robust persistence migration.**
7. **The Three.js engine is loaded from a CDN.** Initial play requires an internet connection; offline support and dependency vendoring are future work.
8. **Public repository:** Preserve source history review before importing any genuine Sites repository.

## Test commands

On ChromeOS Linux or any Node.js 22+ environment:

```bash
npm run check
# or
node --test tests/logic.test.mjs
```

This suite checks 2D world bounds, solid walls versus door openings, line of sight, doorway pursuit transitions and checkpoint sanitization.

## Manual QA that remains required

- Start game, follow the marker through the safehouse front gap, and verify route 1 does not complete prematurely.
- Enter Last Stop Market and reach Mara behind the counter.
- Collect supplies, recover pistol from patrol car, travel to clinic, and speak to Dr. Vale.
- Confirm walkers, runners, brutes and spitters approach through the open clinic entrance rather than walls.
- Defeat four infected, return to the clinic gate and activate the final interaction.
- Verify melee and pistol attacks cannot hit enemies through a wall.
- Verify automatic save/reload at steps 2, 5, 7 and 8.
- Inspect 360° camera near each wall, beds and counter. Check that it never passes through solid walls.
- Test Android Chrome, iOS Safari, and ChromeOS keyboard/mouse and touch. Measure FPS, memory and responsiveness.
- Try the Performance graphics preset on low-powered hardware; confirm audio starts after user input.
- Check the Console for errors and network failure (including the external Three.js CDN).

## Acceptance before claiming a "playable verified" release

- All Node checks pass in GitHub Actions.
- Complete opening route played once on desktop and once on touch device.
- No visible blocking bugs or wall-clipping.
- Actual before/after screenshots and performance numbers exist.

**Do not deploy over the original Sites production version.** GitHub Pages, if enabled, is a separate demonstration site.
