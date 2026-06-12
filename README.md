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

The current design backlog is tracked in [plan.md](plan.md).

Top priorities:

1.  Rework the signature tracks so they feel like authored Trackmania Nations routes rather than test layouts.
2.  Rebalance medal targets after the route shapes are finalized.
3.  Add lightweight track metadata to support archetypes, intended lessons, and difficulty tiers.
4.  Build ghosts, track editing, and leaderboards after the track identity is solid.
## Developer Notes

**Track Selection:**
Tracks are loaded from `src/data/TrackList.ts` and the JSON files in `src/data/tracks/`.
To add or adjust a course, edit the relevant track JSON and then update `TrackList.ts` if you add a new file.
