import { NullEngine, Scene, MeshBuilder, Vector3, Mesh } from "@babylonjs/core";
const engine = new NullEngine();
const scene = new Scene(engine);

// Make sure that createWallInstance returning null doesn't cause errors.
// In TrackParser, if wallMesh is null, it should just not attach physics.
// Wait! `TrackParser` doesn't do physics on walls, `BlockRegistry` does.
// Let's check `BlockRegistry.ts` at the end of `createWallInstance`.
