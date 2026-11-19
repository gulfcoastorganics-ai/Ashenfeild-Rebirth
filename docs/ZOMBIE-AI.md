# Infected behavior

Ordinary infected alternate idle and local patrol. Vision samples are staggered
and use a per-archetype range, a broad facing cone and level cover. A noise
event can make an infected pause and investigate. Sprinting, crowbar swings
and shots emit bounded noise events with different ranges. Recent sight of the
player keeps a brief last-known-position search active. When memory and
investigation expire, infected return toward their patrol start.

When direct pursuit is blocked, infected reuse the existing grid pathfinder
with staggered replanning. Nearby infected apply bounded lateral separation and
still resolve solid obstacles against the same collision checks. Attack
telegraphs use existing per-archetype windups. A shared start interval spreads
attack pressure, and attacks recheck distance and solid cover at release.
Visible spitters prefer their ranged attack distance with periodic navigation
around cover. The clinic alarm retains authored pursuit for the ambush and is
independent of ordinary detection memory.

Tests exercise detection state transitions, memory expiry, cover, bounded
separation, normal weapon and dodge rules, and the complete clinic defense.
Steering can spread groups around cover. Planned flank assignments and richer
patrol routes are deferred.
