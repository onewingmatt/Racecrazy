import { BlockRegistry } from "./BlockRegistry";
import { TrackData, MedalTimes } from "./TrackSchema";
import { Mesh, Vector3, InstancedMesh } from "@babylonjs/core";

export interface ParsedTrack {
    id: string;
    name: string;
    medals?: MedalTimes;
    startPosition: Vector3;
    startRotationDeg: number;
    blocks: InstancedMesh[];
    checkpoints: { mesh: Mesh, id: number }[];
    finishVolume: Mesh | null;
}

interface GridCell {
    type: string;
    y: number; // The base height of the block
    rot: number; // Important for ramps
}

export class TrackParser {
    constructor(private registry: BlockRegistry) {}

    public parse(data: TrackData): ParsedTrack {
        const parsed: ParsedTrack = {
            id: data.id,
            name: data.name,
            medals: data.medals,
            startPosition: new Vector3(0, 10, 0), // Fallback
            startRotationDeg: 0,
            blocks: [],
            checkpoints: [],
            finishVolume: null
        };

        // 1. Build a spatial map to query neighbors
        const map = new Map<string, GridCell>();
        for (const b of data.blocks) {
            map.set(`${b.x},${b.z}`, { type: b.type, y: b.y, rot: b.rot });
        }

        let cpCount = 0;

        // 2. Iterate and spawn blocks + intelligent walls
        for (const b of data.blocks) {
            const { type, x, y, z, rot } = b;

            // Visual + Collision block (floor only now)
            const blockMesh = this.registry.createInstance(type, x, y, z, rot);
            parsed.blocks.push(blockMesh);

            // Special logic for specific blocks
            if (type === "start") {
                parsed.startPosition = new Vector3(
                    x * BlockRegistry.GRID_SIZE,
                    y * BlockRegistry.HEIGHT_STEP + 1, // Slightly above ground
                    z * BlockRegistry.GRID_SIZE
                );
                parsed.startRotationDeg = rot;
            } else if (type === "checkpoint") {
                const vol = this.registry.createCheckpointVolume(x, y, z, rot);
                parsed.checkpoints.push({ mesh: vol, id: cpCount++ });
            } else if (type === "finish") {
                const vol = this.registry.createCheckpointVolume(x, y, z, rot);
                parsed.finishVolume = vol;
            }

            // 3. Generate Borders for exposed edges
            // Normalize rot to 0, 90, 180, 270 (handles negative and wrapped degrees)
            const normRot = ((rot % 360) + 360) % 360;
            const rIdx = Math.round(normRot / 90) % 4;

            // Map local directions to world grid offsets
            const dirMap = this.getDirectionMap(rIdx);

            // Evaluate edges
            this.evaluateEdge(x, y, z, rot, "forward", dirMap["forward"], type, map);
            this.evaluateEdge(x, y, z, rot, "backward", dirMap["backward"], type, map);
            this.evaluateEdge(x, y, z, rot, "left", dirMap["left"], type, map);
            this.evaluateEdge(x, y, z, rot, "right", dirMap["right"], type, map);
        }

        return parsed;
    }

    /**
     * Determines the world offset (+x, -x, +z, -z) for the local directions of a block rotated by `rot`.
     */
    private getDirectionMap(rIdx: number): { [key: string]: { dx: number, dz: number } } {
        // Array order: 0 deg (+Z forward), 90 deg (+X forward), 180 deg (-Z forward), 270 deg (-X forward)
        const dirs = [
            { dx: 0, dz: 1 },  // +Z
            { dx: 1, dz: 0 },  // +X
            { dx: 0, dz: -1 }, // -Z
            { dx: -1, dz: 0 }  // -X
        ];

        return {
            "forward": dirs[rIdx],
            "right": dirs[(rIdx + 1) % 4],
            "backward": dirs[(rIdx + 2) % 4],
            "left": dirs[(rIdx + 3) % 4],
        };
    }

    /**
     * Checks if a neighbor block exists and seamlessly connects to the specified local edge.
     * If it does not, a wall instance is generated.
     */
    private evaluateEdge(x: number, y: number, z: number, blockRot: number, localEdge: string, worldDir: { dx: number, dz: number }, myType: string, map: Map<string, GridCell>): void {
        const nx = x + worldDir.dx;
        const nz = z + worldDir.dz;
        const neighbor = map.get(`${nx},${nz}`);

        let isExposed = true;

        if (neighbor) {
            const myMeta = BlockRegistry.blockMetadata[myType] || BlockRegistry.blockMetadata["straight"];
            let myEdgeY = y;
            if (myMeta.category === "ramp" && localEdge === "forward") {
                myEdgeY = y + myMeta.elevationChange;
            }

            const neighborMeta = BlockRegistry.blockMetadata[neighbor.type] || BlockRegistry.blockMetadata["straight"];
            let neighborEdgeY = neighbor.y;

            if (neighborMeta.category === "ramp") {
                const nNormRot = ((neighbor.rot % 360) + 360) % 360;
                const nIdx = Math.round(nNormRot / 90) % 4;
                const nDirs = this.getDirectionMap(nIdx);

                if (nDirs["forward"].dx === -worldDir.dx && nDirs["forward"].dz === -worldDir.dz) {
                    neighborEdgeY = neighbor.y + neighborMeta.elevationChange;
                }
            }

            // Using a tiny epsilon because elevation changes might be fractional (e.g. 0.5)
            if (Math.abs(myEdgeY - neighborEdgeY) < 0.01) {
                isExposed = false;
            }
        }

        if (isExposed) {
            this.registry.createWallInstance(x, y, z, blockRot, localEdge, map.get(`${x},${z}`)?.type || "straight");
        }
    }
}
