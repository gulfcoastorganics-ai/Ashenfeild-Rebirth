# DEAD ZONE: AFTERMATH — Reconstruction V0.6 Survival & Performance QA

> **Provenance:** This is independent browser-game source. It is **not** the inaccessible original Sites v7.1 checkout (Sites version 17 / commit 1c2eb8fbba4fc8587078c1608f6ddfdeac5146c2).

## Scope

V0.6 focuses on validating actual gameplay rather than synthetic test-only kills:
- Normal opening mission and physical keyboard traversal from safehouse to Last Stop Market, Mara, supply cache, patrol car, Ashford Clinic and Dr. Vale.
- Clinic defense with ordinary aiming, weapon inputs, AI pursuit, incoming damage, bandage healing, stamina-consuming dodge and mission progression.
- No gameplay-state modification by the campaign test. The localhost-only \`__ashfordQA.snapshot()\` is **read-only** for this test; it does not call teleport, noDamage, finishWave or combatSetup.
- No paid assets, no new character rigs, and no production Sites changes.

## Implementation

| Area | Change |
| --- | --- |
| Evade | X key / mobile DODGE; 22 stamina, 0.32s movement, 0.24s damage avoidance, 1.1s cooldown |
| Camera | Q and R keyboard turn controls for touchpad-free aiming |
| Feedback | ROLL cooldown on HUD and optional motion overlay on survivor torso |
| Performance | FPS menu downloads \`ashford-v06-performance.json\` with local frame samples and renderer counters |
| QA | Deterministic survival tests and normal-rules scripted browser campaign |

## Measured intermediate findings

The first GitHub Actions full run (**43990932258**) passed JavaScript/rules tests, WebGL, keyboard route, mobile controls, and the established combat test. It also reached Dr. Vale at **78 health** and defeated **four clinic attackers under real damage rules**, with **22 attacks, two dodges, one bandage**, finishing the wave at **90 health**. Its final step failed because the automated browser script demanded an overly precise camera reset after combat. V0.6 updates that final instruction to navigate into the gate interaction radius using standard movement. That earlier run is not a full campaign PASS until the corrected test completes.

## Verification required before merge

- \`npm run check\`: deterministic tests
- \`npm run test:campaign\`: complete normal-rules campaign and final victory screen
- \`npm run test:browser\`: main screen and mission smoke
- \`npm run test:route\`: navigation regression
- \`npm run test:mobile\`: joystick, touch actions and dodge
- \`npm run test:combat\`: controlled four-kill and damage regression

## Hardware profile instructions

On Chromebook Linux:
\`\`\`bash
git clone --branch reconstruction-prototype https://github.com/gulfcoastorganics-ai/Ashenfeild-Rebirth.git
cd Ashenfeild-Rebirth
python3 -m http.server 8000
\`\`\`

Open http://localhost:8000. During gameplay press **P** (or tap **FPS**) and **SAVE REPORT**. Save the downloaded JSON twice, once using default graphics and again after choosing **Graphics: Performance** in the pause menu. Compare sample FPS and frame-time p95. Real device thermal, memory and browser GPU profiling still require actual user hardware. Headless software-renderer FPS is not a valid estimate of Chromebook GPU FPS.

## Limitations

The campaign is automated keyboard gameplay with read-only local telemetry, not a human playthrough. It only establishes success for that play strategy in Chromium/SwiftShader and does not prove every difficulty, physical mobile device, or long-term save scenario. Geometry and character fidelity remain visibly procedural/low-poly. The original Sites v7.1 source remains unavailable and must not be conflated with this reconstruction.
