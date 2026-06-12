# Proper Clone Roadmap

This project already has the core driving loop, physics, and track-block scaffolding. The gap now is track identity: the courses need to feel authored, readable, and progressively more like classic Trackmania Nations routes.

## Design Goals

- Each track should teach one main skill.
- Every special element needs setup, commitment, and recovery.
- Medal targets should reflect the route, not just the number of blocks.
- The late-game tracks should feel iconic, not just longer.

## Immediate Priorities

### 1. Finish the signature tracks

- Rework `09_spiral.json` into a real spiral/helix course with a clear vertical rhythm.
- Keep improving `13_wallride.json` until it has sustained wall sections, not just short curved fragments.
- Polish `10_finale.json` so it acts like a true final exam: faster, more technical, and more memorable.

### 2. Rebalance the full track set

- Audit medal times across all tracks.
- Make early tracks short and readable.
- Make mid-tier tracks emphasize one mechanic at a time.
- Make late tracks combine mechanics instead of introducing them all at once.

### 3. Add track identity metadata

- Add optional track metadata such as archetype, intended lesson, and difficulty tier.
- Use that metadata to keep future content aligned with a clear design intent.
- Treat this as authoring support, not player-facing complexity.

## Track Archetypes To Aim For

- Starter: basic steering, speed upkeep, and checkpoint rhythm.
- Technical: tighter turns, braking, and clean exits.
- Speed: longer straight-line commitment and boost timing.
- Jump: line-up, landing stability, and pace retention.
- Spiral: continuous elevation change with a clear helix structure.
- Wallride: sustained adhesion, entry transitions, and clean exits.
- Finale: mixed skills with a strong final sequence.

## What Needs To Happen Next

1. Rebuild the weakest signature track first, starting with the spiral or wallride.
2. Rebalance medals after the route shape is locked.
3. Add track metadata so future routes can be designed against a consistent archetype.
4. Use those archetypes to rework the rest of the roster.
5. Only then spend time on extra systems like track editor, replay polish, or leaderboards.

## Long-Term Clone Work

- Ghost replay and better run comparison.
- Track editor with export/import support.
- Better progression presentation in the UI.
- More authored tracks with clear setpieces and difficulty ramps.

## Practical Rule

If a track feels like a test case, it should be redesigned.
If a track feels like a lesson, it is probably on the right path.
