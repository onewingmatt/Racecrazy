# QA Test Report: Z-Fighting / Flashing on Track Assets

**Game Title:** Trackmania-Clone (Local Build)
**Platform:** Web (PC/Mobile Cross-Platform via Vite/Babylon.js)
**Testing Scope:** General checks across existing built-in tracks, focusing on geometric connections (ramps, straight walls, turn seams).

---

### Glitch Description
A rapid, aggressive visual flashing/flickering effect occurs uniformly along the geometric seams where distinct track elements connect. Specifically:
1. **Wall Ends & Pillars:** The end caps of adjacent straight gray walls (`flatWallRail`) perfectly overlap with the dark trim pillars (`postZ1`/`postZ2`), causing severe texture flickering as the camera moves.
2. **Ramp Hinges:** The collision joints where a sloped wall (`slopedWallRail`) connects to a flat track wall produce identical flickering at the base hinge point.

### Location & Repro Steps
**Location:** Any track containing adjacent wall pieces or ramps (e.g., `05_jump`, `08_long_jump`, `10_finale`).
**Steps to Reproduce:**
1. Load any track featuring consecutive straight track blocks or ramps.
2. Drive the vehicle near the left or right guardrails.
3. Observe the dark gray vertical pillars embedded in the light gray walls. Notice rapid gray/dark-gray flickering across the faces.
4. Drive up a ramp and observe the base seam where the flat wall terminates and the ramp wall begins. Flashing occurs dynamically as the camera angle shifts.

### Frequency & Severity
* **Frequency:** 100% reproducible. The effect is constant as long as the player is in motion, as dynamic camera framing constantly shifts the depth buffer's precision along coplanar geometry.
* **Severity:** Medium (Distracting). The flashing does not crash the game or break physics collisions, but it looks unpolished, visually noisy, and actively distracts the player during high-speed gameplay.

### Suspected Cause
**Z-Fighting (Coplanar Geometry).** The Babylon.js mesh generators (`MeshBuilder.CreateBox`) in `BlockRegistry.ts` were strictly assigning perfectly aligned coordinates to different meshes:
* The dark post pillars were the exact same height (`wallHeight: 1.0`) and perfectly nested inside the wall rails without sufficient depth offsets, causing the top faces to fight.
* Adjacent track blocks spawned wall pieces that terminated at exactly `depth: s + 0.1` and `rampDepth + 0.1`, forcing adjacent wall end-caps to overlap at identical World-Space XYZ coordinates, overwhelming the WebGL depth buffer.

### Resolution Implemented
* **Pillars:** Increased pillar height by `0.05` to physically pop them out of the rail mesh, breaking the coplanar top face.
* **Materials:** Applied `zOffset = -1` to the dark `trimMat` material to enforce strict depth-buffer prioritization of the trim over the grey walls.
* **Hinges:** Adjusted the `depth` constraints of flat and sloped walls by microscopic offsets (`0.08`, `0.12`) to prevent identical overlaps at track grid joints.

---
*Report generated via AI QA Verification Script.*
