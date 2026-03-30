import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { RaceManager, RaceState } from "../../src/gameplay/RaceManager";

describe("RaceManager", () => {
    let raceManager: RaceManager;

    beforeEach(() => {
        // Simple mock for localStorage as Vitest 'node' env doesn't have it
        const store: any = {};
        global.localStorage = {
            getItem: vi.fn((key) => store[key] || null),
            setItem: vi.fn((key, value) => { store[key] = value.toString(); }),
            clear: vi.fn(),
            removeItem: vi.fn(),
            length: 0,
            key: vi.fn()
        } as unknown as Storage;

        raceManager = new RaceManager();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("should start in READY state and transition to RACING", () => {
        raceManager.startRace("track1", 3);
        expect(raceManager.state).toBe(RaceState.READY);

        raceManager.beginRacing();
        expect(raceManager.state).toBe(RaceState.RACING);
    });

    it("should enforce sequential checkpoint progression", () => {
        raceManager.startRace("track1", 3);
        raceManager.beginRacing();

        // Cannot hit CP 1 before CP 0
        expect(raceManager.hitCheckpoint(1)).toBe(false);
        expect(raceManager.currentCheckpointId).toBe(-1);

        // Hit CP 0 successfully
        let now = 1000;
        vi.spyOn(performance, 'now').mockReturnValue(now);
        expect(raceManager.hitCheckpoint(0)).toBe(true);
        expect(raceManager.currentCheckpointId).toBe(0);

        // Cannot hit CP 0 again immediately (debounce/already hit)
        expect(raceManager.hitCheckpoint(0)).toBe(false);

        // Advance mock time to bypass 500ms debounce
        now += 600;
        vi.spyOn(performance, 'now').mockReturnValue(now);

        // Hit CP 1 successfully
        expect(raceManager.hitCheckpoint(1)).toBe(true);
        expect(raceManager.currentCheckpointId).toBe(1);
    });

    it("should prevent hitting finish if not all checkpoints are collected", () => {
        raceManager.startRace("track1", 3); // 3 checkpoints (0, 1, 2)
        raceManager.beginRacing();

        // Hit CP 0
        raceManager.hitCheckpoint(0);

        // Try finishing prematurely
        expect(raceManager.hitFinish()).toBe(false);
        expect(raceManager.state).toBe(RaceState.RACING);
    });

    it("should finish successfully and save best time if all checkpoints are hit", () => {
        raceManager.startRace("track1", 2); // Requires hitting CP 0 and CP 1 before finish
        raceManager.beginRacing();

        let now = 1000;
        vi.spyOn(performance, 'now').mockReturnValue(now);
        expect(raceManager.hitCheckpoint(0)).toBe(true);

        // Advance time for debounce
        now += 600;
        vi.spyOn(performance, 'now').mockReturnValue(now);
        expect(raceManager.hitCheckpoint(1)).toBe(true);

        // Finish the race
        now += 1000;
        vi.spyOn(performance, 'now').mockReturnValue(now);
        expect(raceManager.hitFinish()).toBe(true);

        expect(raceManager.state).toBe(RaceState.FINISHED);

        // Check local storage saving
        expect(localStorage.setItem).toHaveBeenCalledWith("trackmania_clone_best_time_track1", expect.any(String));
        expect(raceManager.bestTime).toBeGreaterThan(0);
    });


    it("should ignore invalid best time in localStorage", () => {
        const store: any = {
            "trackmania_clone_best_time_track1": "invalid_time"
        };
        global.localStorage = {
            getItem: vi.fn((key) => store[key] || null),
            setItem: vi.fn((key, value) => { store[key] = value.toString(); }),
            clear: vi.fn(),
            removeItem: vi.fn(),
            length: 0,
            key: vi.fn()
        } as unknown as Storage;

        const newRaceManager = new RaceManager();
        expect(newRaceManager.bestTime).toBeNull();
    });
    it("should reset completely when startRace is called again", () => {
        raceManager.startRace("track1", 2);
        raceManager.beginRacing();
        raceManager.hitCheckpoint(0);

        // Restart
        raceManager.startRace("track1", 2);
        expect(raceManager.state).toBe(RaceState.READY);
        expect(raceManager.currentCheckpointId).toBe(-1);
    });

    it("should properly format milliseconds into MM:SS.mmm", () => {
        expect(raceManager.formatTime(0)).toBe("00:00.000");
        expect(raceManager.formatTime(500)).toBe("00:00.500");
        expect(raceManager.formatTime(1500)).toBe("00:01.500");
        expect(raceManager.formatTime(60000)).toBe("01:00.000");
        expect(raceManager.formatTime(61500)).toBe("01:01.500");
        expect(raceManager.formatTime(654321)).toBe("10:54.321");
    });
});