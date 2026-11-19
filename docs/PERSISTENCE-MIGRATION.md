# Campaign checkpoint and sandbox migration

The game uses the original `ashfordRebirthV01` key. Version 2 keeps the prior
campaign fields at the top level and adds completion, elapsed world time and a
sandbox payload with the seed, claimed site IDs, locker contents, brace level
and encounter records. Graphics, volume and motion preferences retain their
existing independent keys.

The reader accepts the unversioned legacy format and explicit version 1.
Absent legacy sandbox fields start with empty optional state. Known site IDs,
item IDs, integer quantities, levels and encounter positions are checked
independently of the campaign. An unsupported version or unreadable checkpoint
is left in storage and autosaving is disabled for that session. Save migration
runs on the same local origin. Browser storage does not move across origins.

Crafting, searching, locker transfers and barricade upgrades each write their
full result together. Active encounters store living members, positions and hit
points. Animation, attack windup and pathfinding caches rebuild on reload.
Finished or abandoned encounters never respawn in that checkpoint. Death offers
the most recent checkpoint. Finishing the clinic saves victory, and
**Continue Exploring** opens the same world from that checkpoint.
An explicit restart asks before clearing the current local slot.
