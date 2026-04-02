import { BlockRegistry } from "./BlockRegistry";
import { TrackData, MedalTimes } from "./TrackSchema";
import { Mesh, Vector3, InstancedMesh } from "@babylonjs/core";

export interface BoostPadData {
    position: Vector3;
    forwardVec: Vector3;
}

export interface ParsedTrack {
    id: string;
    name: string;
    medals?: MedalTimes;
    startPosition: Vector3;
    startRotationDeg: number;
    blocks: InstancedMesh[];
    checkpoints: { mesh: Mesh, id: number }[];
    finishVolume: Mesh | null;
    boostPads: BoostPadData[];
}

interface GridCell {
    type: string;
    y: number;
    rot: number;
}

export class TrackParser {
    constructor(private registry: BlockRegistry) {}

    public parse(data: TrackData): ParsedTrack {
        const parsed: ParsedTrack = {
            id: data.id,
            name: data.name,
            medals: data.medals,
            startPosition: new Vector3(0, 10, 0),
            startRotationDeg: 0,
            blocks: [],
            checkpoints: [],
            finishVolume: null,
            boostPads: [],
        };

        const map = new Map<string, GridCell>();
        for (const b of data.blocks) {
            map.set(`${b.x},${b.z}`, { type: b.type, y: b.y, rot: b.rot });
        }

        let cpCount = 0;

        for (const b of data.blocks) {
            const { type, x, y, z, rot } = b;

            const blockMesh = this.registry.createInstance(type, x, y, z, rot);
            parsed.blocks.push(blockMesh);

            if (type === "start") {
                parsed.startPosition = new Vector3(
                    x * BlockRegistry.GRID_SIZE,
                    y * BlockRegistry.HEIGHT_STEP + 1,
                    z * BlockRegistry.GRID_SIZE
                );
                parsed.startRotationDeg = rot;
            } else if (type === "checkpoint") {
                const vol = this.registry.createCheckpointVolume(x, y, z, rot);
                parsed.checkpoints.push({ mesh: vol, id: cpCount++ });
            } else if (type === "finish") {
                const vol = this.registry.createCheckpointVolume(x, y, z, rot);
                parsed.finishVolume = vol;
            } else if (type === "boost") {
                const s = BlockRegistry.GRID_SIZE;
                this.registry.createBoostInstance(x, y, z, rot);
                const rad = rot * (Math.PI / 180);
                const boostForward = new Vector3(Math.sin(rad), 0, Math.cos(rad));
                parsed.boostPads.push({
                    position: new Vector3(x * s, y * BlockRegistry.HEIGHT_STEP + 0.2, z * s),
                    forwardVec: boostForward,
                });
            }

            const normRot = ((rot % 360) + 360) % 360;
            const rIdx = Math.round(normRot / 90) % 4;
            const isRamp = type === "ramp";
            const dirMap = this.getDirectionMap(rIdx);

            this.evaluateEdge(x, y, z, rot, "forward", dirMap["forward"], isRamp, map);
            this.evaluateEdge(x, y, z, rot, "backward", dirMap["backward"], isRamp, map);
            this.evaluateEdge(x, y, z, rot, "left", dirMap["left"], isRamp, map);
            this.evaluateEdge(x, y, z, rot, "right", dirMap["right"], isRamp, map);
        }

        return parsed;
    }

    private getDirectionMap(rIdx: number): { [key: string]: { dx: number, dz: number } } {
        const dirs = [
            { dx: 0, dz: 1 },
            { dx: 1, dz: 0 },
            { dx: 0, dz: -1 },
            { dx: -1, dz: 0 }
        ];

        return {
            "forward": dirs[rIdx],
            "right": dirs[(rIdx + 1) % 4],
            "backward": dirs[(rIdx + 2) % 4],
            "left": dirs[(rIdx + 3) % 4],
        };
    }

    private evaluateEdge(x: number, y: number, z: number, blockRot: number, localEdge: string, worldDir: { dx: number, dz: number }, isRamp: boolean, map: Map<string, GridCell>): void {
        const nx = x + worldDir.dx;
        const nz = z + worldDir.dz;
        const neighbor = map.get(`${nx},${nz}`);

        let isExposed = true;
        const myType = map.get(`${x},${z}`)?.type || "straight";

        if (myType === "turn" && (localEdge === "forward" || localEdge === "left")) {
            isExposed = true;
        } else if (neighbor) {
            let myEdgeY = y;
            if (isRamp && localEdge === "forward") myEdgeY = y + 1;

            let neighborEdgeY = neighbor.y;
            const neighborIsRamp = neighbor.type === "ramp";
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
                if (nLocalEdgeTouchingMe === "forward") {
                    neighborEdgeY = neighbor.y + 1;
                }
            }

            if (myEdgeY === neighborEdgeY && !hitClosedNeighborTurn) {
                isExposed = false;
            }
        }

        if (isExposed) {
            this.registry.createWallInstance(x, y, z, blockRot, localEdge, myType);
        }
    }
}
