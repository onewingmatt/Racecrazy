import { BlockRegistry } from "./BlockRegistry";
import { TrackData, MedalTimes, TrackMetadata } from "./TrackSchema";
import { Mesh, Vector3, InstancedMesh } from "@babylonjs/core";

export interface BoostPadData {
    position: Vector3;
    forwardVec: Vector3;
}

export interface ParsedTrack {
    id: string;
    name: string;
    medals?: MedalTimes;
    metadata?: TrackMetadata;
    startPosition: Vector3;
    startRotationDeg: number;
    blocks: InstancedMesh[];
    checkpoints: { mesh: Mesh, id: number }[];
    finishVolume: Mesh | null;
    boostPads: BoostPadData[];
}



export class TrackParser {
    constructor(private registry: BlockRegistry) {}

    public parse(data: TrackData): ParsedTrack {
        const parsed: ParsedTrack = {
            id: data.id,
            name: data.name,
            medals: data.medals,
            metadata: data.metadata,
            startPosition: new Vector3(0, 10, 0),
            startRotationDeg: 0,
            blocks: [],
            checkpoints: [],
            finishVolume: null,
            boostPads: [],
        };


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

        }

        return parsed;
    }

}
