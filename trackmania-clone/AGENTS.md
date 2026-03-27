# Trackmania Clone Rules

## Architecture Constraints

-   Keep the codebase modular. Follow the directory structure: `app`, `core`, `physics`, `rendering`, `gameplay`, `track`, `ui`, `data`, `assets`.
-   **No Multiplayer Yet**: Build the foundation (fixed-timestep loops, decoupled state) but do not implement networking code.
-   **No Copyrighted Assets**: Use only original placeholder geometry (e.g., standard Babylon meshes) and simple materials.

## Code Constraints

-   Use strict TypeScript. No `any` types unless absolutely necessary.
-   Follow standard ESLint formatting.
-   Avoid heavy dependencies; build custom solutions for core systems like the car controller.
-   Separate logical game state from rendering state where practical to aid future server-side simulation or ghost replays.

## Rendering Constraints

-   Optimize for low-end hardware.
-   Use `InstancedMesh` or similar Babylon.js techniques when rendering track blocks to minimize draw calls.
-   No heavy post-processing.
-   Shadows should be disabled by default.

## Physics Constraints

-   Use `@babylonjs/havok`.
-   Keep physics updates in a fixed timestep accumulator independent of the rendering frame rate.
-   For the car controller, favor fun arcade gameplay over realistic physical simulations. (A hover-style or sliding box with physics forces is acceptable).

## Track Constraints

-   The horizontal grid size is 10m x 10m.
-   The vertical elevation step is 2m.
-   Track layouts must be loaded from a structured JSON format (`x`, `y`, `z`, `rot`, `type`).
-   New blocks should be registered through the `BlockRegistry`.