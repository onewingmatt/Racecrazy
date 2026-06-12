import { describe, it, expect, vi } from "vitest";
import { TrackParser } from "../../src/track/TrackParser";
import { BlockRegistry } from "../../src/track/BlockRegistry";
import { TrackData } from "../../src/track/TrackSchema";

describe("TrackParser", () => {
    it("should parse a track and create blocks via the registry", () => {
        const mockRegistry = {
            createInstance: vi.fn().mockReturnValue({}),
            createCheckpointVolume: vi.fn().mockReturnValue({}),
            GRID_SIZE: 10,
            HEIGHT_STEP: 2
        } as unknown as BlockRegistry;

        // Ensure static properties are accessible as we use them in TrackParser
        BlockRegistry.GRID_SIZE = 10;
        BlockRegistry.HEIGHT_STEP = 2;

        const parser = new TrackParser(mockRegistry);

        const data: TrackData = {
            name: "Test Track",
            blocks: [
                { type: "start", x: 0, y: 0, z: 0, rot: 0 },
                { type: "straight", x: 0, y: 0, z: 1, rot: 90 },
                { type: "checkpoint", x: 0, y: 0, z: 2, rot: 0 },
                { type: "finish", x: 0, y: 0, z: 3, rot: 0 }
            ]
        };

        const parsed = parser.parse(data);

        expect(parsed.name).toBe("Test Track");

        // Start block
        expect(mockRegistry.createInstance).toHaveBeenCalledWith("start", 0, 0, 0, 0);
        // Start position offset by 1 for Y
        expect(parsed.startPosition.y).toBe(1);

        // Checkpoint
        expect(mockRegistry.createCheckpointVolume).toHaveBeenCalledWith(0, 0, 2, 0);
        expect(parsed.checkpoints.length).toBe(1);

        // Finish
        expect(mockRegistry.createCheckpointVolume).toHaveBeenCalledWith(0, 0, 3, 0);
        expect(parsed.finishVolume).toBeDefined();
        expect(parsed.blocks.length).toBe(4);
    });
});