import { MedalTimes } from "../track/TrackSchema";

export enum RaceState {
    READY,
    RACING,
    FINISHED
}

export enum MedalType {
    NONE,
    BRONZE,
    SILVER,
    GOLD,
    AUTHOR
}

export interface CheckpointInfo {
    id: number;
    position: number[];
    rotationDeg: number;
}

export class RaceManager {
    public state: RaceState = RaceState.READY;
    public startTime: number = 0;
    public raceTime: number = 0;
    public bestTime: number | null = null;
    public currentTrackId: string | null = null;
    public currentMedals: MedalTimes | null = null;

    // Checkpoints are 0-indexed. -1 means no checkpoints hit yet.
    public currentCheckpointId: number = -1;
    public maxCheckpoints: number = 0;

    // Store checkpoint and start positions for respawn
    public checkpointPositions: { id: number; position: number[]; rotationDeg: number }[] = [];
    public startPosition: { position: number[]; rotationDeg: number } | null = null;

    // Countdown state
    public countdownPhase: number = -1; // -1 = inactive, 3/2/1 = countdown, 0 = GO

    // Debounce to prevent physics jitter from double-triggering a checkpoint
    private lastTriggerTime: number = 0;
    private readonly TRIGGER_COOLDOWN_MS = 500;

    constructor() {
    }

    /**
     * Resets the race to the starting line state for a specific track.
     */
    public startRace(trackId: string, maxCp: number, medals?: MedalTimes): void {
        this.state = RaceState.READY;
        this.raceTime = 0;
        this.currentCheckpointId = -1;
        this.maxCheckpoints = maxCp;
        this.lastTriggerTime = 0;

        if (this.currentTrackId !== trackId) {
            this.currentTrackId = trackId;
            this.loadBestTime(trackId);
        }

        this.currentMedals = medals || null;
    }

    /**
     * Triggers the actual race timer. Usually called when the car first accelerates.
     * Now starts a 3-2-1 countdown before racing.
     */
    public beginRacing(): void {
        if (this.state === RaceState.READY && this.countdownPhase === -1) {
            this.countdownPhase = 3;
        }
    }

    /**
     * Update countdown timer. Called every tick.
     * Returns the current countdown display: 3, 2, 1, "GO", or -1 if inactive.
     */
    public updateCountdown(dt: number): number {
        if (this.countdownPhase < 0) return -1;

        // Store elapsed countdown time
        if (!this._countdownElapsed) this._countdownElapsed = 0;
        this._countdownElapsed += dt;

        // Each phase lasts 0.7s
        const phaseDuration = 0.7;
        const elapsed = this._countdownElapsed;
        const newPhase = 3 - Math.floor(elapsed / phaseDuration);

        if (elapsed >= phaseDuration * 3 + 0.5) {
            // Countdown done - start racing
            this.countdownPhase = -1;
            this._countdownElapsed = 0;
            this.state = RaceState.RACING;
            this.startTime = performance.now();
            return -1;
        }

        this.countdownPhase = newPhase;
        return newPhase;
    }

    /**
     * Respawn the car to the last checkpoint (or start if no checkpoints hit).
     * Keeps the current race time and race state.
     */
    public getRespawnPosition(): { position: number[]; rotationDeg: number } | null {
        if (this.checkpointPositions.length === 0) {
            return this.startPosition;
        }
        return this.checkpointPositions[this.checkpointPositions.length - 1];
    }

    public setStartPosition(pos: number[], rot: number): void {
        this.startPosition = { position: pos, rotationDeg: rot };
    }

    public addCheckpointPosition(id: number, pos: number[], rot: number): void {
        // Remove any checkpoints after this id (in case of respawn then re-hitting)
        this.checkpointPositions = this.checkpointPositions.filter(cp => cp.id < id);
        this.checkpointPositions.push({ id, position: pos, rotationDeg: rot });
    }

    public resetCheckpointData(): void {
        this.checkpointPositions = [];
    }

    private _countdownElapsed: number = 0;

    public update(): void {
        if (this.state === RaceState.RACING) {
            this.raceTime = performance.now() - this.startTime;
        }
    }

    public hitCheckpoint(id: number): boolean {
        if (this.state !== RaceState.RACING) return false;

        const now = performance.now();
        if (this.lastTriggerTime !== 0 && now - this.lastTriggerTime < this.TRIGGER_COOLDOWN_MS) {
            return false;
        }

        if (id === this.currentCheckpointId + 1 && id < this.maxCheckpoints) {
            this.currentCheckpointId = id;
            this.lastTriggerTime = now;
            return true;
        }

        return false;
    }

    /**
     * Attempts to finish the race.
     * Only valid if ALL checkpoints have been sequentially hit.
     */
    public hitFinish(): boolean {
        if (this.state !== RaceState.RACING) return false;

        // Check if all checkpoints (0 to max-1) have been collected
        if (this.currentCheckpointId === this.maxCheckpoints - 1) {
            this.state = RaceState.FINISHED;
            // Update time exactly at finish
            this.raceTime = performance.now() - this.startTime;
            if (this.currentTrackId) {
                this.checkBestTime(this.currentTrackId, this.raceTime);
            }
            return true;
        }

        return false;
    }

    private checkBestTime(trackId: string, time: number): void {
        if (this.bestTime === null || time < this.bestTime) {
            this.bestTime = time;
            try {
                localStorage.setItem(`trackmania_clone_best_time_${trackId}`, time.toString());
            } catch (e) {
                console.warn("Could not save best time to localStorage", e);
            }
        }
    }

    public loadBestTime(trackId: string): void {
        this.bestTime = null; // Reset first
        try {
            const stored = localStorage.getItem(`trackmania_clone_best_time_${trackId}`);
            if (stored) {
                const parsedTime = parseFloat(stored);
                if (!isNaN(parsedTime) && isFinite(parsedTime)) {
                    this.bestTime = parsedTime;
                }
            }
        } catch (e) {
            console.warn("Could not load best time from localStorage", e);
        }
    }

    public getEarnedMedal(time: number): MedalType {
        if (!this.currentMedals) return MedalType.NONE;

        if (time <= this.currentMedals.author) return MedalType.AUTHOR;
        if (time <= this.currentMedals.gold) return MedalType.GOLD;
        if (time <= this.currentMedals.silver) return MedalType.SILVER;
        if (time <= this.currentMedals.bronze) return MedalType.BRONZE;

        return MedalType.NONE;
    }

    public static getMedalColor(medal: MedalType): string {
        switch (medal) {
            case MedalType.AUTHOR: return "#00FF00"; // Bright Green
            case MedalType.GOLD: return "#FFD700"; // Gold
            case MedalType.SILVER: return "#C0C0C0"; // Silver
            case MedalType.BRONZE: return "#CD7F32"; // Bronze
            default: return "#AAAAAA"; // None/Gray
        }
    }

    public static getMedalName(medal: MedalType): string {
        switch (medal) {
            case MedalType.AUTHOR: return "AUTHOR";
            case MedalType.GOLD: return "GOLD";
            case MedalType.SILVER: return "SILVER";
            case MedalType.BRONZE: return "BRONZE";
            default: return "NONE";
        }
    }

    public formatTime(ms: number): string {
        const totalSec = Math.floor(ms / 1000);
        const min = Math.floor(totalSec / 60);
        const sec = totalSec % 60;
        const millis = Math.floor(ms % 1000);

        return `${min.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}.${millis.toString().padStart(3, "0")}`;
    }
}
