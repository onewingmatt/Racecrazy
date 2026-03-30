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

            const isRamp = type === "ramp";

            // Map local directions to world grid offsets
            const dirMap = this.getDirectionMap(rIdx);

            // Evaluate edges
            this.evaluateEdge(x, y, z, rot, "forward", dirMap["forward"], isRamp, map);
            this.evaluateEdge(x, y, z, rot, "backward", dirMap["backward"], isRamp, map);
            this.evaluateEdge(x, y, z, rot, "left", dirMap["left"], isRamp, map);
            this.evaluateEdge(x, y, z, rot, "right", dirMap["right"], isRamp, map);
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
    private evaluateEdge(x: number, y: number, z: number, blockRot: number, localEdge: string, worldDir: { dx: number, dz: number }, isRamp: boolean, map: Map<string, GridCell>): void {
        const nx = x + worldDir.dx;
        const nz = z + worldDir.dz;
        const neighbor = map.get(`${nx},${nz}`);

        let isExposed = true;
        const myType = map.get(`${x},${z}`)?.type || "straight";

        // If this is a turn block, it is ONLY open on its "backward" (-Z) and "right" (+X) local edges.
        // If we are checking "forward" or "left", they are inherently closed walls by the turn geometry itself,
        // regardless of whether there is a neighbor or not.
        if (myType === "turn" && (localEdge === "forward" || localEdge === "left")) {
            isExposed = true; // Always spawn the curve walls on these sides
        } else if (neighbor) {
            // Standard check if they connect smoothly on the Y axis
            let myEdgeY = y;
            if (isRamp && localEdge === "forward") myEdgeY = y + 1; // Our ramps go up 1 height step (2m)

            let neighborEdgeY = neighbor.y;
            const neighborIsRamp = neighbor.type === "ramp";

            // If neighbor is a turn, we only connect smoothly if we hit their "backward" or "right" edge.
            // But for simplicity, we assume if they are at the same Y, they connect, UNLESS we hit their closed side.
            // Let's calculate the local edge of the neighbor that is touching us.
            const nNormRot = ((neighbor.rot % 360) + 360) % 360;
            const nIdx = Math.round(nNormRot / 90) % 4;
            const nDirs = this.getDirectionMap(nIdx);

            let nLocalEdgeTouchingMe = "";
            if (nDirs["forward"].dx === -worldDir.dx && nDirs["forward"].dz === -worldDir.dz) nLocalEdgeTouchingMe = "forward";
            else if (nDirs["backward"].dx === -worldDir.dx && nDirs["backward"].dz === -worldDir.dz) nLocalEdgeTouchingMe = "backward";
            else if (nDirs["left"].dx === -worldDir.dx && nDirs["left"].dz === -worldDir.dz) nLocalEdgeTouchingMe = "left";
            else if (nDirs["right"].dx === -worldDir.dx && nDirs["right"].dz === -worldDir.dz) nLocalEdgeTouchingMe = "right";

            let hitClosedNeighborTurn = false;
            if (neighbor.type === "turn" && (nLocalEdgeTouchingMe === "forward" || nLocalEdgeTouchingMe === "left")) {
                hitClosedNeighborTurn = true;
            } else if (neighborIsRamp) {
                // If neighbor is a ramp, figure out if the edge touching me is its high edge or low edge
                if (nLocalEdgeTouchingMe === "forward") {
                    neighborEdgeY = neighbor.y + 1;
                }
            }

            // If heights align and we aren't colliding into the closed side of a neighbor's turn wall
            if (myEdgeY === neighborEdgeY && !hitClosedNeighborTurn) {
                isExposed = false;
            }
        }

        if (isExposed) {
            this.registry.createWallInstance(x, y, z, blockRot, localEdge, myType);
        }
    }
}
