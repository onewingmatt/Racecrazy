import { Engine, Scene, DirectionalLight, HemisphericLight, Vector3, FollowCamera, Color3, Color4, MeshBuilder, StandardMaterial } from "@babylonjs/core";
import { CAMERA_MODES } from "./CameraConfig";

export class Renderer {
    public canvas: HTMLCanvasElement;
    public engine: Engine;
    public scene: Scene;
    public camera!: FollowCamera;
    private currentModeIndex = 0;
    private targetRadius = CAMERA_MODES[0].radius;
    private targetHeight = CAMERA_MODES[0].heightOffset;
    private targetBaseFov = CAMERA_MODES[0].baseFov;
    private targetMaxFov = CAMERA_MODES[0].maxFov;
    private targetFovThreshold = CAMERA_MODES[0].fovSpeedThreshold;

    constructor() {
        this.canvas = document.createElement("canvas");
        this.canvas.style.width = "100%";
        this.canvas.style.height = "100%";
        this.canvas.style.display = "block";
        document.body.appendChild(this.canvas);

        document.body.style.margin = "0";
        document.body.style.overflow = "hidden";

        this.engine = new Engine(this.canvas, true, { preserveDrawingBuffer: true, stencil: true });
        this.scene = new Scene(this.engine);

        this.setupEnvironment();
        this.setupLighting();
        this.setupCamera();
        this.setupDepthCues();

        window.addEventListener("resize", () => {
            this.engine.resize();
        });
    }

    private setupEnvironment(): void {
        const skyColor = new Color3(0.4, 0.6, 0.9);
        this.scene.clearColor = new Color4(skyColor.r, skyColor.g, skyColor.b, 1.0);

        this.scene.fogMode = Scene.FOGMODE_LINEAR;
        this.scene.fogColor = skyColor;
        this.scene.fogStart = 100.0;
        this.scene.fogEnd = 300.0;
    }

    private setupLighting(): void {
        const hemisphericLight = new HemisphericLight("hemiLight", new Vector3(0, 1, 0), this.scene);
        hemisphericLight.intensity = 0.5;
        hemisphericLight.groundColor = new Color3(0.1, 0.1, 0.1);

        const dirLight = new DirectionalLight("dirLight", new Vector3(-0.5, -1, -0.5), this.scene);
        dirLight.intensity = 1.0;
    }

    private setupCamera(): void {
        this.camera = new FollowCamera("followCam", new Vector3(0, 10, -10), this.scene);

        const cfg = CAMERA_MODES[0];
        this.camera.radius = cfg.radius;
        this.camera.heightOffset = cfg.heightOffset;
        this.camera.rotationOffset = 180;
        this.camera.cameraAcceleration = cfg.cameraAcceleration;
        this.camera.maxCameraSpeed = cfg.maxCameraSpeed;
        this.camera.fov = cfg.baseFov;

        // Cache for smooth transitions
        this.targetRadius = cfg.radius;
        this.targetHeight = cfg.heightOffset;
        this.targetBaseFov = cfg.baseFov;
        this.targetMaxFov = cfg.maxFov;
        this.targetFovThreshold = cfg.fovSpeedThreshold;
    }

    /**
     * Cycle to the next camera mode. Returns the new mode name for UI.
     */
    public cycleCameraMode(): string {
        this.currentModeIndex = (this.currentModeIndex + 1) % CAMERA_MODES.length;
        const cfg = CAMERA_MODES[this.currentModeIndex];

        this.targetRadius = cfg.radius;
        this.targetHeight = cfg.heightOffset;
        this.targetBaseFov = cfg.baseFov;
        this.targetMaxFov = cfg.maxFov;
        this.targetFovThreshold = cfg.fovSpeedThreshold;
        this.camera.cameraAcceleration = cfg.cameraAcceleration;
        this.camera.maxCameraSpeed = cfg.maxCameraSpeed;

        return cfg.name;
    }

    /**
     * Smoothly interpolate camera parameters toward the current mode targets.
     * Call this every frame from renderUpdate.
     */
    public updateCameraMode(): void {
        const lerpFactor = 0.08;
        this.camera.radius += (this.targetRadius - this.camera.radius) * lerpFactor;
        this.camera.heightOffset += (this.targetHeight - this.camera.heightOffset) * lerpFactor;
    }

    private setupDepthCues(): void {
        const ground = MeshBuilder.CreateGround("depthGround", { width: 1000, height: 1000 }, this.scene);
        ground.position.y = -50;

        const groundMat = new StandardMaterial("groundMat", this.scene);
        groundMat.diffuseColor = new Color3(0.05, 0.15, 0.05);
        groundMat.specularColor = new Color3(0, 0, 0);
        ground.material = groundMat;

        ground.isPickable = false;
    }

    /**
     * Call this per-frame to inject sense-of-speed (dynamic FOV).
     */
    public updateCameraForSpeed(speedKmh: number): void {
        const speedRatio = Math.min(1.0, speedKmh / this.targetFovThreshold);
        const targetFov = this.targetBaseFov + (this.targetMaxFov - this.targetBaseFov) * (speedRatio * speedRatio);

        this.camera.fov = this.camera.fov * 0.9 + targetFov * 0.1;
    }

    public render(): void {
        this.scene.render();
    }
}
