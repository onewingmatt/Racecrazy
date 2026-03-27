import { Scene, Vector3 } from "@babylonjs/core";
import { HavokPlugin } from "@babylonjs/core/Physics/v2/Plugins/havokPlugin";
import HavokPhysics from "@babylonjs/havok";

export class PhysicsEngine {
    public plugin!: HavokPlugin;
    private scene: Scene;

    constructor(scene: Scene) {
        this.scene = scene;
    }

    public async initialize(): Promise<void> {
        // Initialize Havok
        const havokInstance = await HavokPhysics();
        this.plugin = new HavokPlugin(true, havokInstance);

        // Ensure PhysicsEngine component exists
        const gravity = new Vector3(0, -19.62, 0);
        this.scene.enablePhysics(gravity, this.plugin);

        // Instead of setting timeStep to 0, which breaks things in V2 sometimes,
        // we leave it default and rely on Babylon's rendering loop OR our fixed update
        // for simplicity in this scaffold, let Babylon handle physics steps in the render loop.
        // We'll just skip doing manual physics step in the GameLoop.
    }

    public step(_delta: number): void {
        // Leaving this empty and letting Babylon's internal system step physics to avoid
        // internal bugs in HavokPlugin manual stepping
    }
}