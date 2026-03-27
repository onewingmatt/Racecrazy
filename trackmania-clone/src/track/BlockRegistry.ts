import { MeshBuilder, StandardMaterial, Color3, Scene, Vector3, Mesh, InstancedMesh } from "@babylonjs/core";
import { PhysicsAggregate, PhysicsShapeType } from "@babylonjs/core/Physics/v2";

export class BlockRegistry {
    public static readonly GRID_SIZE = 10;
    public static readonly HEIGHT_STEP = 2;

    private readonly materials: { [key: string]: StandardMaterial } = {};
    private readonly baseMeshes: { [key: string]: Mesh } = {};
    private readonly wallMeshes: { [key: string]: Mesh } = {};

    constructor(private scene: Scene) {
        this.initializeMaterials();
    }

    private initializeMaterials(): void {
        const roadMat = new StandardMaterial("roadMat", this.scene);
        roadMat.diffuseColor = new Color3(0.25, 0.25, 0.25);

        // Wall/Border material - highly visible
        const borderMat = new StandardMaterial("borderMat", this.scene);
        borderMat.diffuseColor = new Color3(0.9, 0.9, 0.9); // White/light grey guardrail

        // Dark accent for bottom trim
        const trimMat = new StandardMaterial("trimMat", this.scene);
        trimMat.diffuseColor = new Color3(0.1, 0.1, 0.1);

        const startMat = new StandardMaterial("startMat", this.scene);
        startMat.diffuseColor = new Color3(0.3, 0.9, 0.3);

        const finishMat = new StandardMaterial("finishMat", this.scene);
        finishMat.diffuseColor = new Color3(0.9, 0.3, 0.3);

        const checkMat = new StandardMaterial("checkMat", this.scene);
        checkMat.diffuseColor = new Color3(0.3, 0.5, 0.9);
        checkMat.alpha = 0.5;

        this.materials["road"] = roadMat;
        this.materials["border"] = borderMat;
        this.materials["trim"] = trimMat;
        this.materials["start"] = startMat;
        this.materials["finish"] = finishMat;
        this.materials["checkpoint"] = checkMat;
    }

    public initializeBaseMeshes(): void {
        const s = BlockRegistry.GRID_SIZE;
        const h = BlockRegistry.HEIGHT_STEP;

        // --- Core Track Blocks (Flat, no built-in walls anymore to allow cohesive merging) ---

        const straight = MeshBuilder.CreateBox("base_straight", { width: s, depth: s, height: 0.5 }, this.scene);
        straight.material = this.materials["road"];
        straight.isVisible = false;
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

        // Ramp (Slope)
        const rampDepth = Math.sqrt(s*s + h*h);
        const simpleRamp = MeshBuilder.CreateBox("base_ramp", { width: s, depth: rampDepth, height: 0.5 }, this.scene);
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
        checkpoint.material = this.materials["road"]; // Road color, we use trigger volume for blue
        checkpoint.isVisible = false;
        new PhysicsAggregate(checkpoint, PhysicsShapeType.BOX, { mass: 0, restitution: 0.1, friction: 0.8 }, this.scene);
        this.baseMeshes["checkpoint"] = checkpoint;

        // --- Walls & Borders (Spawned conditionally on exposed edges) ---

        // Flat Wall (spans X axis, so it sits on the forward/backward edges if rotated, or left/right if not)
        // We will make a generic wall that sits on the +X edge (Right side).
        const wallThickness = 0.4;
        const wallHeight = 1.2;

        const flatWallRail = MeshBuilder.CreateBox("wall_rail", { width: wallThickness, depth: s, height: wallHeight }, this.scene);
        flatWallRail.position.y = wallHeight / 2;
        flatWallRail.material = this.materials["border"];

        const flatWallTrim = MeshBuilder.CreateBox("wall_trim", { width: wallThickness + 0.1, depth: s, height: 0.4 }, this.scene);
        flatWallTrim.position.y = 0.2;
        flatWallTrim.material = this.materials["trim"];

        const flatWall = Mesh.MergeMeshes([flatWallRail, flatWallTrim], true, true, undefined, false, true)!;
        flatWall.name = "wall_flat";
        flatWall.isVisible = false;
        new PhysicsAggregate(flatWall, PhysicsShapeType.BOX, { mass: 0, restitution: 0.1, friction: 0.8 }, this.scene);
        this.wallMeshes["flat"] = flatWall;

        // Sloped Wall for Ramps (sits on the +X edge of a ramp)
        const slopedWallRail = MeshBuilder.CreateBox("wall_rail_ramp", { width: wallThickness, depth: rampDepth, height: wallHeight }, this.scene);
        slopedWallRail.position.y = wallHeight / 2;
        slopedWallRail.material = this.materials["border"];

        const slopedWallTrim = MeshBuilder.CreateBox("wall_trim_ramp", { width: wallThickness + 0.1, depth: rampDepth, height: 0.4 }, this.scene);
        slopedWallTrim.position.y = 0.2;
        slopedWallTrim.material = this.materials["trim"];

        const slopedWall = Mesh.MergeMeshes([slopedWallRail, slopedWallTrim], true, true, undefined, false, true)!;
        slopedWall.rotation.x = -angle;
        slopedWall.position.y = h / 2;
        slopedWall.position.z = s / 2;
        slopedWall.bakeCurrentTransformIntoVertices();

        slopedWall.name = "wall_ramp";
        slopedWall.isVisible = false;
        new PhysicsAggregate(slopedWall, PhysicsShapeType.BOX, { mass: 0, restitution: 0.1, friction: 0.8 }, this.scene);
        this.wallMeshes["ramp"] = slopedWall;
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

        new PhysicsAggregate(instance, PhysicsShapeType.BOX, { mass: 0, restitution: 0.1, friction: 0.8 }, this.scene);

        return instance;
    }

    /**
     * Spawns a wall instance on a specific local edge of a block.
     * edge: "left", "right", "forward", "backward"
     * isRamp: true if the block is a ramp (uses sloped wall)
     */
    public createWallInstance(x: number, y: number, z: number, blockRotationDeg: number, localEdge: string, isRamp: boolean): InstancedMesh {
        const wallType = isRamp && (localEdge === "left" || localEdge === "right") ? "ramp" : "flat";
        const baseWall = this.wallMeshes[wallType];

        const instance = baseWall.createInstance(`wall_${x}_${y}_${z}_${localEdge}`);

        const s = BlockRegistry.GRID_SIZE;
        const offset = s / 2;

        // Start at block center
        instance.position = new Vector3(x * s, y * BlockRegistry.HEIGHT_STEP, z * s);

        // Determine local offset and rotation based on the edge requested
        // The base wall is designed to sit on the Right (+X) edge facing forward.
        let localPos = new Vector3(0, 0, 0);
        let localRotY = 0;

        switch (localEdge) {
            case "right":
                localPos.x = offset;
                localRotY = 0;
                break;
            case "left":
                localPos.x = -offset;
                // If it's a ramp, we need to flip it 180 on Y but keep the slope orientation?
                // Actually, our sloped wall is baked with rotation.x = -angle.
                // Rotating Y by 180 would invert the slope!
                // So for left wall on a ramp, it's just shifted -X, rotation stays 0.
                localRotY = 0;
                break;
            case "forward":
                localPos.z = offset;
                localRotY = -90;
                break;
            case "backward":
                localPos.z = -offset;
                localRotY = -90; // Or 90, doesn't matter for a flat symmetric wall
                break;
        }

        // Apply block's world rotation to the local offsets
        const rad = blockRotationDeg * (Math.PI / 180);
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        const worldOffsetX = localPos.x * cos + localPos.z * sin;
        const worldOffsetZ = -localPos.x * sin + localPos.z * cos;

        instance.position.x += worldOffsetX;
        instance.position.z += worldOffsetZ;

        // Add local wall rotation to block rotation
        instance.rotation.y = rad + (localRotY * (Math.PI / 180));

        new PhysicsAggregate(instance, PhysicsShapeType.BOX, { mass: 0, restitution: 0.1, friction: 0.8 }, this.scene);

        return instance;
    }

    public createCheckpointVolume(x: number, y: number, z: number, rotationDeg: number): Mesh {
        const s = BlockRegistry.GRID_SIZE;
        const volume = MeshBuilder.CreateBox(`check_vol_${x}_${y}_${z}`, { width: s, depth: 1, height: s + 4 }, this.scene);
        volume.position = new Vector3(
            x * s,
            y * BlockRegistry.HEIGHT_STEP + (s / 2) + 2,
            z * s
        );
        volume.rotation.y = rotationDeg * (Math.PI / 180);
        volume.material = this.materials["checkpoint"];
        volume.isVisible = false;

        new PhysicsAggregate(volume, PhysicsShapeType.BOX, { mass: 0 }, this.scene);
        return volume;
    }
}