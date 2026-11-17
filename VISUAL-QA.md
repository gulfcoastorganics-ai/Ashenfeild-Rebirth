# V0.7 Visual Fidelity & GPU Optimization — Audit

## Source and production separation

This work is on the independent `Ashenfeild-Rebirth` reconstruction. It is not recovered original DEAD ZONE: AFTERMATH v7.1 source, and does not modify production Sites version 17 or its saved deployment archive.

## Source-code findings

| Area | V0.6 finding | V0.7 implementation |
| --- | --- | --- |
| Materials | Many identical `MeshStandardMaterial` allocations for stock and props | Cache opaque immutable colors/roughness/metalness; separate unique emissive and enemy hit-flash materials |
| Rounded props | New sphere and cylinder geometry per head, limb, can, pole or wheel | Shared scaled unit sphere/cylinder geometry, with transient-effects disposal safeguards |
| Market | Product boxes on shelves were separate mesh draw calls | 4-color instanced product groups, reused shelves and batched storefront scuff decals |
| Street | Repeated paint, puddles, debris, trees | Instanced static batches, retaining source procedural positions/colors |
| Environments | Large walls remained flat and lacked material separation | Compact 256px procedural weathered textures, distinct clinic, market and safehouse floor palettes |
| Infected | Four silhouettes but relatively flat clothing | Reusable archetype-specific worn fabrics and skin detail without new rigs |
| Lighting | All point lights active regardless of player position | Cull only beyond light attenuation radius with a conservative padding |
| Verification | GPU headless tests not scene-comparison oriented | Per-scene screenshots and render-resource logs on four opening-route views |

## Performance interpretation

The earlier V0.6 normal-rules test reported roughly 4.76 FPS, 336 draw calls, 16,541 triangles and 214 live geometries in a software-rendered clinic sample. These are contextual reference values, **not matched-position before/after metrics**. V0.7 captures four independent scene snapshots with draw-call/triangle/geometry counts. Different scene angles and objects make these metrics unsuitable as proof of an exact FPS improvement.

Use real ChromeOS/Android hardware to verify sustainable FPS, input latency, memory consumption, overheating, battery and visual acceptability. The in-game FPS overlay can export JSON via **SAVE REPORT**.

## Validation and release criteria

- Deterministic survival/combat/navigation tests must pass
- Full no-override keyboard campaign must finish the clinic gate
- Mobile emulation and basic combat must pass
- V0.7 screenshot/renderer-resource check must not crash or exceed its specified allocations
- Inspect the four screenshots for missing surfaces, overly dark interiors, texture tiling and mirrored labels before merge
- Do not claim AAA assets, real-device performance or recovery of the original Sites repository

## Remaining gaps

Rig geometry is still stylized low-poly. The reconstruction does not include high-fidelity scans, commercial PBR assets, authored facial animation, advanced animation blending or a verified mobile GPU benchmark. Visual polish should not come at the expense of navigation or the successful opening survival route.
