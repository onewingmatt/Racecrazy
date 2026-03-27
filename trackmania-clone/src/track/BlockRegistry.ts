import { MeshBuilder, StandardMaterial, Color3, Scene, Vector3, Mesh, InstancedMesh } from "@babylonjs/core";
import { PhysicsAggregate, PhysicsShapeType } from "@babylonjs/core/Physics/v2";

export class BlockRegistry {
    public static readonly GRID_SIZE = 10;
    public static readonly HEIGHT_STEP = 2;

    private readonly materials: { [key: string]: StandardMaterial } = {};
    private readonly baseMeshes: { [key: string]: Mesh } = {};

    constructor(private scene: Scene) {
        this.initializeMaterials();
    }

    private initializeMaterials(): void {
        const roadMat = new StandardMaterial("roadMat", this.scene);
        roadMat.diffuseColor = new Color3(0.2, 0.2, 0.2);

        const startMat = new StandardMaterial("startMat", this.scene);
        startMat.diffuseColor = new Color3(0.2, 0.8, 0.2);

        const finishMat = new StandardMaterial("finishMat", this.scene);
        finishMat.diffuseColor = new Color3(0.8, 0.2, 0.2);

        const checkMat = new StandardMaterial("checkMat", this.scene);
        checkMat.diffuseColor = new Color3(0.2, 0.2, 0.8);
        checkMat.alpha = 0.5; // Translucent for checkpoint volume

        this.materials["road"] = roadMat;
        this.materials["start"] = startMat;
        this.materials["finish"] = finishMat;
        this.materials["checkpoint"] = checkMat;
    }

    // Call this AFTER physics is initialized
    public initializeBaseMeshes(): void {
        const s = BlockRegistry.GRID_SIZE;
        const h = BlockRegistry.HEIGHT_STEP;

        // Straight Block (Floor)
        const straight = MeshBuilder.CreateBox("base_straight", { width: s, depth: s, height: 0.5 }, this.scene);
        straight.material = this.materials["road"];
        straight.isVisible = false;

        // Add physics
        new PhysicsAggregate(straight, PhysicsShapeType.BOX, { mass: 0, restitution: 0.1, friction: 0.8 }, this.scene);

        this.baseMeshes["straight"] = straight;

        const start = MeshBuilder.CreateBox("base_start", { width: s, depth: s, height: 0.5 }, this.scene);
        start.material = this.materials["start"];
        start.isVisible = false;
        new PhysicsAggregate(start, PhysicsShapeType.BOX, { mass: 0, restitution: 0.1, friction: 0.8 }, this.scene);
        this.baseMeshes["start"] = start;

        const finish = MeshBuilder.CreateBox("base_finish", { width: s, depth: s, height: 0.5 }, this.scene);
        finish.material = this.materials["finish"];
        finish.isVisible = false;
        new PhysicsAggregate(finish, PhysicsShapeType.BOX, { mass: 0, restitution: 0.1, friction: 0.8 }, this.scene);
        this.baseMeshes["finish"] = finish;

        const turn = MeshBuilder.CreateBox("base_turn", { width: s, depth: s, height: 0.5 }, this.scene);
        turn.material = this.materials["road"];
        turn.isVisible = false;
        new PhysicsAggregate(turn, PhysicsShapeType.BOX, { mass: 0, restitution: 0.1, friction: 0.8 }, this.scene);
        this.baseMeshes["turn"] = turn;

        const simpleRamp = MeshBuilder.CreateBox("base_ramp", { width: s, depth: Math.sqrt(s*s + h*h), height: 0.5 }, this.scene);
        const angle = Math.atan2(h, s);
        simpleRamp.rotation.x = -angle;
        simpleRamp.position.y = h / 2;
        simpleRamp.position.z = s / 2;
        simpleRamp.bakeCurrentTransformIntoVertices();
        simpleRamp.material = this.materials["road"];
        simpleRamp.isVisible = false;

        new PhysicsAggregate(simpleRamp, PhysicsShapeType.BOX, { mass: 0, restitution: 0.1, friction: 0.8 }, this.scene);
        this.baseMeshes["ramp"] = simpleRamp;

        const checkpoint = MeshBuilder.CreateBox("base_checkpoint", { width: s, depth: s, height: 0.5 }, this.scene);
        checkpoint.material = this.materials["checkpoint"];
        checkpoint.isVisible = false;
        new PhysicsAggregate(checkpoint, PhysicsShapeType.BOX, { mass: 0, restitution: 0.1, friction: 0.8 }, this.scene);
        this.baseMeshes["checkpoint"] = checkpoint;
    }

    public createInstance(type: string, x: number, y: number, z: number, rotationDeg: number): InstancedMesh {
        const baseMesh = this.baseMeshes[type];
        if (!baseMesh) {
            console.warn(`Block type '${type}' not found in registry.`);
            return this.createInstance("straight", x, y, z, rotationDeg); // Fallback
        }

        const instance = baseMesh.createInstance(`inst_${type}_${x}_${y}_${z}`);

        instance.position = new Vector3(
            x * BlockRegistry.GRID_SIZE,
            y * BlockRegistry.HEIGHT_STEP,
            z * BlockRegistry.GRID_SIZE
        );

        instance.rotation.y = rotationDeg * (Math.PI / 180);

        // Instance physics handling
        new PhysicsAggregate(instance, PhysicsShapeType.BOX, { mass: 0, restitution: 0.1, friction: 0.8 }, this.scene);

        return instance;
    }

    public createCheckpointVolume(x: number, y: number, z: number, rotationDeg: number): Mesh {
        const s = BlockRegistry.GRID_SIZE;
        const volume = MeshBuilder.CreateBox(`check_vol_${x}_${y}_${z}`, { width: s, depth: 1, height: s }, this.scene);
        volume.position = new Vector3(
            x * s,
            y * BlockRegistry.HEIGHT_STEP + (s / 2),
            z * s
        );
        volume.rotation.y = rotationDeg * (Math.PI / 180);
        volume.material = this.materials["checkpoint"];
        volume.isVisible = false;

        new PhysicsAggregate(volume, PhysicsShapeType.BOX, { mass: 0 }, this.scene);
        return volume;
    }
}