# Combat and camera

- **Desktop.** Move with WASD, aim with Alt or right-drag, swap shoulder with V,
  dodge with X, swing with Space, fire with F and interact with E.
- **Standard controller.** Left stick moves, right stick looks, LB or L3
  sprints, LT aims, RT fires, RB swings, the south face button dodges, the west
  face button interacts or advances dialogue, and Start toggles pause.
- **Touch.** Use the existing movement pad, swipe the view and use the action
  buttons. Aim tightens briefly after a shot.

The camera sweeps an expanded bounding box around each solid level fixture.
It retracts immediately when obstructed and eases back out. A second sweep
checks the smoothed camera position. A close camera hides the local avatar when
necessary to maintain visibility. Aim and recovery framing apply independently
of the optional sprint bob and impact movement.

The crowbar's brief animation hold affects presentation only. Damage, cooldowns,
ammunition, dodge timing and target resolution continue to use the simulation
clock and existing combat rules. Stagger leans away from the hit. Shot and swing
presentation shares a pool of 56 particles, four tracers, three muzzle flashes
and three strike arcs. Performance and reduced motion lower particle counts.
Particles and transients expire independently of the campaign state. Audio
limits transient voices to 12 and fades the ambience on pause. No temporary
lights or persistent decals are allocated.

The muzzle presentation currently follows the gameplay shot direction and
origin. Socket alignment and foot placement can be refined with higher-fidelity
motion assets. The regression checks cover a safehouse obstruction and
recovery, muted audio, shoulder persistence, effect limits and cleanup, existing
weapon and cover rules, and simulated touch.
