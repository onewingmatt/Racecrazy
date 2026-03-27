# AGENTS.md

## Project overview
This repository is a web-based 3D arcade racing game prototype inspired by the feel and structure of Trackmania-style gameplay, but implemented with original code and placeholder assets only.

Current priority:
- Build a strong single-player foundation first
- Keep performance good on modest hardware
- Design architecture so multiplayer can be added later without major rewrites

Non-goals for early tasks:
- No backend
- No online multiplayer
- No account system
- No copyrighted assets
- No heavy rendering features by default

## Tech stack
- Vite
- TypeScript
- Babylon.js
- Rapier
- npm
- ESLint
- Vitest if tests are present

## Engineering principles
- Prefer simple, modular, readable code
- Keep dependencies minimal
- Avoid overengineering
- Separate rendering, physics, gameplay, track data, and UI
- Keep feature work incremental and testable
- When task scope is large, propose a phased plan instead of a giant patch

## Performance priorities
- Target modest hardware first
- Favor simple materials and lighting
- Shadows should be off by default
- Avoid heavy post-processing
- Reuse meshes and materials where possible
- Prefer instancing for repeated block geometry
- Use simple colliders whenever possible
- Keep physics stable and deterministic enough for future ghost support

## Folder expectations
Prefer organizing code under:

src/
  app/
  core/
  rendering/
  physics/
  gameplay/
  track/
  ui/
  assets/
  data/

This structure can evolve, but separation of concerns should remain clear.

## Data conventions
- Track layouts should be stored in JSON
- Track blocks should be defined through a registry
- Block placement should be grid-friendly
- Future editor compatibility matters
- Data formats should stay human-readable where practical

## Multiplayer planning
Multiplayer is planned, but not an immediate implementation target.

When making architecture choices:
- Leave clear extension points for remote player snapshots
- Keep race state serializable
- Keep car state structures compatible with future ghost playback
- Avoid tightly coupling gameplay state to rendering objects
- Document likely future integration points for networking

Do not add backend or network code unless explicitly requested.

## Asset rules
- Use only original placeholder geometry, materials, icons, and sounds
- Do not import copyrighted game assets
- Do not recreate branded UI or exact proprietary content

## Commands
Agents should prefer these commands when available:
- npm install
- npm run dev
- npm run build
- npm run typecheck
- npm run lint
- npm run test

## Before finishing a task
- Run build and typecheck
- Run lint if configured
- Run tests if present
- Update README when setup, architecture, or workflows change
- Summarize what was implemented
- Note any assumptions or follow-up work

## Prompting behavior
When given a task:
1. Restate the scope briefly
2. Produce a concise plan
3. Identify assumptions
4. Implement in small coherent changes
5. Verify commands
6. Summarize results and propose next prompts

If a request conflicts with these rules, ask for clarification or explain the tradeoff in the plan.