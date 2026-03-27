import { BlockRegistry } from "./BlockRegistry";
import { TrackData } from "./TrackSchema";
import { Mesh, Vector3, InstancedMesh } from "@babylonjs/core";

export interface ParsedTrack {
    name: string;
    startPosition: Vector3;
    startRotationDeg: number;
    blocks: InstancedMesh[];
    checkpoints: { mesh: Mesh, id: number }[];
    finishVolume: Mesh | null;
}

export class TrackParser {
    constructor(private registry: BlockRegistry) {}

    public parse(data: TrackData): ParsedTrack {
        const parsed: ParsedTrack = {
            name: data.name,
            startPosition: new Vector3(0, 10, 0), // Fallback
            startRotationDeg: 0,
            blocks: [],
            checkpoints: [],
            finishVolume: null
        };

        let cpCount = 0;

        for (const blockData of data.blocks) {
            const { type, x, y, z, rot } = blockData;

            // Visual + Collision block
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
        }

        return parsed;
    }
}