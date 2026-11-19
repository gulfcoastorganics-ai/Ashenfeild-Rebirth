# Ashford Rebirth V0.16 production report

This change starts from V0.15.2 commit
`2320f6d2007e7576c2c6e1af5007c35d24058600` on PR #15. The optional sandbox
loop uses the existing Ashford world, player pack, infected, graphics presets
and campaign. The pass uses the same external assets, libraries and hosting.

| Scope | Status | Implementation and verification |
| --- | --- | --- |
| Performance profiling and stabilization | Partial | Camera sweep broad phase, fewer allocations inside movement and enemy decisions, relevance cutoff and deeper room culling. See [performance data](V016-PERFORMANCE.md) for measured GPU and CPU proxies and remaining slow frames. |
| Searchable containers and item registry | Complete | Eight fixed search sites use a shared interaction, stable IDs, weighted seeded loot, stack limits and finite claims. [Items and economy](CRAFTING-AND-LOOT.md) |
| Crafting and resource management | Complete | Craft bandages, first-aid kits and usable door braces. Failure leaves both inputs and output untouched. Existing food, water, health and stamina continue to apply. |
| Save migration and recovery | Complete | Existing saves migrate on the same key. Transactions store pack, loot, locker and shelter together. Completed checkpoints allow free roam. [Migration and limitations](PERSISTENCE-MIGRATION.md) |
| Safehouse storage and barricading | Complete | The locker transfers one unit at a time. At a fixed doorway, the first brace keeps infected from crossing and the second adds spit cover. The player retains a clear passage. |
| Dynamic encounters | Complete | Three regions can schedule one optional encounter each. The director limits the additional group to two and saves active actors and outcomes. The original clinic wave suspends optional encounters. |
| Interface and input | Complete | Search prompts and acquisition feedback, touch menus and material counts, accessible pack buttons, storage, shelter status and keyboard plus standard controller navigation. Chromium validates keyboard and emulated touch. Physical controllers remain unverified. |
| Expanded ambient effects and animations | Deferred | New parts for maintenance, weather, bespoke interaction animation, large groups, container replenishment and bonus discoveries remain outside the implemented loop. Mechanical parts have no recipe in this slice. |
| Real-device performance | Deferred | A physical Chromebook, Android phone and iPhone were unavailable. The matching benchmarks use SwiftShader. |

## Reproduce the playable loop

Start a campaign or continue an existing checkpoint. Walk toward the small
amber indicator at the safehouse footlocker on the east side of the room.
Press **E**, or **Use** on touch, then choose **Take supplies**. Travel along
the street to Last Stop Market and search its lower shelf. In the existing
pack, choose **Craft** and make a **Door brace kit**. Return to the safehouse,
use the gate from the interior and install the kit. Take a step back to see
the frame update. Use the locker near the southwest bed to deposit a material,
reload, and open it again.

[Screenshots from the playable loop](review/v016-survival-loop.jpg)

The starting footlocker and market shelf always supply the first brace recipe.
The workshop crate and roadside case supply the rest for a second brace.
Campaign items have their own interactions. The search system gives these
objectives priority when both are within reach.

## Verification and capture

Run `npm run check`, `npm run test:campaign` and `npm run test:sandbox`
after installing the existing Playwright dependency and Chromium. The
campaign suite plays the story with normal combat rules. The sandbox browser
fixture starts from a progressed checkpoint, walks the safehouse–market route,
performs real menu transactions and reloads after crafting and reinforcement.
It also exercises a naturally scheduled two-infected encounter and a narrow
touch viewport. Local captures and the sample encounter timing profile appear
in `artifacts/v016-*`. For matched frame-timing commands, see the
[benchmark instructions](V016-PERFORMANCE.md).
