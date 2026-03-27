import { Engine, Scene, DirectionalLight, HemisphericLight, Vector3, FollowCamera, Color3, Color4, MeshBuilder, StandardMaterial } from "@babylonjs/core";
import { CameraConfig, DEFAULT_CAMERA_CONFIG } from "./CameraConfig";

export class Renderer {
    public canvas: HTMLCanvasElement;
    public engine: Engine;
    public scene: Scene;
    public camera!: FollowCamera;
    private config: CameraConfig;

    constructor(config?: Partial<CameraConfig>) {
        this.config = { ...DEFAULT_CAMERA_CONFIG, ...config };

        this.canvas = document.createElement("canvas");
        this.canvas.style.width = "100%";
        this.canvas.style.height = "100%";
        this.canvas.style.display = "block";
        document.body.appendChild(this.canvas);

        // Remove margin from body
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

        // Linear Fog for depth perception (helps distinguish far blocks)
        this.scene.fogMode = Scene.FOGMODE_LINEAR;
        this.scene.fogColor = skyColor;
        this.scene.fogStart = 100.0;
        this.scene.fogEnd = 300.0; // Distance where track fully blends into sky
    }

    private setupLighting(): void {
        const hemisphericLight = new HemisphericLight("hemiLight", new Vector3(0, 1, 0), this.scene);
        hemisphericLight.intensity = 0.5;
        hemisphericLight.groundColor = new Color3(0.1, 0.1, 0.1);

        // Strong directional light simulating sun for better contrast on track block edges
        const dirLight = new DirectionalLight("dirLight", new Vector3(-0.5, -1, -0.5), this.scene);
        dirLight.intensity = 1.0;
    }

    private setupCamera(): void {
        this.camera = new FollowCamera("followCam", new Vector3(0, 10, -10), this.scene);

        // Apply configuration for a lower, closer angle
        this.camera.radius = this.config.radius;
        this.camera.heightOffset = this.config.heightOffset;
        this.camera.rotationOffset = 180; // Looking forward from behind
        this.camera.cameraAcceleration = this.config.cameraAcceleration;
        this.camera.maxCameraSpeed = this.config.maxCameraSpeed;

        this.camera.fov = this.config.baseFov;
    }

    private setupDepthCues(): void {
        // A huge, dark ground plane far below the track to provide a horizon and motion reference
        const ground = MeshBuilder.CreateGround("depthGround", { width: 1000, height: 1000 }, this.scene);
        ground.position.y = -50; // Far below the gameplay area

        const groundMat = new StandardMaterial("groundMat", this.scene);
        groundMat.diffuseColor = new Color3(0.05, 0.15, 0.05); // Very dark green/grey
        groundMat.specularColor = new Color3(0, 0, 0); // No shine
        ground.material = groundMat;

        // Disable picking on this decorative plane
        ground.isPickable = false;
    }

    /**
     * Call this per-frame to inject sense-of-speed (dynamic FOV).
     */
    public updateCameraForSpeed(speedKmh: number): void {
        // Increase FOV based on speed, up to maxFov
        const speedRatio = Math.min(1.0, speedKmh / this.config.fovSpeedThreshold);
        // Interpolate FOV smoothly based on speed curve (quadratic looks better than linear)
        const targetFov = this.config.baseFov + (this.config.maxFov - this.config.baseFov) * (speedRatio * speedRatio);

        // Lerp camera FOV for smooth transitions when braking rapidly
        this.camera.fov = this.camera.fov * 0.9 + targetFov * 0.1;
    }

    public render(): void {
        this.scene.render();
    }
}