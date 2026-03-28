export enum RaceState {
    READY,
    RACING,
    FINISHED
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

    // Checkpoints are 0-indexed. -1 means no checkpoints hit yet.
    public currentCheckpointId: number = -1;
    public maxCheckpoints: number = 0;

    // Debounce to prevent physics jitter from double-triggering a checkpoint
    // We'll store the last time a checkpoint was hit in ms.
    private lastTriggerTime: number = 0;
    private readonly TRIGGER_COOLDOWN_MS = 500;

    constructor() {
        this.loadBestTime();
    }

    /**
     * Resets the race to the starting line state.
     */
    public startRace(maxCp: number): void {
        this.state = RaceState.READY;
        this.raceTime = 0;
        this.currentCheckpointId = -1;
        this.maxCheckpoints = maxCp;
        this.lastTriggerTime = 0;
    }

    /**
     * Triggers the actual race timer. Usually called when the car first accelerates.
     */
    public beginRacing(): void {
        if (this.state === RaceState.READY) {
            this.state = RaceState.RACING;
            this.startTime = performance.now();
        }
    }

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
            this.checkBestTime(this.raceTime);
            return true;
        }

        return false;
    }

    private checkBestTime(time: number): void {
        if (this.bestTime === null || time < this.bestTime) {
            this.bestTime = time;
            try {
                localStorage.setItem("trackmania_clone_best_time", time.toString());
            } catch (e) {
                console.warn("Could not save best time to localStorage", e);
            }
        }
    }

    private loadBestTime(): void {
        try {
            const stored = localStorage.getItem("trackmania_clone_best_time");
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

    public formatTime(ms: number): string {
        const totalSec = Math.floor(ms / 1000);
        const min = Math.floor(totalSec / 60);
        const sec = totalSec % 60;
        const millis = Math.floor(ms % 1000);

        return `${min.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}.${millis.toString().padStart(3, "0")}`;
    }
}