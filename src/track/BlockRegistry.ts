import { MeshBuilder, StandardMaterial, Color3, Scene, Vector3, Mesh, InstancedMesh, TransformNode } from "@babylonjs/core";
import { PhysicsAggregate, PhysicsShapeType } from "@babylonjs/core/Physics/v2";
import { BlockMetadata } from "./TrackSchema";

export class BlockRegistry {
    public static readonly GRID_SIZE = 14;
    public static readonly HEIGHT_STEP = 2;

    public static readonly blockMetadata: { [key: string]: BlockMetadata } = {
        "straight": { category: "flat", elevationChange: 0, bankAngle: 0, wallBehavior: "flat", collisionHint: "box" },
        "start": { category: "flat", elevationChange: 0, bankAngle: 0, wallBehavior: "flat", collisionHint: "box" },
        "finish": { category: "flat", elevationChange: 0, bankAngle: 0, wallBehavior: "flat", collisionHint: "box" },
        "checkpoint": { category: "flat", elevationChange: 0, bankAngle: 0, wallBehavior: "flat", collisionHint: "box" },
        "turn": { category: "curve", elevationChange: 0, bankAngle: 0, wallBehavior: "curved", collisionHint: "mesh" },
        "ramp": { category: "ramp", elevationChange: 1, bankAngle: 0, wallBehavior: "sloped", collisionHint: "convex_hull" },

        // New block types
        "ramp_low": { category: "ramp", elevationChange: 0.5, bankAngle: 0, wallBehavior: "sloped", collisionHint: "convex_hull" },
        "ramp_steep": { category: "ramp", elevationChange: 2, bankAngle: 0, wallBehavior: "sloped", collisionHint: "convex_hull" },
        "turn_banked_right": { category: "banked", elevationChange: 0, bankAngle: 30, wallBehavior: "curved", collisionHint: "mesh" },
        "turn_banked_left": { category: "banked", elevationChange: 0, bankAngle: -30, wallBehavior: "curved", collisionHint: "mesh" },
        "loop_base": { category: "stunt", elevationChange: 0, bankAngle: 0, wallBehavior: "none", collisionHint: "mesh", supportsInvert: true }
    };


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
            // Extend the curve slightly beyond PI and PI/2 to overlap adjacent blocks
            const angle = (Math.PI + 0.05) - (i / 24) * (Math.PI / 2 + 0.1); // PI down to PI/2
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
        const rampPath1: Vector3[] = [
            new Vector3(-s/2, 0, -s/2),
            new Vector3(-s/2, h, s/2)
        ];
        const rampPath2: Vector3[] = [
            new Vector3(s/2, 0, -s/2),
            new Vector3(s/2, h, s/2)
        ];

        // Ribbon creates perfectly precise corners eliminating lip/snagging
        const simpleRamp = MeshBuilder.CreateRibbon("base_ramp", { pathArray: [rampPath1, rampPath2], sideOrientation: Mesh.DOUBLESIDE }, this.scene);
        // Add floor thickness offset to match straight block top surface (which is shifted by floorThickness/2, wait, CreateBox puts center at Y=floorThickness/2, so top is floorThickness)
        // For Ribbon, it builds EXACTLY where paths are. So we lift it by floorThickness.
        simpleRamp.position.y = floorThickness;
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

        // --- Low Ramp (Slope up 0.5 h over s) ---
        const hLow = h * 0.5;
        const rampDepthLow = Math.sqrt(s*s + hLow*hLow);
        const lowRamp = MeshBuilder.CreateBox("base_ramp_low", { width: s, depth: rampDepthLow, height: floorThickness }, this.scene);
        const angleLow = Math.atan2(hLow, s);
        lowRamp.rotation.x = -angleLow;
        lowRamp.position.y = hLow / 2;
        lowRamp.bakeCurrentTransformIntoVertices();
        lowRamp.material = this.materials["road"];
        lowRamp.isVisible = false;
        this.baseMeshes["ramp_low"] = lowRamp;

        // --- Steep Ramp (Slope up 2.0 h over s) ---
        const hSteep = h * 2.0;
        const rampDepthSteep = Math.sqrt(s*s + hSteep*hSteep);
        const steepRamp = MeshBuilder.CreateBox("base_ramp_steep", { width: s, depth: rampDepthSteep, height: floorThickness }, this.scene);
        const angleSteep = Math.atan2(hSteep, s);
        steepRamp.rotation.x = -angleSteep;
        steepRamp.position.y = hSteep / 2;
        steepRamp.bakeCurrentTransformIntoVertices();
        steepRamp.material = this.materials["road"];
        steepRamp.isVisible = false;
        this.baseMeshes["ramp_steep"] = steepRamp;

        // --- Banked Turn Right (30 deg inward slant) ---
        // A right turn goes from -Z to +X. Inner radius is on the right.
        const pathBR1: Vector3[] = [];
        const pathBR2: Vector3[] = [];
        const bankAngle = 30 * (Math.PI / 180);
        // We slant the floor. At outer radius, it's higher. At inner radius, it's floorThickness.
        // Outer radius = s, Inner radius = 0. Width = s.
        // Height difference = s * Math.tan(bankAngle)
        const bankHeight = s * Math.tan(bankAngle);

        for(let i=0; i<=24; i++) {
            const angle = (Math.PI + 0.05) - (i / 24) * (Math.PI / 2 + 0.1); // PI down to PI/2
            const px1 = s/2 + innerR * Math.cos(angle);
            const pz1 = -s/2 + innerR * Math.sin(angle);
            // inner is flush with ground
            const py1 = floorThickness;

            const px2 = s/2 + outerR * Math.cos(angle);
            const pz2 = -s/2 + outerR * Math.sin(angle);
            // outer is raised
            const py2 = floorThickness + bankHeight;

            pathBR1.push(new Vector3(px1, py1, pz1));
            pathBR2.push(new Vector3(px2, py2, pz2));
        }
        const bankedTurnRight = MeshBuilder.CreateRibbon("base_turn_banked_right", { pathArray: [pathBR1, pathBR2], sideOrientation: Mesh.DOUBLESIDE }, this.scene);
        bankedTurnRight.bakeCurrentTransformIntoVertices();
        bankedTurnRight.material = this.materials["road"];
        bankedTurnRight.isVisible = false;
        this.baseMeshes["turn_banked_right"] = bankedTurnRight;

        // --- Banked Turn Left (-30 deg slant) ---
        // We reuse the geometry but scale x by -1, and fix winding by baking.
        const pathBL1: Vector3[] = [];
        const pathBL2: Vector3[] = [];
        for(let i=0; i<=24; i++) {
            const angle = (Math.PI + 0.05) - (i / 24) * (Math.PI / 2 + 0.1);
            // Invert the x coordinates
            const px1 = -(s/2 + innerR * Math.cos(angle));
            const pz1 = -s/2 + innerR * Math.sin(angle);
            const py1 = floorThickness;

            const px2 = -(s/2 + outerR * Math.cos(angle));
            const pz2 = -s/2 + outerR * Math.sin(angle);
            const py2 = floorThickness + bankHeight;

            // To fix winding order since we mirrored x, we need to push to pathBL2 first, then BL1,
            // or just let Babylon handle DOUBLESIDE
            pathBL1.push(new Vector3(px1, py1, pz1));
            pathBL2.push(new Vector3(px2, py2, pz2));
        }
        const bankedTurnLeft = MeshBuilder.CreateRibbon("base_turn_banked_left", { pathArray: [pathBL1, pathBL2], sideOrientation: Mesh.DOUBLESIDE }, this.scene);
        bankedTurnLeft.bakeCurrentTransformIntoVertices();
        bankedTurnLeft.material = this.materials["road"];
        bankedTurnLeft.isVisible = false;
        this.baseMeshes["turn_banked_left"] = bankedTurnLeft;

        // --- Loop Groundwork ---
        // Just a placeholder flat plane that flips upside down.
        // This is purely for future expansion and not meant to be heavily used yet.
        const loopBase = MeshBuilder.CreateBox("base_loop_base", { width: s, depth: s, height: floorThickness }, this.scene);
        loopBase.position.y = floorThickness / 2;
        loopBase.bakeCurrentTransformIntoVertices();
        loopBase.material = this.materials["road"];
        loopBase.isVisible = false;
        this.baseMeshes["loop_base"] = loopBase;



        // --- Walls & Borders (Spawned conditionally on exposed edges) ---
        // A wall sits ON the edge of a block.
        // If a block is at (0,0,0) with size 10x10, its "Right" edge is at X = 5.
        // We build the generic wall mesh to be centered at (0,0,0) and we'll translate it when spawning.
        const wallThickness = 0.4;
        const wallHeight = 1.0;

        // Flat Wall
        const flatWallRail = MeshBuilder.CreateBox("wall_rail", { width: wallThickness, depth: s + 0.1, height: wallHeight }, this.scene);
        flatWallRail.position.y = wallHeight / 2;
        flatWallRail.material = this.materials["border"];

        // Dark corner posts to hide seams
        const postZ1 = MeshBuilder.CreateBox("post1", { width: wallThickness * 0.8, depth: wallThickness * 0.8, height: wallHeight }, this.scene);
        postZ1.position.y = wallHeight / 2;
        postZ1.position.z = s / 2;
        postZ1.material = this.materials["trim"];

        const postZ2 = MeshBuilder.CreateBox("post2", { width: wallThickness * 0.8, depth: wallThickness * 0.8, height: wallHeight }, this.scene);
        postZ2.position.y = wallHeight / 2;
        postZ2.position.z = -s / 2;
        postZ2.material = this.materials["trim"];

        const flatWall = Mesh.MergeMeshes([flatWallRail, postZ1, postZ2], true, true, undefined, false, true)!;
        flatWall.name = "wall_flat";
        flatWall.isVisible = false;
        this.wallMeshes["flat"] = flatWall;

        // Sloped Wall for Ramps
        const rampDepth = Math.sqrt(s*s + h*h);
        const slopedWallRail = MeshBuilder.CreateBox("wall_rail_ramp", { width: wallThickness, depth: rampDepth + 0.1, height: wallHeight }, this.scene);
        slopedWallRail.position.y = wallHeight / 2;
        slopedWallRail.material = this.materials["border"];

        const slopedWall = Mesh.MergeMeshes([slopedWallRail], true, true, undefined, false, true)!;
        slopedWall.rotation.x = -angle;
        slopedWall.position.y = h / 2 + floorThickness; // Adjust for the new Ribbon ramp height
        slopedWall.bakeCurrentTransformIntoVertices();

        slopedWall.name = "wall_ramp";
        slopedWall.isVisible = false;
        this.wallMeshes["ramp"] = slopedWall;

        // --- Low Ramp Wall ---
        const slopedWallRailLow = MeshBuilder.CreateBox("wall_rail_ramp_low", { width: wallThickness, depth: rampDepthLow + 0.1, height: wallHeight }, this.scene);
        slopedWallRailLow.position.y = wallHeight / 2;
        slopedWallRailLow.material = this.materials["border"];
        const slopedWallLow = Mesh.MergeMeshes([slopedWallRailLow], true, true, undefined, false, true)!;
        slopedWallLow.rotation.x = -angleLow;
        slopedWallLow.position.y = hLow / 2;
        slopedWallLow.bakeCurrentTransformIntoVertices();
        slopedWallLow.name = "wall_ramp_low";
        slopedWallLow.isVisible = false;
        this.wallMeshes["ramp_low"] = slopedWallLow;

        // --- Steep Ramp Wall ---
        const slopedWallRailSteep = MeshBuilder.CreateBox("wall_rail_ramp_steep", { width: wallThickness, depth: rampDepthSteep + 0.1, height: wallHeight }, this.scene);
        slopedWallRailSteep.position.y = wallHeight / 2;
        slopedWallRailSteep.material = this.materials["border"];
        const slopedWallSteep = Mesh.MergeMeshes([slopedWallRailSteep], true, true, undefined, false, true)!;
        slopedWallSteep.rotation.x = -angleSteep;
        slopedWallSteep.position.y = hSteep / 2;
        slopedWallSteep.bakeCurrentTransformIntoVertices();
        slopedWallSteep.name = "wall_ramp_steep";
        slopedWallSteep.isVisible = false;
        this.wallMeshes["ramp_steep"] = slopedWallSteep;


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

        // --- Banked Turn Right Walls ---
        const innerBRBottom: Vector3[] = [];
        const innerBRTop: Vector3[] = [];
        const outerBRBottom: Vector3[] = [];
        const outerBRTop: Vector3[] = [];
        for(let i=0; i<=24; i++) {
            const angle = Math.PI - (i / 24) * (Math.PI / 2);

            const px_in = s/2 + innerR * Math.cos(angle);
            const pz_in = -s/2 + innerR * Math.sin(angle);
            innerBRBottom.push(new Vector3(px_in, floorThickness, pz_in));
            innerBRTop.push(new Vector3(px_in, floorThickness + wallHeight, pz_in));

            const px_out = s/2 + outerR * Math.cos(angle);
            const pz_out = -s/2 + outerR * Math.sin(angle);
            const py_out = floorThickness + bankHeight;
            outerBRBottom.push(new Vector3(px_out, py_out, pz_out));
            outerBRTop.push(new Vector3(px_out, py_out + wallHeight, pz_out));
        }

        const innerWallBankedRight = MeshBuilder.CreateRibbon("wall_turn_banked_right_inner", { pathArray: [innerBRBottom, innerBRTop], sideOrientation: Mesh.DOUBLESIDE }, this.scene);
        innerWallBankedRight.material = this.materials["border"];
        innerWallBankedRight.bakeCurrentTransformIntoVertices();
        innerWallBankedRight.isVisible = false;
        this.wallMeshes["turn_banked_right_inner"] = innerWallBankedRight;

        const outerWallBankedRight = MeshBuilder.CreateRibbon("wall_turn_banked_right_outer", { pathArray: [outerBRBottom, outerBRTop], sideOrientation: Mesh.DOUBLESIDE }, this.scene);
        outerWallBankedRight.material = this.materials["border"];
        outerWallBankedRight.bakeCurrentTransformIntoVertices();
        outerWallBankedRight.isVisible = false;
        this.wallMeshes["turn_banked_right_outer"] = outerWallBankedRight;

        // --- Banked Turn Left Walls ---
        const innerBLBottom: Vector3[] = [];
        const innerBLTop: Vector3[] = [];
        const outerBLBottom: Vector3[] = [];
        const outerBLTop: Vector3[] = [];
        for(let i=0; i<=24; i++) {
            const angle = Math.PI - (i / 24) * (Math.PI / 2);

            const px_in = -(s/2 + innerR * Math.cos(angle));
            const pz_in = -s/2 + innerR * Math.sin(angle);
            innerBLBottom.push(new Vector3(px_in, floorThickness, pz_in));
            innerBLTop.push(new Vector3(px_in, floorThickness + wallHeight, pz_in));

            const px_out = -(s/2 + outerR * Math.cos(angle));
            const pz_out = -s/2 + outerR * Math.sin(angle);
            const py_out = floorThickness + bankHeight;
            outerBLBottom.push(new Vector3(px_out, py_out, pz_out));
            outerBLTop.push(new Vector3(px_out, py_out + wallHeight, pz_out));
        }

        const innerWallBankedLeft = MeshBuilder.CreateRibbon("wall_turn_banked_left_inner", { pathArray: [innerBLBottom, innerBLTop], sideOrientation: Mesh.DOUBLESIDE }, this.scene);
        innerWallBankedLeft.material = this.materials["border"];
        innerWallBankedLeft.bakeCurrentTransformIntoVertices();
        innerWallBankedLeft.isVisible = false;
        this.wallMeshes["turn_banked_left_inner"] = innerWallBankedLeft;

        const outerWallBankedLeft = MeshBuilder.CreateRibbon("wall_turn_banked_left_outer", { pathArray: [outerBLBottom, outerBLTop], sideOrientation: Mesh.DOUBLESIDE }, this.scene);
        outerWallBankedLeft.material = this.materials["border"];
        outerWallBankedLeft.bakeCurrentTransformIntoVertices();
        outerWallBankedLeft.isVisible = false;
        this.wallMeshes["turn_banked_left_outer"] = outerWallBankedLeft;

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

        const meta = BlockRegistry.blockMetadata[type] || BlockRegistry.blockMetadata["straight"];
        let shapeType = PhysicsShapeType.BOX;
        if (meta.collisionHint === "mesh") shapeType = PhysicsShapeType.MESH;
        else if (meta.collisionHint === "convex_hull") shapeType = PhysicsShapeType.CONVEX_HULL;
        new PhysicsAggregate(instance, shapeType, { mass: 0, restitution: 0.1, friction: 0.8 }, this.scene);

        return instance;
    }

    /**
     * Spawns a wall instance on a specific local edge of a block.
     * edge: "left", "right", "forward", "backward"
     */
    public createWallInstance(x: number, y: number, z: number, blockRotationDeg: number, localEdge: string, blockType: string): InstancedMesh {
        let wallType = "flat";
        if ((blockType === "ramp" || blockType === "ramp_low" || blockType === "ramp_steep") && (localEdge === "left" || localEdge === "right")) {
            wallType = blockType;
        } else if (blockType === "turn") {
            if (localEdge === "right") wallType = "turn_inner";
            if (localEdge === "left" || localEdge === "forward") wallType = "turn_outer";
            if (localEdge === "backward") return null as any;
        } else if (blockType === "turn_banked_right") {
            if (localEdge === "right") wallType = "turn_banked_right_inner";
            if (localEdge === "left" || localEdge === "forward") wallType = "turn_banked_right_outer";
            if (localEdge === "backward") return null as any;
        } else if (blockType === "turn_banked_left") {
            if (localEdge === "left") wallType = "turn_banked_left_inner";
            if (localEdge === "right" || localEdge === "forward") wallType = "turn_banked_left_outer";
            if (localEdge === "backward") return null as any;
        }
        const baseWall = this.wallMeshes[wallType];
        if (!baseWall) return null as any;

        const instance = baseWall.createInstance(`wall_${x}_${y}_${z}_${localEdge}`);

        const s = BlockRegistry.GRID_SIZE;
        const offset = s / 2;

        // Create a dummy node representing the center of the block
        const blockNode = new TransformNode("dummy", this.scene);
        blockNode.position = new Vector3(x * s, y * BlockRegistry.HEIGHT_STEP, z * s);
        blockNode.rotation.y = blockRotationDeg * (Math.PI / 180);

        // Parent the wall to the block, apply local offset/rotation, then bake to world.
        instance.parent = blockNode;

        if (blockType === "turn" || blockType === "turn_banked_right" || blockType === "turn_banked_left") {
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

        const wallShapeType = (wallType.includes("ramp") || wallType.includes("turn")) ? PhysicsShapeType.MESH : PhysicsShapeType.BOX;
        new PhysicsAggregate(instance, wallShapeType, { mass: 0, restitution: 0.0, friction: 0.0 }, this.scene);

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

        // new PhysicsAggregate(volume, PhysicsShapeType.BOX, { mass: 0 }, this.scene); // REMOVED to prevent invisible walls. Collision relies on manual distance checks in App.ts.
        return volume;
    }
}