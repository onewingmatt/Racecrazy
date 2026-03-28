export class InputManager {
    public isForwardDown: boolean = false;
    public isBackDown: boolean = false;
    public isLeftDown: boolean = false;
    public isRightDown: boolean = false;

    // Singular action triggers
    public isRestartDown: boolean = false;
    public isGhostToggleDown: boolean = false;

    private touchContainer: HTMLDivElement | null = null;

    constructor() {
        this.attach();
        this.createTouchControls();
    }

    private createTouchControls(): void {
        // Only create touch controls if the device supports touch
        if (!("ontouchstart" in window) && navigator.maxTouchPoints <= 0) {
            return;
        }

        this.touchContainer = document.createElement("div");
        this.touchContainer.style.position = "absolute";
        this.touchContainer.style.bottom = "0";
        this.touchContainer.style.left = "0";
        this.touchContainer.style.width = "100%";
        this.touchContainer.style.height = "100%";
        this.touchContainer.style.pointerEvents = "none";
        this.touchContainer.style.zIndex = "100";
        this.touchContainer.style.userSelect = "none";

        // Left/Right Controls Container (Bottom Left)
        const steerContainer = document.createElement("div");
        steerContainer.style.position = "absolute";
        steerContainer.style.bottom = "5vh";
        steerContainer.style.left = "5vw";
        steerContainer.style.display = "flex";
        steerContainer.style.gap = "2vw";
        steerContainer.style.pointerEvents = "auto";

        // Forward/Back Controls Container (Bottom Right)
        const pedalContainer = document.createElement("div");
        pedalContainer.style.position = "absolute";
        pedalContainer.style.bottom = "5vh";
        pedalContainer.style.right = "5vw";
        pedalContainer.style.display = "flex";
        pedalContainer.style.flexDirection = "column";
        pedalContainer.style.gap = "2vh";
        pedalContainer.style.pointerEvents = "auto";

        // Action Buttons Container (Top Right)
        const actionContainer = document.createElement("div");
        actionContainer.style.position = "absolute";
        actionContainer.style.top = "5vh";
        actionContainer.style.right = "5vw";
        actionContainer.style.display = "flex";
        actionContainer.style.gap = "2vw";
        actionContainer.style.pointerEvents = "auto";

        // Create Buttons
        const btnLeft = this.createTouchButton("<", () => this.isLeftDown = true, () => this.isLeftDown = false);
        const btnRight = this.createTouchButton(">", () => this.isRightDown = true, () => this.isRightDown = false);

        const btnForward = this.createTouchButton("GAS", () => this.isForwardDown = true, () => this.isForwardDown = false);
        btnForward.style.height = "12vh"; // Make gas pedal taller

        const btnBack = this.createTouchButton("BRK", () => this.isBackDown = true, () => this.isBackDown = false);
        btnBack.style.height = "8vh";

        const btnRestart = this.createTouchButton("RST", () => this.isRestartDown = true, () => this.isRestartDown = false);
        const btnGhost = this.createTouchButton("GST", () => this.isGhostToggleDown = true, () => this.isGhostToggleDown = false);

        steerContainer.appendChild(btnLeft);
        steerContainer.appendChild(btnRight);

        pedalContainer.appendChild(btnForward);
        pedalContainer.appendChild(btnBack);

        actionContainer.appendChild(btnRestart);
        actionContainer.appendChild(btnGhost);

        this.touchContainer.appendChild(steerContainer);
        this.touchContainer.appendChild(pedalContainer);
        this.touchContainer.appendChild(actionContainer);

        document.body.appendChild(this.touchContainer);
    }

    private createTouchButton(text: string, onDown: () => void, onUp: () => void): HTMLButtonElement {
        const btn = document.createElement("button");
        btn.innerText = text;
        btn.style.width = "15vw";
        btn.style.height = "10vh";
        btn.style.minWidth = "60px";
        btn.style.minHeight = "60px";
        btn.style.backgroundColor = "rgba(255, 255, 255, 0.2)";
        btn.style.border = "2px solid rgba(255, 255, 255, 0.5)";
        btn.style.borderRadius = "10px";
        btn.style.color = "white";
        btn.style.fontSize = "24px";
        btn.style.fontWeight = "bold";
        btn.style.touchAction = "none"; // Crucial to prevent browser handling
        btn.style.userSelect = "none";

        // Use pointer events for universal touch/mouse support
        btn.addEventListener("pointerdown", (e) => {
            e.preventDefault();
            btn.style.backgroundColor = "rgba(255, 255, 255, 0.5)";
            onDown();
        });

        const handleUp = (e: Event) => {
            e.preventDefault();
            btn.style.backgroundColor = "rgba(255, 255, 255, 0.2)";
            onUp();
        };

        btn.addEventListener("pointerup", handleUp);
        btn.addEventListener("pointercancel", handleUp);
        btn.addEventListener("pointerout", handleUp);

        return btn;
    }

    private attach(): void {
        window.addEventListener("keydown", this.handleKeyDown);
        window.addEventListener("keyup", this.handleKeyUp);
    }

    public detach(): void {
        window.removeEventListener("keydown", this.handleKeyDown);
        window.removeEventListener("keyup", this.handleKeyUp);
        if (this.touchContainer && this.touchContainer.parentNode) {
            this.touchContainer.parentNode.removeChild(this.touchContainer);
        }
    }

    private handleKeyDown = (event: KeyboardEvent): void => {
        switch (event.code) {
            case "ArrowUp":
            case "KeyW":
                this.isForwardDown = true;
                break;
            case "ArrowDown":
            case "KeyS":
                this.isBackDown = true;
                break;
            case "ArrowLeft":
            case "KeyA":
                this.isLeftDown = true;
                break;
            case "ArrowRight":
            case "KeyD":
                this.isRightDown = true;
                break;
            case "KeyR":
            case "Backspace":
                this.isRestartDown = true;
                break;
            case "KeyG":
                this.isGhostToggleDown = true;
                break;
        }
    };

    private handleKeyUp = (event: KeyboardEvent): void => {
        switch (event.code) {
            case "ArrowUp":
            case "KeyW":
                this.isForwardDown = false;
                break;
            case "ArrowDown":
            case "KeyS":
                this.isBackDown = false;
                break;
            case "ArrowLeft":
            case "KeyA":
                this.isLeftDown = false;
                break;
            case "ArrowRight":
            case "KeyD":
                this.isRightDown = false;
                break;
            case "KeyR":
            case "Backspace":
                this.isRestartDown = false;
                break;
            case "KeyG":
                this.isGhostToggleDown = false;
                break;
        }
    };

    // Clear singular press events after frame loop so they don't trigger rapidly
    public resetPerFrameInputs(): void {
        this.isRestartDown = false;
        this.isGhostToggleDown = false;
    }
}