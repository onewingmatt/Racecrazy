export class InputManager {
    public isForwardDown: boolean = false;
    public isBackDown: boolean = false;
    public isLeftDown: boolean = false;
    public isRightDown: boolean = false;

    // Analog input values (range -1 to 1). 0 if digital-only input.
    public steerInput: number = 0;     // -1 (left) to 1 (right)
    public throttleInput: number = 0;  // 0 to 1
    public brakeInput: number = 0;     // 0 to 1

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

    // Poll a connected gamepad (Gamepad API). Updates both boolean flags AND analog values.
    public pollGamepad(): void {
        const gamepads = navigator.getGamepads();
        if (!gamepads) return;

        // Use the first connected gamepad
        let gp: Gamepad | null = null;
        for (let i = 0; i < gamepads.length; i++) {
            if (gamepads[i] !== null) {
                gp = gamepads[i] as Gamepad;
                break;
            }
        }
        if (!gp) return;

        // Standard gamepad mapping (Xbox/PS):
        // Axes: [0] left stick X, [1] left stick Y
        // Buttons: [7] RT (throttle), [6] LT (brake), [0] A/Cross, [2] X/Square, [9] R bumper
        const stickX = this.deadzone(gp.axes[0] ?? 0);
        const rt = gp.buttons[7]?.value ?? (gp.buttons[7]?.pressed ? 1 : 0);
        const lt = gp.buttons[6]?.value ?? (gp.buttons[6]?.pressed ? 1 : 0);

        // Analog values
        this.steerInput = stickX;
        this.throttleInput = rt;
        this.brakeInput = lt;

        // Update boolean flags from gamepad (DPAD or buttons also map to movement)
        const dpadLeft = gp.buttons[14]?.pressed ?? false;
        const dpadRight = gp.buttons[15]?.pressed ?? false;

        this.isLeftDown = dpadLeft || stickX < -0.3;
        this.isRightDown = dpadRight || stickX > 0.3;
        this.isForwardDown = rt > 0.1 || (gp.buttons[0]?.pressed ?? false);
        this.isBackDown = lt > 0.1 || (gp.buttons[2]?.pressed ?? false);

        // D-pad also maps to forward/back on some controllers
        const dpadUp = gp.buttons[12]?.pressed ?? false;
        const dpadDown = gp.buttons[13]?.pressed ?? false;
        if (dpadUp) this.isForwardDown = true;
        if (dpadDown) this.isBackDown = true;

        // Restart = Start/Options button, Ghost toggle = Select/Share
        if (gp.buttons[9]?.pressed) this.isRestartDown = true;
        if (gp.buttons[8]?.pressed) this.isGhostToggleDown = true;
    }

    private deadzone(value: number, threshold: number = 0.15): number {
        return Math.abs(value) < threshold ? 0 : value;
    }

    // Clear singular press events after frame loop so they don't trigger rapidly
    public resetPerFrameInputs(): void {
        this.isRestartDown = false;
        this.isGhostToggleDown = false;
    }
}