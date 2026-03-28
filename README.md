# Trackmania Clone

A browser-based 3D prototype of a Trackmania-style arcade racing game.

## Features

- **Babylon.js & Havok Physics**: A robust foundation for high-performance 3D and physics.
- **Arcade Handling**: Simple, fun, and responsive vehicle controller prioritizing gameplay over realism.
- **Modular Tracks**: Tracks are built from reusable blocks (10x10m grids, 2m elevation steps).
- **JSON Track Data**: Easily extensible JSON format for track definition.
- **Fixed-Timestep Gameplay Loop**: Ensures deterministic physics behavior, setting the stage for future multiplayer and ghosts.
- **Local Storage Best Times**: Keeps track of your best runs locally.
- **Checkpoints & Finish Lines**: Core racing systems.

## Getting Started

1.  `npm install`
2.  `npm run dev`

## Commands

-   `npm run dev`: Start the development server.
-   `npm run build`: Build for production.
-   `npm run preview`: Preview the production build locally.
-   `npm run test`: Run unit tests via Vitest.
-   `npm run typecheck`: Run TypeScript compiler to check for type errors.
-   `npm run lint`: Run ESLint.

## Architecture & Code Organization

The codebase is organized into modular domains:

-   **`src/app/`**: Core application entry point and bootstrapping.
-   **`src/core/`**: Game loop, fixed timestep accumulator, input management.
-   **`src/physics/`**: Physics engine initialization and custom car controller physics.
-   **`src/rendering/`**: Scene setup, lighting, camera control, and mesh instancing.
-   **`src/gameplay/`**: Race manager, checkpoint logic, timers, and car state.
-   **`src/track/`**: Block registry, track parser, and block instantiation.
-   **`src/ui/`**: HTML/CSS overlays for HUD (Speed, Timer, Best Time).
-   **`src/data/`**: JSON files containing track layouts.

## Roadmap (Next Steps)

1.  **Ghost Recording/Replay**: Serialize car transforms at fixed intervals and replay them using the fixed-timestep architecture.
2.  **Medals**: Add Author, Gold, Silver, and Bronze time targets to the track JSON and display them in UI.
3.  **Local & Remote Leaderboards**: Integrate a lightweight backend to store best times globally.
4.  **In-Browser Track Editor**: Create a UI to place blocks visually and export the JSON.
5.  **Multiplayer Ghost Sync**: Send compressed input or state snapshots to a relay server to see other players in real-time.
## Developer Notes

**Track Selection:**
Currently, the track layout is hardcoded to load from `src/data/track.json`. To test the newly added "The Long Run" track (which features multiple checkpoints, ramps, and turns), simply run the game using `npm run dev`. To build additional tracks, replace or modify the `blocks` array in `track.json` following the established 10x10m grid schema.
