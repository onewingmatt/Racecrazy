export class UIOverlay {
    private container: HTMLDivElement;
    private speedElement: HTMLDivElement;
    private timerElement: HTMLDivElement;
    private bestTimeElement: HTMLDivElement;
    private messageElement: HTMLDivElement;

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

        // Message
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

        this.container.appendChild(this.speedElement);
        this.container.appendChild(this.timerElement);
        this.container.appendChild(this.bestTimeElement);
        this.container.appendChild(this.messageElement);

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

    public showMessage(text: string, durationMs: number = 2000): void {
        this.messageElement.innerText = text;
        this.messageElement.style.opacity = "1";

        setTimeout(() => {
            this.messageElement.style.opacity = "0";
        }, durationMs);
    }
}