# V0.5 Combat & Character Fidelity — QA Record

**Scope:** Original-code Dead Zone: Aftermath reconstruction only, on `reconstruction-v0.5-combat-fidelity` until merged. Production Sites v7.1 / Site version 17 is untouched.

## Changes

| Component | V0.5 behavior |
| --- | --- |
| Weapon hits | Shared deterministic selection with angle, range, health, and wall-cover checks |
| Crowbar | Short-range attack with upper-body swing, feedback and cooldown |
| Pistol | Directional target selection, muzzle effect, recoil pose, hit/kill confirmation |
| Infected AI | Walker, Runner and Brute use distinct melee windups; Spitter telegraphs ranged attack; attacks must still be in range and line of sight when resolved |
| Hit reaction | Brief stagger and material flash; Brute has shorter stagger; dead enemies cannot be damaged or counted again |
| Character identity | Sharper faded plaid, fiber wear, backpack seams preserved; original low-poly rigs reused |
| Accessibility | Hit indicators supplement combat audio and have a reduced-motion override |

## Automated evidence

- `npm run check` runs syntax and deterministic combat logic cases, plus existing collision/pathfinding tests.
- `npm run test:browser` verifies startup, opening mission script and saves.
- `npm run test:route` validates physical keyboard movement through the full route with damage suppressed.
- `npm run test:mobile` verifies emulated touch movement and UI.
- `npm run test:combat` verifies **actual keyboard-driven attacks** damage/kill four staged enemy variants, advancing the clinic kill objective. It also verifies an enemy attack damages the player when enabled.

The browser combat fixture is enabled only on `127.0.0.1/?__qa=1`; it cannot be invoked on a public GitHub Pages deployment. The staged encounter is controlled, so the result is not equivalent to a fully unaided survival playthrough.

## Still needed

- Confirm player combat against an unmodified opening-route wave (without QA invulnerability, enemy reset, or telemetry hooks).
- Play on real Chromebook GPU and physical Android/iPhone; profile attack feel, stamina balance, FPS and battery.
- Test all infected attacks, interrupted windups and cover behavior manually.
- Improve rig quality/mesh fidelity further if real-device performance budget allows.

**Original Sites v7.1:** no code changed, no deployment made.
