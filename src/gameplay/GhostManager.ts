import { GhostRunData, PlayerFrameSnapshot } from "./Snapshot";

export interface PlaybackState {
    frameA: PlayerFrameSnapshot | null;
    frameB: PlayerFrameSnapshot | null;
    /** The interpolation factor between frameA and frameB (0.0 to 1.0) */
    alpha: number;
    isFinished: boolean;
}

export class GhostManager {
    private currentGhost: GhostRunData | null = null;

    // Performance cache: store the index of the last frame searched
    // Since time goes forward sequentially 99% of the time, we don't need to loop the whole array.
    private lastFrameIndex: number = 0;

    /**
     * Serializes a valid run and saves it to local storage as the new local best ghost.
     */
    public saveGhost(trackName: string, totalTimeMs: number, frames: PlayerFrameSnapshot[]): void {
        const runData: GhostRunData = {
            trackName,
            totalTimeMs,
            frames
        };

        try {
            // Overwrites any previous best ghost
            const serialized = JSON.stringify(runData);
            localStorage.setItem(`trackmania_clone_ghost_${trackName}`, serialized);
            this.currentGhost = runData;
            this.resetPlayback();
            console.log(`Ghost saved with ${frames.length} frames.`);
        } catch (e) {
            console.warn("Failed to save ghost data to localStorage.", e);
        }
    }

    /**
     * Loads the best local ghost for a specific track, if one exists.
     */
    public loadGhost(trackName: string): boolean {
        try {
            const raw = localStorage.getItem(`trackmania_clone_ghost_${trackName}`);
            if (raw) {
                const data: GhostRunData = JSON.parse(raw);
                if (data && data.frames && data.frames.length > 0) {
                    this.currentGhost = data;
                    this.resetPlayback();
                    return true;
                }
            }
        } catch (e) {
            console.warn("Failed to parse ghost data from localStorage.", e);
        }

        this.currentGhost = null;
        return false;
    }

    public hasGhost(): boolean {
        return this.currentGhost !== null;
    }

    public resetPlayback(): void {
        this.lastFrameIndex = 0;
    }

    /**
     * Determines which two frames surround the given playback time,
     * and calculates the interpolation alpha for smooth replay.
     *
     * @param raceTimeMs The current ongoing time of the active race in ms.
     * @returns A PlaybackState struct with interpolation data.
     */
    public getPlaybackFrames(raceTimeMs: number): PlaybackState {
        if (!this.currentGhost || this.currentGhost.frames.length === 0) {
            return { frameA: null, frameB: null, alpha: 0, isFinished: true };
        }

        const frames = this.currentGhost.frames;

        // Handle pre-race or start
        if (raceTimeMs <= frames[0].timestampMs) {
            return { frameA: frames[0], frameB: frames[0], alpha: 0, isFinished: false };
        }

        // Handle end of ghost (ghost finished)
        const finalFrame = frames[frames.length - 1];
        if (raceTimeMs >= finalFrame.timestampMs) {
            return { frameA: finalFrame, frameB: finalFrame, alpha: 1, isFinished: true };
        }

        // Search for bounding frames (O(1) amortized if sequential)
        for (let i = this.lastFrameIndex; i < frames.length - 1; i++) {
            const frameA = frames[i];
            const frameB = frames[i + 1];

            if (raceTimeMs >= frameA.timestampMs && raceTimeMs < frameB.timestampMs) {
                // Found our bounds! Calculate how far between them we are.
                this.lastFrameIndex = i;

                const timeDiff = frameB.timestampMs - frameA.timestampMs;
                const timePassed = raceTimeMs - frameA.timestampMs;

                const alpha = timeDiff > 0 ? (timePassed / timeDiff) : 0;

                return { frameA, frameB, alpha, isFinished: false };
            }
        }

        // Failsafe: if we wrapped around or seeked backward unexpectedly (e.g. restart without resetPlayback)
        // just restart search from 0. In practice, `resetPlayback()` handles restarts.
        this.lastFrameIndex = 0;
        return this.getPlaybackFrames(raceTimeMs);
    }
}