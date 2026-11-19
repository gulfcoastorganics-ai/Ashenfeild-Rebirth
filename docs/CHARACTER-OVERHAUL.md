# Ashford Rebirth V0.14 character overhaul

The V0.14 feature branch descends from PR #13 head `1acb07f15dd8f8aa40ae188f9d2b7b3425b25956`. The destination branch at kickoff was V0.13 merge `4372bd681f5a62f8f7d26b4d2fb4816078c7bbb3`. PR #13 was still open, and its run `44595513227` had passed. Review PR #13 first. After it is merged, update or rebase V0.14 if the chosen merge strategy rewrites the original commit chain. The V7.1 Sites game is separate.

## What changed

- The player's skinned model has realistic adult proportions, photographic skin, short hair and stubble, a red plaid jacket, dark trousers and a green canvas backpack. Movement and combat rules remain independent of the rendered model.
- Mara has a warm work shirt, dark skin and a ponytail. Dr. Vale wears subdued clinic scrubs and sneakers. The clinic guard has darker utility clothing and a cap. The existing dialogue speakers, positions, map markers and quest checks still use the same gameplay state.
- Walker, Runner, Brute and Spitter use a shared torn-clothing mesh with different scale, shading, animation rate and posture. The spitter has a visible throat cue during its charged attack.
- Rendering batches each room's furniture separately. Performance can omit the other rooms' interiors when the camera is clearly inside one room, preserving exterior walls and visible room detail. Drawing opaque walls and fixtures before large ground surfaces reduces redundant indoor fragment shading. A room's collision meshes and quest triggers remain available independently of visibility.
- Character primitives use a common per-instance bone texture. Fine surface maps are fetched on demand and retained once decoded. Quality toggles detach those maps from the material without marking their unchanged pixel source dirty or allocating a new texture. This trades bounded retained memory for fewer uploads when cycling modes.

## Asset selection and rebuild

Ara 3D Gen made it possible to match the character proportions and wardrobe and export the same lightweight joint hierarchy across all five models. The Quaternius Universal Animation Library is reusable under CC0, but a second rig and retargeting chain would add work. Mixamo's game-use terms were reviewed separately from raw public redistribution. The checked-in builds use no Mixamo files. Khronos and Poly Haven remain useful for prop fixtures and environments. See [the asset manifest](ASSET_MANIFEST.md) for licensing and bytes.

The profiles and optimizer form the reusable import. Run these commands from the repository root with Node 22 or later and npm. The downloaded packages stay outside the checkout. The optimized files are checked in and self-contained.

```sh
tool_dir=/tmp/ashford-v014-tools
raw_dir=/tmp/ashford-v014-raw
npm install --prefix "$tool_dir" --ignore-scripts --no-audit --no-fund \
  ara3d@0.9.0 ara3d-data@1.1.0 @gltf-transform/core@4.2.1 \
  @gltf-transform/functions@4.2.1 meshoptimizer@0.24.0 sharp@0.34.5
export ARA3D_DATA="$tool_dir/node_modules/ara3d-data/assets"
"$tool_dir/node_modules/.bin/ara3d" export --params scripts/characters/survivor.json \
  --animations idle,walk,walk_slouch,run,turn_left_45,turn_right_45,sword_slash,pistol_aim,pistol_fire,roll_forward,hit_front,death_forward,death_backward,use_press,talk_gestures,stumble_recover,punch \
  --out "$raw_dir"
for role in mara vale guard infected; do
  "$tool_dir/node_modules/.bin/ara3d" export --params "scripts/characters/$role.json" --no-animations --out "$raw_dir"
done
node scripts/optimize-characters.mjs "$tool_dir" "$raw_dir" assets/characters
```

The optimizer creates plaid in the survivor shirt texture, reduces texture dimensions, preserves alpha where sampled, strips secondary normals and roughness maps, simplifies and quantizes geometry, and thins linear motion channels before removing redundant samples. It validates the 26-bone skins and 17-motion bank. Assets total 1,885,040 bytes after optimization. Only the survivor's 646,756 bytes preload near startup.

See [the animation notes](ANIMATION-SYSTEM.md) for the motion map, attachment and fallback details.

## Review captures

- [Survivor, Mara, Dr. Vale, and clinic guard](review/v014-survivors.jpg)
- [Walker, Runner, Brute, and Spitter](review/v014-infected.jpg)

These are paired game captures with matching camera coordinates, build seed, resolution and Performance preset. The infected were placed with the test-only combat fixture. The campaign suite separately exercises unmodified gameplay with normal inputs.

## Indoor performance

Headless Chromium 141, ANGLE SwiftShader, 1000 × 640 viewport and 0.85 render scale. Each value combines three windows of 24 warmed frames at a fixed camera position while gameplay is paused. The bracket is the range of the three window medians. Texture counts are WebGL allocations reported by Three.js. Exact GPU memory bytes and physical-device performance are unavailable.

| Matched comparison | Location | FPS before → after | Median ms before → after | Window median range before → after | p95 ms before → after | Draws before → after | Textures before → after |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| V0.13.1 to V0.14 detailed | Safehouse | 15.9 → 14.3 | 66.7 → 66.7 | 50–66.7 → 66.6–66.8 | 100 → 133.4 | 194 → 163 | 17 → 29 |
| V0.13.1 to V0.14 detailed | Market | 14.4 → 12.2 | 66.7 → 83.3 | 66.7–66.7 → 66.7–83.3 | 116.6 → 150 | 154 → 94 | 26 → 48 |
| V0.13 to V0.14 detailed | Safehouse | 16.0 → 13.9 | 66.6 → 66.7 | 66.5–66.7 → 66.6–66.7 | 83.4 → 100.1 | 185 → 163 | 18 → 29 |
| V0.13 to V0.14 detailed | Market | 15.1 → 7.4 | 66.7 → 133.3 | 50–66.7 → 133.3–133.3 | 116.7 → 250 | 156 → 94 | 23 → 48 |
| V0.13.1 to V0.14 lightweight | Safehouse | 15.8 → 16.3 | 66.7 → 66.7 | 66.6–66.7 → 50–66.7 | 83.4 → 83.4 | 194 → 196 | 17 → 17 |
| V0.13.1 to V0.14 lightweight | Market | 14.4 → 14.7 | 66.7 → 66.7 | 66.6–66.8 → 66.6–66.7 | 133.3 → 133.4 | 154 → 149 | 26 → 26 |

The detailed models did not recover V0.13 speed. Fewer scene submissions coexist with more skinning and material work. In the matched V0.13.1 run, submitted triangles grew from 13,489 to 24,791 in the safehouse and from 14,260 to 30,998 at the market. The large market swing between two software runs limits the precision of the FPS comparison. No GPU timer isolated every source of that slowdown. The phase-zero snapshot before skinned characters and the latest lightweight run support a smaller static-scene improvement at the market, within the measured frame-time variability. They do not show a broad recovery in frame-time tails. [Measurements and individual samples](review/v014-indoor-benchmark.json)

**Detailed character models** in the pause menu is on by default. Turning it off keeps the photographed scene materials and restores the lighter original character models on every graphics tier. The setting persists through reloads and skips avatar downloads on subsequent starts while off. During a session already loaded shared assets remain resident for switching back. Physical Chromebook and phone profiling remains open.

```sh
npm install --no-audit --no-fund
npx playwright install --with-deps chromium
git worktree add --detach ../ashford-v0131-baseline 1acb07f15dd8f8aa40ae188f9d2b7b3425b25956
node tests/compare-render.mjs ../ashford-v0131-baseline performance --indoors
node tests/compare-render.mjs ../ashford-v0131-baseline performance --indoors --fallback
node tests/compare-render.mjs ../ashford-v0131-baseline performance --actors
```
