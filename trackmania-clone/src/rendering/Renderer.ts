import { Engine, Scene, DirectionalLight, HemisphericLight, Vector3, FollowCamera, Color3 } from "@babylonjs/core";

export class Renderer {
    public canvas: HTMLCanvasElement;
    public engine: Engine;
    public scene: Scene;
    public camera!: FollowCamera;

    constructor() {
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
        this.scene.clearColor = new Color3(0.5, 0.7, 0.9).toColor4(); // Sky blue

        this.setupLighting();
        this.setupCamera();

        window.addEventListener("resize", () => {
            this.engine.resize();
        });
    }

    private setupLighting(): void {
        const hemisphericLight = new HemisphericLight("hemiLight", new Vector3(0, 1, 0), this.scene);
        hemisphericLight.intensity = 0.6;
        hemisphericLight.groundColor = new Color3(0.2, 0.2, 0.2);

        const dirLight = new DirectionalLight("dirLight", new Vector3(-1, -2, -1), this.scene);
        dirLight.intensity = 0.8;
    }

    private setupCamera(): void {
        this.camera = new FollowCamera("followCam", new Vector3(0, 10, -10), this.scene);
        this.camera.radius = 12; // Distance
        this.camera.heightOffset = 4; // Height
        this.camera.rotationOffset = 180; // Angle
        this.camera.cameraAcceleration = 0.05;
        this.camera.maxCameraSpeed = 20;
    }

    public render(): void {
        this.scene.render();
    }
}