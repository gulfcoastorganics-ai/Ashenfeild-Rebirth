# Ashford character motion

Gameplay owns positions, collision, health, attacks, projectiles, and timers. `src/character-state.mjs` maps that state to an animation request. `src/characters.mjs` plays the request with a Three.js `AnimationMixer` once per rendered frame, using a roughly 130 ms crossfade between actions. The mixer never advances a collision body. Weapon artwork is parented to the survivor's dedicated `WeaponR` socket. The retained procedural mesh still has its old attachment points for fallback.

| Actor | Motion selection |
| --- | --- |
| Survivor | Idle, aim idle, stride adjusted to measured movement, sprint, turn accents, melee, weapon fire and recoil, forward roll, damage reaction, pickup interaction, dialogue posture, and fall. Walking reaches a jog cadence as movement speed rises. |
| Mara and Dr. Vale | Distinct idle tempo and a looping gesture while their own dialogue is open. The clinic guard uses a restrained idle. |
| Walker | Slow asymmetric slouch walk and an attack whose windup and follow-through share the game strike boundary. |
| Runner | Faster locomotion using a leaner body silhouette. |
| Brute | Slower cadence, heavy silhouette and backward collapse. |
| Spitter | Lean-back preparation, throat swelling and a separate release pose under the existing ranged attack timer. |
| Infected shared | Idle, speed-driven pursuit, windup, strike follow-through, hit, stagger and collapse. |

All five files use 26 matching joint names and the same hierarchy. Bind rotations differ by body, so each target's reusable clip bank combines its rest rotation with the source's local rotation delta. Hip height is adapted to the target proportion. Horizontal hip translations stay on the target's bind position, which keeps movement and hit location on the existing physics root. Roll, recoil, melee, hit and collapse read their display phase from existing game timers. The crowbar's original instant hit, pistol cooldown, infected strike timing, and dodge invulnerability window are unchanged. Standard pause freezes clip time. During dialogue the speaker and player can gesture without advancing the rest of the simulation.

The survivor GLB preloads after the title's first frame. NPCs and enemies use their earlier visible meshes until an approved GLB is ready or if loading fails. Civilians load within 24 game units. Infected share a source mesh and texture bank. Performance animates nearby rigs within 17 units, up to four live infected. Balanced and Quality use larger budgets. Each skinned actor shares a single bone texture across its mesh primitives. On enemy removal the mixer is uncached and the skeleton is disposed. The common geometry, textures and variant materials remain in the scene's bounded asset cache for reuse.

Foot placement is tuned with in-place cycles, floor-normalized character scale, and rate matching. There is no terrain-aware foot IK. The mechanics are intentionally driven from the existing input and combat systems, so roll direction and animation direction can differ during side or backward dodges. Dialogue uses body gestures without lip sync. Source clips include no facial expressions. The spitter uses a shared infected base and a custom throat cue. Proper close-up facial acting, hand grip overrides, more exact foot planting and unique infected heads are still future work.
