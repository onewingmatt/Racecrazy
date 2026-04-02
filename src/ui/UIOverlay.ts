export class UIOverlay {
    private container: HTMLDivElement;
    private speedElement: HTMLDivElement;
    private timerElement: HTMLDivElement;
    private bestTimeElement: HTMLDivElement;
    private messageElement: HTMLDivElement;

    private persistentMessageElement: HTMLDivElement;
    private checkpointProgressElement: HTMLDivElement;
    private ghostStatusElement: HTMLDivElement;

    // Countdown overlay (3-2-1-GO)
    private countdownElement: HTMLDivElement;
    // Flip recovery progress bar
    private flipRecoveryElement: HTMLDivElement;

    constructor() {
        // Base container styling
        this.container = document.createElement("div");
        this.container.style.position = "absolute";
        this.container.style.top = "0";
        this.container.style.left = "0";
        this.container.style.width = "100%";
        this.container.style.height = "100%";
        this.container.style.pointerEvents = "none";

        // Use a thick, slightly italicized sans-serif for arcade feel
        this.container.style.fontFamily = "Impact, 'Arial Black', sans-serif";
        this.container.style.fontStyle = "italic";
        this.container.style.color = "white";
        // Heavy text stroke/shadow for readability against sky and track
        this.container.style.textShadow = "-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000, 4px 4px 8px rgba(0,0,0,0.8)";
        this.container.style.userSelect = "none";

        // Speed Indicator
        this.speedElement = document.createElement("div");
        this.speedElement.style.position = "absolute";
        this.speedElement.style.bottom = "3vh";
        this.speedElement.style.right = "3vw";
        this.speedElement.style.fontSize = "min(8vw, 64px)";
        this.speedElement.style.fontWeight = "900";
        this.speedElement.style.color = "#FFD700"; // Gold color for speed

        // Race Timer
        this.timerElement = document.createElement("div");
        this.timerElement.style.position = "absolute";
        this.timerElement.style.top = "3vh";
        this.timerElement.style.left = "3vw";
        this.timerElement.style.fontSize = "min(10vw, 80px)";
        this.timerElement.style.fontWeight = "900";

        // Best Time
        this.bestTimeElement = document.createElement("div");
        this.bestTimeElement.style.position = "absolute";
        this.bestTimeElement.style.top = "12vh"; // Under timer
        this.bestTimeElement.style.left = "3vw";
        this.bestTimeElement.style.fontSize = "min(4vw, 32px)";
        this.bestTimeElement.style.color = "#AAAAAA"; // Subtle grey

        // Checkpoint Progress
        this.checkpointProgressElement = document.createElement("div");
        this.checkpointProgressElement.style.position = "absolute";
        this.checkpointProgressElement.style.top = "18vh";
        this.checkpointProgressElement.style.left = "3vw";
        this.checkpointProgressElement.style.fontSize = "min(5vw, 40px)";
        this.checkpointProgressElement.style.color = "#4DA6FF"; // Light blue

        // Ghost Toggle Status
        this.ghostStatusElement = document.createElement("div");
        this.ghostStatusElement.style.position = "absolute";
        this.ghostStatusElement.style.top = "24vh";
        this.ghostStatusElement.style.left = "3vw";
        this.ghostStatusElement.style.fontSize = "min(3vw, 24px)";
        this.ghostStatusElement.style.color = "#8888FF";
        this.ghostStatusElement.style.opacity = "0.8";

        // Temporary Pop-up Messages (e.g. "CHECKPOINT 1")
        this.messageElement = document.createElement("div");
        this.messageElement.style.position = "absolute";
        this.messageElement.style.top = "30%";
        this.messageElement.style.width = "100%";
        this.messageElement.style.textAlign = "center";
        this.messageElement.style.fontSize = "min(12vw, 96px)";
        this.messageElement.style.fontWeight = "900";
        this.messageElement.style.color = "#FFCC00";
        this.messageElement.style.opacity = "0";
        this.messageElement.style.transition = "opacity 0.3s ease-in-out, transform 0.1s";
        this.messageElement.style.transform = "scale(0.8)";

        // Persistent State Banners (e.g. "READY", "FINISHED")
        this.persistentMessageElement = document.createElement("div");
        this.persistentMessageElement.style.position = "absolute";
        this.persistentMessageElement.style.top = "45%";
        this.persistentMessageElement.style.width = "100%";
        this.persistentMessageElement.style.textAlign = "center";
        this.persistentMessageElement.style.fontSize = "min(8vw, 64px)";
        this.persistentMessageElement.style.fontWeight = "900";
        this.persistentMessageElement.style.color = "white";
        this.persistentMessageElement.style.whiteSpace = "pre-line"; // Allow newlines
        // Add a semi-transparent dark banner behind the persistent text for high contrast
        this.persistentMessageElement.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
        this.persistentMessageElement.style.padding = "20px 0";
        this.persistentMessageElement.style.borderTop = "4px solid #FF3333";
        this.persistentMessageElement.style.borderBottom = "4px solid #FF3333";
        this.persistentMessageElement.style.boxShadow = "0px 10px 20px rgba(0,0,0,0.5)";

        this.container.appendChild(this.speedElement);
        this.container.appendChild(this.timerElement);
        this.container.appendChild(this.bestTimeElement);
        this.container.appendChild(this.checkpointProgressElement);
        this.container.appendChild(this.ghostStatusElement);
        this.container.appendChild(this.messageElement);
        this.container.appendChild(this.persistentMessageElement);

        // Countdown overlay
        this.countdownElement = document.createElement("div");
        this.countdownElement.style.position = "absolute";
        this.countdownElement.style.top = "40%";
        this.countdownElement.style.width = "100%";
        this.countdownElement.style.textAlign = "center";
        this.countdownElement.style.fontSize = "min(20vw, 160px)";
        this.countdownElement.style.fontWeight = "900";
        this.countdownElement.style.opacity = "0";
        this.countdownElement.style.transition = "opacity 0.2s";
        this.container.appendChild(this.countdownElement);

        // Flip recovery indicator
        this.flipRecoveryElement = document.createElement("div");
        this.flipRecoveryElement.style.position = "absolute";
        this.flipRecoveryElement.style.top = "60%";
        this.flipRecoveryElement.style.width = "100%";
        this.flipRecoveryElement.style.textAlign = "center";
        this.flipRecoveryElement.style.fontSize = "min(6vw, 48px)";
        this.flipRecoveryElement.style.color = "#FF4444";
        this.flipRecoveryElement.style.opacity = "0";
        this.container.appendChild(this.flipRecoveryElement);

        document.body.appendChild(this.container);
    }

    public updateSpeed(kmh: number): void {
        this.speedElement.innerText = `${Math.floor(kmh)} KM/H`;
    }

    public updateTimer(timeStr: string): void {
        this.timerElement.innerText = timeStr;
    }

    public updateBestTime(timeStr: string | null): void {
        this.bestTimeElement.innerText = timeStr ? `BEST  ${timeStr}` : "";
    }

    public updateCheckpointProgress(progress: string): void {
        this.checkpointProgressElement.innerText = `CP: ${progress}`;
    }

    public updateGhostStatus(enabled: boolean, hasData: boolean): void {
        if (!hasData) {
            this.ghostStatusElement.innerText = "";
            return;
        }
        this.ghostStatusElement.innerText = enabled ? "GHOST: ON [G]" : "GHOST: OFF [G]";
    }

    public showMessage(text: string, durationMs: number = 1500): void {
        this.messageElement.innerText = text;
        this.messageElement.style.opacity = "1";
        this.messageElement.style.transform = "scale(1.0)"; // Slight pop effect

        setTimeout(() => {
            this.messageElement.style.opacity = "0";
            this.messageElement.style.transform = "scale(0.8)";
        }, durationMs);
    }

    public showPersistentMessage(text: string): void {
        this.persistentMessageElement.innerText = text;
        this.persistentMessageElement.style.display = "block";
    }

    public hidePersistentMessage(): void {
        this.persistentMessageElement.style.display = "none";
    }

    public showCountdown(text: string, color: string = "#FFD700"): void {
        this.countdownElement.innerText = text;
        this.countdownElement.style.color = color;
        this.countdownElement.style.opacity = "1";
        this.countdownElement.style.transform = "scale(1.2)";
        setTimeout(() => {
            this.countdownElement.style.transform = "scale(1.0)";
        }, 100);
    }

    public hideCountdown(): void {
        this.countdownElement.style.opacity = "0";
    }

    public updateFlipRecovery(pct: number): void {
        if (pct <= 0) {
            this.flipRecoveryElement.style.opacity = "0";
            return;
        }
        const bar = "█".repeat(Math.floor(pct * 16)) + "░".repeat(16 - Math.floor(pct * 16));
        this.flipRecoveryElement.innerText = `RESPAWNING [${bar}]`;
        this.flipRecoveryElement.style.opacity = "0.7 + 0.3 * Math.sin(Date.now() * 0.01)";
    }

    public hideFlipRecovery(): void {
        this.flipRecoveryElement.style.opacity = "0";
    }
}