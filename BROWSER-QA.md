# Reconstruction V0.3 — Browser QA

This branch is an **independent reconstruction** of the Dead Zone: Aftermath opening route. It is not the unavailable original Sites v7.1 source code.

## Actual browser validation

A Playwright/Chromium integration test launches a local HTTP server, runs the actual Three.js game with WebGL/SwiftShader, and checks:

- The 3D scene initializes without uncaught module/runtime errors
- Opening menu, start action, HUD and mission objective render
- Keyboard walking advances toward the initial waypoint
- Inventory opens/closes and displays items
- Pause menu works, graphics mode switches, resume works
- LocalStorage checkpoint survives reload
- Nine mission stages transition in order: safehouse exit → market → Mara conversation → supplies → patrol car/pistol → clinic arrival → Dr. Vale conversation → infected-defense completion → gate/victory
- Screenshots of the menu, scene, checkpoint and clinic defense are uploaded as CI artifacts

**Scope:** The final nine-stage test uses a *localhost-only* QA interface to place the survivor at each objective and resolve the four-enemy defense deterministically. This verifies actual rendered browser mission scripting and interface transitions, but does **not** prove that a human can traverse the whole route, that infected AI always paths successfully, or that combat is properly balanced. The QA interface is not active on GitHub Pages.

## Performance fix

The original 0.06-second frame cap caused gameplay to run in slow motion when rendering was slow. V0.3 simulates wall-clock frame time with multiple bounded physics steps and measures FPS from real elapsed time. Hardware/mobile profiling is still needed.

## Automation

```bash
npm install
npx playwright install chromium
npm run check
npm run test:browser
```

GitHub Actions uses Ubuntu 24.04 because Playwright 1.56.1 does not support the hosted ubuntu-latest image's Ubuntu 26.04 release.

## Still required before a real release

- Publish a separate playable preview (GitHub Pages is currently **404 / not configured**).
- Complete physical desktop and mobile playthroughs; verify trigger positions, enemy navigation and all collision shapes.
- Benchmark FPS, memory and thermal behavior on low-end devices.
- Visually inspect screenshot artifacts to plan high-value visual improvements.
- Confirm three-dimensional aiming, accessibility and touch-device controls.
- Recover original Sites Git separately; keep production v7.1 and Site version 17 untouched.
