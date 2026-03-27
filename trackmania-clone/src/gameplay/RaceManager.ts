export interface CheckpointInfo {
    id: number;
    position: number[];
    rotationDeg: number;
}

export class RaceManager {
    public isRacing: boolean = false;
    public startTime: number = 0;
    public raceTime: number = 0;
    public bestTime: number | null = null;

    public currentCheckpointId: number = -1;
    private maxCheckpoints: number = 0;

    constructor() {
        this.loadBestTime();
    }

    public startRace(maxCp: number): void {
        this.isRacing = true;
        this.startTime = performance.now();
        this.raceTime = 0;
        this.currentCheckpointId = -1;
        this.maxCheckpoints = maxCp;
    }

    public update(): void {
        if (this.isRacing) {
            this.raceTime = performance.now() - this.startTime;
        }
    }

    public hitCheckpoint(id: number): boolean {
        if (id > this.currentCheckpointId && id === this.currentCheckpointId + 1) {
            this.currentCheckpointId = id;
            return true;
        }
        return false;
    }

    public hitFinish(): boolean {
        if (this.currentCheckpointId === this.maxCheckpoints - 1) {
            this.isRacing = false;
            this.checkBestTime(this.raceTime);
            return true;
        }
        return false;
    }

    private checkBestTime(time: number): void {
        if (this.bestTime === null || time < this.bestTime) {
            this.bestTime = time;
            localStorage.setItem("trackmania_clone_best_time", time.toString());
        }
    }

    private loadBestTime(): void {
        const stored = localStorage.getItem("trackmania_clone_best_time");
        if (stored) {
            this.bestTime = parseFloat(stored);
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
