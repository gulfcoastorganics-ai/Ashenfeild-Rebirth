# Ashford Rebirth V0.12 production review

Baseline `af96c89` includes the V0.11 realism pass. V0.12 concentrates on the gaps a player encounters from the title screen through the clinic fight.

| Area | V0.11 finding | V0.12 change |
| --- | --- | --- |
| First impression | The title used abstract gradients and always offered Enter Ashford, even when a checkpoint existed. | Original title artwork, a clear opening objective, and Continue Campaign when a checkpoint exists. |
| Sound | Most events played single oscillator tones. Movement and the outdoor environment lacked sound cues. | Distance-triggered footsteps on wood, tile, and asphalt, a wind bed that softens indoors, and layered combat sounds. A saved volume setting includes mute. |
| Combat feel | A melee swing and a pistol shot moved the arm without showing the equipment. Enemy windups were concentrated in torso tilt. | Visible held equipment, strengthened enemy windup poses, shorter effects, and camera recoil that respects the motion setting. |
| Responsiveness | V0.11 submitted distant façade trim and repeated avatar details. HUD values were written every frame. | Lower-detail distant façades in Performance and Balanced modes, batched matching avatar parts, and HUD updates at the minimap cadence. |
| Graphics failure | An unavailable WebGL context left a generic loading failure across the title screen. | The title stays visible, reports the specific graphics requirement, and offers a reload action. |
| Accessibility | Camera movement and sound had no user settings. | Reduced motion follows the device preference by default. The pause screen offers keyboard-accessible volume and camera motion settings. |

The title artwork is promotional art for Ashford. Playable characters and environments use the existing procedural 3D art pipeline. Authored character animation, fully recorded spatial audio, and hardware-specific performance tuning are still open production work.

Regression checks cover the full campaign, keyboard and touch controls, combat, viewport layout, and persisted field settings. Matched software rendering samples provide a comparison under the same Performance preset. Physical Chromebook and phone measurements require the actual devices.
