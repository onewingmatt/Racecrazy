export class GameLoop {
    private lastTime: number = 0;
    private accumulator: number = 0;
    private readonly timeStep: number;
    private isRunning: boolean = false;
    private animationFrameId: number = 0;

    constructor(
        private updateCallback: (dt: number) => void,
        private renderCallback: (alpha: number) => void,
        fps: number = 60
    ) {
        this.timeStep = 1 / fps;
    }

    public start(): void {
        if (this.isRunning) return;
        this.isRunning = true;
        this.lastTime = performance.now() / 1000;
        this.loop(this.lastTime);
    }

    public stop(): void {
        this.isRunning = false;
        cancelAnimationFrame(this.animationFrameId);
    }

    private loop = (currentTimeMs: number): void => {
        if (!this.isRunning) return;

        const currentTime = currentTimeMs / 1000;
        let frameTime = currentTime - this.lastTime;

        // Prevent huge jumps if tab was inactive
        if (frameTime > 0.25) {
            frameTime = 0.25;
        }

        this.lastTime = currentTime;
        this.accumulator += frameTime;

        while (this.accumulator >= this.timeStep) {
            this.updateCallback(this.timeStep);
            this.accumulator -= this.timeStep;
        }

        const alpha = this.accumulator / this.timeStep;
        this.renderCallback(alpha);

        this.animationFrameId = requestAnimationFrame(this.loop);
    };
}
