import { MeshBuilder, StandardMaterial, Color3, Scene, Vector3, Mesh, InstancedMesh, TransformNode } from "@babylonjs/core";
import { PhysicsAggregate, PhysicsShapeType } from "@babylonjs/core/Physics/v2";

export class BlockRegistry {
    public static readonly GRID_SIZE = 14;
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

        const borderMat = new StandardMaterial("borderMat", this.scene);
        borderMat.diffuseColor = new Color3(0.9, 0.9, 0.9);

        const trimMat = new StandardMaterial("trimMat", this.scene);
        trimMat.diffuseColor = new Color3(0.1, 0.1, 0.1);
        trimMat.zOffset = -1; // Pull trim forward slightly in depth buffer to prevent z-fighting with overlapping rails at corners

        const startMat = new StandardMaterial("startMat", this.scene);
        startMat.diffuseColor = new Color3(0.3, 0.9, 0.3);

        const finishMat = new StandardMaterial("finishMat", this.scene);
        finishMat.diffuseColor = new Color3(0.9, 0.3, 0.3);

        const checkMat = new StandardMaterial("checkpoint", this.scene);
        checkMat.diffuseColor = new Color3(0.3, 0.5, 0.9);
        checkMat.alpha = 0.5;

        const boostMat = new StandardMaterial("boostMat", this.scene);
        boostMat.diffuseColor = new Color3(1.0, 0.6, 0.0);
        boostMat.emissiveColor = new Color3(0.8, 0.4, 0.0);
        boostMat.alpha = 0.9;

        this.materials["road"] = roadMat;
        this.materials["border"] = borderMat;
        this.materials["trim"] = trimMat;
        this.materials["start"] = startMat;
        this.materials["finish"] = finishMat;
        this.materials["checkpoint"] = checkMat;
        this.materials["boost"] = boostMat;
    }

    public initializeBaseMeshes(): void {
        const s = BlockRegistry.GRID_SIZE;
        const h = BlockRegistry.HEIGHT_STEP;
        const floorThickness = 0.1; // Thinner floor to minimize gaps at ramp hinges

        // --- Core Track Blocks ---

        const straight = MeshBuilder.CreateBox("base_straight", { width: s, depth: s, height: floorThickness }, this.scene);
        straight.position.y = floorThickness / 2; // Bottom sits exactly at Y=0
        straight.bakeCurrentTransformIntoVertices();
        straight.material = this.materials["road"];
        straight.isVisible = false;
        this.baseMeshes["straight"] = straight;

        const start = MeshBuilder.CreateBox("base_start", { width: s, depth: s, height: floorThickness }, this.scene);
        start.position.y = floorThickness / 2;
        start.bakeCurrentTransformIntoVertices();
        start.material = this.materials["start"];
        start.isVisible = false;
        this.baseMeshes["start"] = start;

        const finish = MeshBuilder.CreateBox("base_finish", { width: s, depth: s, height: floorThickness }, this.scene);
        finish.position.y = floorThickness / 2;
        finish.bakeCurrentTransformIntoVertices();
        finish.material = this.materials["finish"];
        finish.isVisible = false;
        this.baseMeshes["finish"] = finish;

        // Create a rounded 90-degree curve using Ribbon
        const path1: Vector3[] = [];
        const path2: Vector3[] = [];
        const innerR = 0;
        const outerR = s;
        for(let i=0; i<=24; i++) {
            // Exactly PI down to PI/2 to ensure flush seams without overlapping/colliding into adjacent flat blocks
            const angle = Math.PI - (i / 24) * (Math.PI / 2);
            const px1 = s/2 + innerR * Math.cos(angle);
            const pz1 = -s/2 + innerR * Math.sin(angle);
            const px2 = s/2 + outerR * Math.cos(angle);
            const pz2 = -s/2 + outerR * Math.sin(angle);
            path1.push(new Vector3(px1, floorThickness, pz1));
            path2.push(new Vector3(px2, floorThickness, pz2));
        }
        const turn = MeshBuilder.CreateRibbon("base_turn", { pathArray: [path1, path2], sideOrientation: Mesh.DOUBLESIDE }, this.scene);
        turn.bakeCurrentTransformIntoVertices();
        turn.material = this.materials["road"];
        turn.isVisible = false;
        this.baseMeshes["turn"] = turn;

        // Ramp (Slope)
        // Perfectly hinge at (0,0,-s/2) and slope up to (0,h,s/2).
        const angle = Math.atan2(h, s);
        // We build a solid enclosed volume using Ribbon with 4 paths wrapping around the slope.
        // This ensures the ramp has physical depth (`floorThickness`) which is required for reliable
        // `InstancedMesh` and `PhysicsShapeType.MESH` generation without silent invisible failures.
        const rampBottomFront = [new Vector3(-s/2, 0, -s/2), new Vector3(s/2, 0, -s/2)];
        const rampTopFront = [new Vector3(-s/2, floorThickness, -s/2), new Vector3(s/2, floorThickness, -s/2)];
        const rampTopBack = [new Vector3(-s/2, h + floorThickness, s/2), new Vector3(s/2, h + floorThickness, s/2)];
        const rampBottomBack = [new Vector3(-s/2, h, s/2), new Vector3(s/2, h, s/2)];

        // `closePath: true` wraps the final path back to the first path, closing the bottom floor
        const simpleRamp = MeshBuilder.CreateRibbon("base_ramp", {
            pathArray: [rampBottomFront, rampTopFront, rampTopBack, rampBottomBack],
            closePath: true,
            sideOrientation: Mesh.DOUBLESIDE
        }, this.scene);

        simpleRamp.bakeCurrentTransformIntoVertices();
        simpleRamp.material = this.materials["road"];
        simpleRamp.isVisible = false;

        this.baseMeshes["ramp"] = simpleRamp;

        const checkpoint = MeshBuilder.CreateBox("base_checkpoint", { width: s, depth: s, height: floorThickness }, this.scene);
        checkpoint.position.y = floorThickness / 2;
        checkpoint.bakeCurrentTransformIntoVertices();
        checkpoint.material = this.materials["road"];
        checkpoint.isVisible = false;
        this.baseMeshes["checkpoint"] = checkpoint;

        // --- Walls & Borders (Spawned conditionally on exposed edges) ---
        // A wall sits ON the edge of a block.
        // If a block is at (0,0,0) with size 10x10, its "Right" edge is at X = 5.
        // We build the generic wall mesh to be centered at (0,0,0) and we'll translate it when spawning.
        const wallThickness = 0.6;  // Thicker barrier to prevent high-speed snagging at exact boundary
        const wallHeight = 1.0;

        // Flat Wall
        const flatWallRail = MeshBuilder.CreateBox("wall_rail", { width: wallThickness, depth: s + 0.12, height: wallHeight }, this.scene);
        flatWallRail.position.y = wallHeight / 2;
        flatWallRail.material = this.materials["border"];

        // Dark corner posts to hide seams
        const postZ1 = MeshBuilder.CreateBox("post1", { width: wallThickness * 0.8, depth: wallThickness * 0.8, height: wallHeight + 0.05 }, this.scene);
        postZ1.position.y = (wallHeight + 0.05) / 2;
        postZ1.position.z = s / 2;
        postZ1.material = this.materials["trim"];

        const postZ2 = MeshBuilder.CreateBox("post2", { width: wallThickness * 0.8, depth: wallThickness * 0.8, height: wallHeight + 0.05 }, this.scene);
        postZ2.position.y = (wallHeight + 0.05) / 2;
        postZ2.position.z = -s / 2;
        postZ2.material = this.materials["trim"];

        const flatWall = Mesh.MergeMeshes([flatWallRail, postZ1, postZ2], true, true, undefined, false, true)!;
        flatWall.name = "wall_flat";
        flatWall.isVisible = false;
        this.wallMeshes["flat"] = flatWall;

        // Sloped Wall for Ramps
        const rampDepth = Math.sqrt(s*s + h*h);
        const slopedWallRail = MeshBuilder.CreateBox("wall_rail_ramp", { width: wallThickness, depth: rampDepth + 0.08, height: wallHeight }, this.scene);
        slopedWallRail.position.y = wallHeight / 2;
        slopedWallRail.material = this.materials["border"];

        const slopedWall = Mesh.MergeMeshes([slopedWallRail], true, true, undefined, false, true)!;
        slopedWall.rotation.x = -angle;
        slopedWall.position.y = h / 2 + floorThickness; // Adjust for the new Ribbon ramp height
        slopedWall.bakeCurrentTransformIntoVertices();

        slopedWall.name = "wall_ramp";
        slopedWall.isVisible = false;
        this.wallMeshes["ramp"] = slopedWall;

        // --- Boost Pad ---
        // Flat pad with a raised center arrow shape. Sits on top of a straight block.
        const boostPadBase = MeshBuilder.CreateBox("base_boostBase", { width: s, depth: s, height: floorThickness }, this.scene);
        boostPadBase.position.y = floorThickness / 2;
        boostPadBase.bakeCurrentTransformIntoVertices();
        boostPadBase.material = this.materials["road"];
        boostPadBase.isVisible = false;
        this.baseMeshes["boost"] = boostPadBase;  // Boost pad uses the same base as straight

        // Boost pad visual marker - an orange glowing pad
        const padWidth = s * 0.6;
        const padDepth = s * 0.3;
        const boostPadVisual = MeshBuilder.CreateBox("base_boostVisual", { width: padWidth, depth: padDepth, height: 0.15 }, this.scene);
        boostPadVisual.position.y = floorThickness + 0.075;
        boostPadVisual.bakeCurrentTransformIntoVertices();
        boostPadVisual.material = this.materials["boost"];
        boostPadVisual.isVisible = false;
        this.baseMeshes["boostVisual"] = boostPadVisual;

        // Curved Walls for Turns
        const innerWallPathBottom: Vector3[] = [];
        const innerWallPathTop: Vector3[] = [];
        const outerWallPathBottom: Vector3[] = [];
        const outerWallPathTop: Vector3[] = [];
        for(let i=0; i<=24; i++) {
            const angle = Math.PI - (i / 24) * (Math.PI / 2);

            // Inner wall (radius 0)
            const ir = innerR;
            const px_in = s/2 + ir * Math.cos(angle);
            const pz_in = -s/2 + ir * Math.sin(angle);
            innerWallPathBottom.push(new Vector3(px_in, 0, pz_in));
            innerWallPathTop.push(new Vector3(px_in, wallHeight, pz_in));

            // Outer wall (radius s)
            const or = outerR;
            const px_out = s/2 + or * Math.cos(angle);
            const pz_out = -s/2 + or * Math.sin(angle);
            outerWallPathBottom.push(new Vector3(px_out, 0, pz_out));
            outerWallPathTop.push(new Vector3(px_out, wallHeight, pz_out));
        }

        const innerWallTurn = MeshBuilder.CreateRibbon("wall_turn_inner", { pathArray: [innerWallPathBottom, innerWallPathTop], sideOrientation: Mesh.DOUBLESIDE }, this.scene);
        innerWallTurn.material = this.materials["border"];
        innerWallTurn.bakeCurrentTransformIntoVertices();
        innerWallTurn.isVisible = false;
        this.wallMeshes["turn_inner"] = innerWallTurn;

        const outerWallTurn = MeshBuilder.CreateRibbon("wall_turn_outer", { pathArray: [outerWallPathBottom, outerWallPathTop], sideOrientation: Mesh.DOUBLESIDE }, this.scene);
        outerWallTurn.material = this.materials["border"];
        outerWallTurn.bakeCurrentTransformIntoVertices();
        outerWallTurn.isVisible = false;
        this.wallMeshes["turn_outer"] = outerWallTurn;
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

        const shapeType = (type === "turn" || type === "ramp") ? PhysicsShapeType.MESH : PhysicsShapeType.BOX;
        new PhysicsAggregate(instance, shapeType, { mass: 0, restitution: 0.1, friction: 0.8 }, this.scene);

        return instance;
    }

    /**
     * Spawns a wall instance on a specific local edge of a block.
     * edge: "left", "right", "forward", "backward"
     */
    public createWallInstance(x: number, y: number, z: number, blockRotationDeg: number, localEdge: string, blockType: string): InstancedMesh | null {
        let wallType = "flat";
        if (blockType === "ramp" && (localEdge === "left" || localEdge === "right")) {
            wallType = "ramp";
        } else if (blockType === "turn") {
            // Right turn (entrance South, exit East)
            // Inner curve is on the right side (+X edge), Outer curve covers Left (-X) and Forward (+Z).
            // "backward" (-Z) is the open entrance.
            if (localEdge === "right") wallType = "turn_inner";
            if (localEdge === "left" || localEdge === "forward") wallType = "turn_outer";

            // Outer curve actually covers both 'left' and 'forward' edges inherently.
            // To prevent creating exact duplicate walls when both edges are requested by TrackParser,
            // we will only spawn "turn_outer" once (e.g., when 'left' is called).
            if (localEdge === "forward") return null;
            if (localEdge === "backward") return null; // No wall on entrance edge, it's open
        }
        const baseWall = this.wallMeshes[wallType];
        if (!baseWall) return null;

        const instance = baseWall.createInstance(`wall_${x}_${y}_${z}_${localEdge}`);

        const s = BlockRegistry.GRID_SIZE;
        const offset = s / 2;

        // Create a dummy node representing the center of the block
        const blockNode = new TransformNode("dummy", this.scene);
        blockNode.position = new Vector3(x * s, y * BlockRegistry.HEIGHT_STEP, z * s);
        blockNode.rotation.y = blockRotationDeg * (Math.PI / 180);

        // Parent the wall to the block, apply local offset/rotation, then bake to world.
        instance.parent = blockNode;

        if (blockType === "turn") {
            // The turn wall meshes are already built perfectly relative to the block center.
            // But wait, the outer curve covers TWO edges (left and forward). If both are exposed,
            // spawning "turn_outer" once covers BOTH. If we spawn it twice, we get duplicates.
            // For now, let's just let it be duplicate exactly on top of each other, or offset correctly.
            // Let's just snap it to the center.
            instance.position.set(0, 0, 0);
            instance.rotation.y = 0;
        } else {
            switch (localEdge) {
                case "right":
                    instance.position.x = offset;
                    instance.rotation.y = 0;
                    break;
                case "left":
                    instance.position.x = -offset;
                    instance.rotation.y = 0;
                    break;
                case "forward":
                    instance.position.z = offset;
                    instance.rotation.y = Math.PI / 2;
                    break;
                case "backward":
                    instance.position.z = -offset;
                    instance.rotation.y = Math.PI / 2;
                    break;
            }
        }

        instance.computeWorldMatrix(true);

        // Remove parent and keep absolute position/rotation
        instance.setParent(null);
        blockNode.dispose();

        const wallShapeType = (wallType === "ramp" || wallType === "turn_inner" || wallType === "turn_outer") ? PhysicsShapeType.MESH : PhysicsShapeType.BOX;
        new PhysicsAggregate(instance, wallShapeType, { mass: 0, restitution: 0.0, friction: 0.0 }, this.scene);

        return instance;
    }

    /**
     * Creates a boost pad at the given grid position.
     * Returns the visual mesh for the boost pad (position tracking uses distance in App.ts).
     */
    public createBoostInstance(x: number, y: number, z: number, rotationDeg: number): { floor: InstancedMesh, visual: InstancedMesh } {
        const s = BlockRegistry.GRID_SIZE;
        const h = BlockRegistry.HEIGHT_STEP;

        // Create floor instance (same as straight)
        const floor = this.createInstance("straight", x, y, z, rotationDeg);

        // Create visual boost pad
        const visualBase = this.baseMeshes["boostVisual"];
        const visual = visualBase.createInstance(`boost_vis_${x}_${y}_${z}`);
        visual.position = new Vector3(
            x * s,
            y * h + 0.15, // Slightly above road surface
            z * s
        );
        visual.rotation.y = rotationDeg * (Math.PI / 180);
        visual.isVisible = true;

        return { floor, visual };
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

        // new PhysicsAggregate(volume, PhysicsShapeType.BOX, { mass: 0 }, this.scene); // REMOVED to prevent invisible walls. Collision relies on manual distance checks in App.ts.
        return volume;
    }
}