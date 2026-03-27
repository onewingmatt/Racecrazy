export class InputManager {
    public isForwardDown: boolean = false;
    public isBackDown: boolean = false;
    public isLeftDown: boolean = false;
    public isRightDown: boolean = false;

    // Singular action triggers
    public isRestartDown: boolean = false;
    public isGhostToggleDown: boolean = false;

    constructor() {
        this.attach();
    }

    private attach(): void {
        window.addEventListener("keydown", this.handleKeyDown);
        window.addEventListener("keyup", this.handleKeyUp);
    }

    public detach(): void {
        window.removeEventListener("keydown", this.handleKeyDown);
        window.removeEventListener("keyup", this.handleKeyUp);
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