# Scavenging and crafting

| Site | Guaranteed contents |
| --- | --- |
| Safehouse footlocker | 1 wood and 1 cloth |
| Workshop crate | 1 wood and 1 cloth |
| Market lower shelf | 1 wood and 1 scrap |
| Market service box | 1 canned food |
| Roadside tool case | 1 wood and 1 scrap |
| Abandoned sedan trunk | 1 scrap |
| Clinic medical cabinet | 2 antiseptic |
| Ward service tray | 1 bandage |

Each search also rolls one bonus from its location table. The seed and site ID
fix the outcome across reloads. A successful Take Supplies action removes every
item from that site in a single transaction. A full stack rejects the claim
while leaving the site available. Quest supplies and the service pistol still
belong to the original missions.

| Recipe | Ingredients | Use |
| --- | --- | --- |
| Bandage | 1 cloth and 1 antiseptic | Restores up to 40 health |
| First-aid kit | 1 bandage and 2 antiseptic | Restores up to 72 health |
| Door brace kit | 2 wood and 1 scrap | Upgrades the safehouse entry |

The first brace stops infected at the doorway. The second protects against
spit crossing the entry toward the interior. The passage remains usable for
the survivor. Store and take items at the locker near the bed. The locker and
pack have per-item stack limits. Pistol rounds count toward the existing ammo
total. Inventory and crafting use the same transaction planner. See
[`src/sandbox.mjs`](../src/sandbox.mjs) and
[`src/sandbox-ui.mjs`](../src/sandbox-ui.mjs).

On a standard controller, open the pack with the north face button, move
through menu buttons with the D-pad and confirm with the south face button.
The east face button closes an open menu. Touch uses the existing **Pack** and
**Use** buttons. Keyboard uses **I**, **E**, **Tab** and **Escape**.
