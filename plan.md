1. **Change the track width (Grid Size) from 10 to 14.**
   - Modify `src/track/BlockRegistry.ts` to set `public static readonly GRID_SIZE = 14;`.
   - Modifying this static constant will natively scale up the entire track, making the roads 40% wider and all blocks spaced 40% further apart, because `s` is used for all widths/depths in `BlockRegistry`.

2. **Update the turn block to be visually rounded.**
   - In `src/track/BlockRegistry.ts`, change `base_turn` creation to use `MeshBuilder.CreateRibbon` or a rounded mesh, instead of a simple `CreateBox`.
   - Implement the path mapping specifically so it properly lines up with the Grid:
     - Entrance at South (-Z axis): `x` in `[-s/2, s/2]`, `z = -s/2`
     - Exit at East (+X axis): `x = s/2`, `z` in `[-s/2, s/2]`
     - Calculate the arc paths.
   - Adjust `shapeType` logic in `BlockRegistry.ts` -> `createInstance` to handle the turn block physics. Since a ribbon is used, `PhysicsShapeType.CONVEX_HULL` or `MESH` is needed. Wait, a complex mesh is best represented as `PhysicsShapeType.MESH` for accurate physics of curved roads, or we can use CONVEX_HULL if the curve is simple enough. Actually, `MESH` type physics is perfectly accurate for a driving track but sometimes can be tricky if hollow. Let's use `PhysicsShapeType.MESH` for static track instances.

3. **Tune car steering sensitivity at low speeds.**
   - In `src/gameplay/ArcadeCar.ts`, update `DEFAULT_CONFIG`.
   - The user noted: "Turning is still way too sensitive at slow speeds".
   - Current: `lowSpeedSteerRampKmh: 20` and steering relies on:
     ```typescript
     if (currentSpeedKmh < this.config.lowSpeedSteerRampKmh) {
         steerMultiplier = Math.max(0.01, currentSpeedKmh / this.config.lowSpeedSteerRampKmh);
     }
     ```
   - We will increase `lowSpeedSteerRampKmh` from 20 to 60 or 80. This makes the multiplier stay lower for much longer until the car hits higher speeds.
   - We'll also change `baseTurnSpeed` from 3.5 down to 3.0 or 2.8 to generally reduce sensitivity without breaking the high speed handling feel.
