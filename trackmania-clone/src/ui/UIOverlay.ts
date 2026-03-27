export class UIOverlay {
    private container: HTMLDivElement;
    private speedElement: HTMLDivElement;
    private timerElement: HTMLDivElement;
    private bestTimeElement: HTMLDivElement;
    private messageElement: HTMLDivElement;

    // New persistent status message (e.g. "READY", "FINISHED")
    private persistentMessageElement: HTMLDivElement;
    // New checkpoint progression (e.g. "CP: 1/3")
    private checkpointProgressElement: HTMLDivElement;

    constructor() {
        this.container = document.createElement("div");
        this.container.style.position = "absolute";
        this.container.style.top = "0";
        this.container.style.left = "0";
        this.container.style.width = "100%";
        this.container.style.height = "100%";
        this.container.style.pointerEvents = "none";
        this.container.style.fontFamily = "sans-serif";
        this.container.style.color = "white";
        this.container.style.textShadow = "1px 1px 2px black";

        // Speed
        this.speedElement = document.createElement("div");
        this.speedElement.style.position = "absolute";
        this.speedElement.style.bottom = "20px";
        this.speedElement.style.right = "20px";
        this.speedElement.style.fontSize = "36px";
        this.speedElement.style.fontWeight = "bold";

        // Timer
        this.timerElement = document.createElement("div");
        this.timerElement.style.position = "absolute";
        this.timerElement.style.top = "20px";
        this.timerElement.style.left = "20px";
        this.timerElement.style.fontSize = "48px";
        this.timerElement.style.fontWeight = "bold";

        // Best Time
        this.bestTimeElement = document.createElement("div");
        this.bestTimeElement.style.position = "absolute";
        this.bestTimeElement.style.top = "70px";
        this.bestTimeElement.style.left = "20px";
        this.bestTimeElement.style.fontSize = "24px";
        this.bestTimeElement.style.color = "gold";

        // Checkpoint Progress
        this.checkpointProgressElement = document.createElement("div");
        this.checkpointProgressElement.style.position = "absolute";
        this.checkpointProgressElement.style.top = "110px";
        this.checkpointProgressElement.style.left = "20px";
        this.checkpointProgressElement.style.fontSize = "20px";
        this.checkpointProgressElement.style.color = "lightblue";

        // Temporary Message (e.g. "CHECKPOINT 1")
        this.messageElement = document.createElement("div");
        this.messageElement.style.position = "absolute";
        this.messageElement.style.top = "40%";
        this.messageElement.style.width = "100%";
        this.messageElement.style.textAlign = "center";
        this.messageElement.style.fontSize = "48px";
        this.messageElement.style.fontWeight = "bold";
        this.messageElement.style.color = "yellow";
        this.messageElement.style.opacity = "0";
        this.messageElement.style.transition = "opacity 0.5s";

        // Persistent Message (e.g. "READY", "FINISHED")
        this.persistentMessageElement = document.createElement("div");
        this.persistentMessageElement.style.position = "absolute";
        this.persistentMessageElement.style.top = "50%";
        this.persistentMessageElement.style.width = "100%";
        this.persistentMessageElement.style.textAlign = "center";
        this.persistentMessageElement.style.fontSize = "36px";
        this.persistentMessageElement.style.fontWeight = "bold";
        this.persistentMessageElement.style.color = "white";
        this.persistentMessageElement.style.whiteSpace = "pre-line"; // Allow newlines

        this.container.appendChild(this.speedElement);
        this.container.appendChild(this.timerElement);
        this.container.appendChild(this.bestTimeElement);
        this.container.appendChild(this.checkpointProgressElement);
        this.container.appendChild(this.messageElement);
        this.container.appendChild(this.persistentMessageElement);

        document.body.appendChild(this.container);
    }

    public updateSpeed(kmh: number): void {
        this.speedElement.innerText = `${Math.floor(kmh)} KM/H`;
    }

    public updateTimer(timeStr: string): void {
        this.timerElement.innerText = timeStr;
    }

    public updateBestTime(timeStr: string | null): void {
        this.bestTimeElement.innerText = timeStr ? `Best: ${timeStr}` : "";
    }

    public updateCheckpointProgress(progress: string): void {
        this.checkpointProgressElement.innerText = `CP: ${progress}`;
    }

    public showMessage(text: string, durationMs: number = 2000): void {
        this.messageElement.innerText = text;
        this.messageElement.style.opacity = "1";

        setTimeout(() => {
            this.messageElement.style.opacity = "0";
        }, durationMs);
    }

    public showPersistentMessage(text: string): void {
        this.persistentMessageElement.innerText = text;
        this.persistentMessageElement.style.display = "block";
    }

    public hidePersistentMessage(): void {
        this.persistentMessageElement.style.display = "none";
    }
}