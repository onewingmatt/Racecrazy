import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { GhostManager } from "../../src/gameplay/GhostManager";
import { PlayerFrameSnapshot } from "../../src/gameplay/Snapshot";

describe("GhostManager", () => {
    let ghostManager: GhostManager;

    beforeEach(() => {
        // Simple mock for localStorage
        const store: any = {};
        global.localStorage = {
            getItem: vi.fn((key) => store[key] || null),
            setItem: vi.fn((key, value) => { store[key] = value.toString(); }),
            clear: vi.fn(),
            removeItem: vi.fn(),
            length: 0,
            key: vi.fn()
        } as unknown as Storage;

        ghostManager = new GhostManager();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    const createDummyFrame = (time: number): PlayerFrameSnapshot => ({
        timestampMs: time,
        car: {
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0, w: 1 },
            linearVelocity: { x: 0, y: 0, z: 0 },
            angularVelocity: { x: 0, y: 0, z: 0 }
        },
        progression: {
            state: "RACING",
            currentCheckpointId: 0,
            totalCheckpoints: 3,
            raceTimeMs: time
        }
    });

    it("should return null frames if no ghost is loaded", () => {
        const state = ghostManager.getPlaybackFrames(100);
        expect(state.frameA).toBeNull();
        expect(state.frameB).toBeNull();
        expect(state.alpha).toBe(0);
        expect(state.isFinished).toBe(true);
    });

    it("should successfully save and load a ghost", () => {
        const frames = [createDummyFrame(0), createDummyFrame(100)];
        ghostManager.saveGhost("Track1", 100, frames);

        expect(localStorage.setItem).toHaveBeenCalled();

        // Create new instance to test loading
        const newManager = new GhostManager();
        const success = newManager.loadGhost("Track1");

        expect(success).toBe(true);
        expect(newManager.hasGhost()).toBe(true);
    });

    it("should calculate exact interpolation alphas between bounding frames", () => {
        // Frame at 0ms, 100ms, 200ms
        const frames = [createDummyFrame(0), createDummyFrame(100), createDummyFrame(200)];
        ghostManager.saveGhost("Track1", 200, frames);

        // At 50ms, it should be exactly between frame[0] and frame[1]
        let state = ghostManager.getPlaybackFrames(50);
        expect(state.frameA?.timestampMs).toBe(0);
        expect(state.frameB?.timestampMs).toBe(100);
        expect(state.alpha).toBeCloseTo(0.5);

        // At 125ms, it should be 25% between frame[1] and frame[2]
        state = ghostManager.getPlaybackFrames(125);
        expect(state.frameA?.timestampMs).toBe(100);
        expect(state.frameB?.timestampMs).toBe(200);
        expect(state.alpha).toBeCloseTo(0.25);

        // Exactly on a frame
        state = ghostManager.getPlaybackFrames(100);
        expect(state.frameA?.timestampMs).toBe(100);
        expect(state.frameB?.timestampMs).toBe(200);
        expect(state.alpha).toBe(0);
    });

    it("should handle times before start and after finish", () => {
        const frames = [createDummyFrame(0), createDummyFrame(100), createDummyFrame(200)];
        ghostManager.saveGhost("Track1", 200, frames);

        // Pre-race (e.g. -50ms)
        let state = ghostManager.getPlaybackFrames(-50);
        expect(state.frameA?.timestampMs).toBe(0);
        expect(state.frameB?.timestampMs).toBe(0);
        expect(state.alpha).toBe(0);
        expect(state.isFinished).toBe(false); // Ghost hasn't started moving

        // Post-finish (e.g. 250ms)
        state = ghostManager.getPlaybackFrames(250);
        expect(state.frameA?.timestampMs).toBe(200);
        expect(state.frameB?.timestampMs).toBe(200);
        expect(state.alpha).toBe(1);
        expect(state.isFinished).toBe(true); // Ghost finished
    });

    it("should recover correctly if playback jumps backward (restarts)", () => {
        const frames = [createDummyFrame(0), createDummyFrame(100), createDummyFrame(200)];
        ghostManager.saveGhost("Track1", 200, frames);

        // Advance to end
        ghostManager.getPlaybackFrames(180);

        // Without explicitly calling resetPlayback, if time goes backward, it should handle it gracefully
        // by resetting internal pointers to 0.
        const state = ghostManager.getPlaybackFrames(10);
        expect(state.frameA?.timestampMs).toBe(0);
        expect(state.frameB?.timestampMs).toBe(100);
        expect(state.alpha).toBeCloseTo(0.1);
    });
});