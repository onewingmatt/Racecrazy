import { MeshBuilder, StandardMaterial, Color3, Scene, Vector3, Mesh, InstancedMesh } from "@babylonjs/core";
import { PhysicsAggregate, PhysicsShapeType } from "@babylonjs/core/Physics/v2";

export class BlockRegistry {
    public static readonly GRID_SIZE = 14;
    public static readonly HEIGHT_STEP = 2;

    private readonly materials: { [key: string]: StandardMaterial } = {};
    private readonly baseMeshes: { [key: string]: Mesh } = {};

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

    private createExtrudedBlock(name: string, path: Vector3[], roadMat: StandardMaterial): Mesh {
        const hw = (BlockRegistry.GRID_SIZE - 2) / 2;
        const curbW = 0.6;
        const railH = 1.0;
        
        const roadShape = [new Vector3(-hw, 0.1, 0), new Vector3(hw, 0.1, 0)];
        const leftWallShape = [
            new Vector3(-hw, 0.1, 0),
            new Vector3(-hw - curbW, 0.1, 0),
            new Vector3(-hw - curbW, railH, 0),
            new Vector3(-hw - curbW - 0.2, railH, 0),
            new Vector3(-hw - curbW - 0.2, 0, 0)
        ];
        const rightWallShape = [
            new Vector3(hw, 0.1, 0),
            new Vector3(hw + curbW, 0.1, 0),
            new Vector3(hw + curbW, railH, 0),
            new Vector3(hw + curbW + 0.2, railH, 0),
            new Vector3(hw + curbW + 0.2, 0, 0)
        ];

        const road = MeshBuilder.ExtrudeShape(name + "_road", { shape: roadShape, path: path, sideOrientation: Mesh.DOUBLESIDE, updatable: false }, this.scene);
        road.material = roadMat;
        
        const leftWall = MeshBuilder.ExtrudeShape(name + "_lwall", { shape: leftWallShape, path: path, sideOrientation: Mesh.DOUBLESIDE, updatable: false }, this.scene);
        leftWall.material = this.materials["border"];

        const rightWall = MeshBuilder.ExtrudeShape(name + "_rwall", { shape: rightWallShape, path: path, sideOrientation: Mesh.DOUBLESIDE, updatable: false }, this.scene);
        rightWall.material = this.materials["border"];

        const merged = Mesh.MergeMeshes([road, leftWall, rightWall], true, true, undefined, true, true);
        if (merged) merged.isVisible = false;
        return merged as Mesh;
    }

    /**
     * Creates a quarter-pipe block: flat on one side, arcs up to wall on the other.
     * Uses a gentle cosine ramp instead of a full quarter-circle to keep the
     * curve height manageable and compatible with twist-block transitions.
     */
    private createQuarterPipe(name: string, roadMat: StandardMaterial, curveRight: boolean): Mesh {
        const s = BlockRegistry.GRID_SIZE;
        const hw = (s - 2) / 2;  // road half-width (matches extruded blocks)
        const profileSteps = 10;
        const pathSteps = 8;
        const wallH = 2.5;  // gentle wall height

        const buildProfile = (zOffset: number): Vector3[] => {
            const profile: Vector3[] = [];
            if (curveRight) {
                // Flat left half
                const flatSteps = 5;
                for (let i = 0; i <= flatSteps; i++) {
                    const t = i / flatSteps;
                    profile.push(new Vector3(-hw + hw * 2 * t, 0, zOffset));
                }
                // Curved right half
                for (let i = 1; i <= profileSteps; i++) {
                    const t = i / profileSteps;
                    const angle = (Math.PI / 2) * t;
                    const x = hw + hw * Math.sin(angle);
                    const y = wallH * (1 - Math.cos(angle));
                    profile.push(new Vector3(x, y, zOffset));
                }
            } else {
                // Curved left half
                for (let i = profileSteps; i >= 0; i--) {
                    const t = i / profileSteps;
                    const angle = (Math.PI / 2) * t;
                    const x = -(hw + hw * Math.sin(angle));
                    const y = wallH * (1 - Math.cos(angle));
                    profile.push(new Vector3(x, y, zOffset));
                }
                // Flat right half
                const flatSteps = 5;
                for (let i = 1; i <= flatSteps; i++) {
                    const t = i / flatSteps;
                    profile.push(new Vector3(-hw + hw * 2 * t, 0, zOffset));
                }
            }
            return profile;
        };

        const pathArray: Vector3[][] = [];
        for (let i = 0; i <= pathSteps; i++) {
            const z = -hw + hw * 2 * (i / pathSteps);
            pathArray.push(buildProfile(z));
        }

        const mesh = MeshBuilder.CreateRibbon(name, {
            pathArray: pathArray,
            sideOrientation: Mesh.DOUBLESIDE,
            updatable: false
        }, this.scene);
        mesh.material = roadMat;
        mesh.isVisible = false;
        return mesh;
    }

    /**
     * Creates a half-pipe block with walls on BOTH sides.
     * The surface is flat in the center and arcs up to vertical walls on both edges.
     */
    private createHalfPipe(name: string, roadMat: StandardMaterial): Mesh {
        const s = BlockRegistry.GRID_SIZE;
        const hw = s / 2;
        const curveRadius = hw * 0.6;
        const flatWidth = hw - curveRadius;
        const profileSteps = 8;
        const pathSteps = 8;

        const buildProfile = (zOffset: number): Vector3[] => {
            const profile: Vector3[] = [];

            // Left wall curve (from edge to flat section)
            const leftCenter = -flatWidth;
            for (let i = 0; i <= profileSteps; i++) {
                const t = i / profileSteps;
                const angle = Math.PI + t * (Math.PI / 2);
                const x = leftCenter + curveRadius * Math.cos(angle);
                const y = curveRadius * Math.sin(angle);
                profile.push(new Vector3(x, y, zOffset));
            }

            // Flat section in the middle
            profile.push(new Vector3(flatWidth, 0, zOffset));

            // Right wall curve (from flat section to edge)
            const rightCenter = flatWidth;
            for (let i = 0; i <= profileSteps; i++) {
                const t = i / profileSteps;
                const angle = Math.PI - t * (Math.PI / 2);
                const x = rightCenter + curveRadius * Math.cos(angle);
                const y = curveRadius * Math.sin(angle);
                profile.push(new Vector3(x, y, zOffset));
            }

            return profile;
        };

        const pathArray: Vector3[][] = [];
        for (let i = 0; i <= pathSteps; i++) {
            const z = -hw + s * (i / pathSteps);
            pathArray.push(buildProfile(z));
        }

        const mesh = MeshBuilder.CreateRibbon(name, {
            pathArray: pathArray,
            sideOrientation: Mesh.DOUBLESIDE,
            updatable: false
        }, this.scene);

        mesh.material = roadMat;
        mesh.isVisible = false;
        return mesh;
    }

    private createExtrudedCustomBlock(name: string, path: Vector3[], roadMat: StandardMaterial, rotationFunc: (i: number, distance: number) => number): Mesh {
        const hw = (BlockRegistry.GRID_SIZE - 2) / 2;
        const curbW = 0.6;
        const railH = 1.0;
        
        const roadShape = [new Vector3(-hw, 0.1, 0), new Vector3(hw, 0.1, 0)];
        const leftWallShape = [
            new Vector3(-hw, 0.1, 0),
            new Vector3(-hw - curbW, 0.1, 0),
            new Vector3(-hw - curbW, railH, 0),
            new Vector3(-hw - curbW - 0.2, railH, 0),
            new Vector3(-hw - curbW - 0.2, 0, 0)
        ];
        const rightWallShape = [
            new Vector3(hw, 0.1, 0),
            new Vector3(hw + curbW, 0.1, 0),
            new Vector3(hw + curbW, railH, 0),
            new Vector3(hw + curbW + 0.2, railH, 0),
            new Vector3(hw + curbW + 0.2, 0, 0)
        ];

        const road = MeshBuilder.ExtrudeShapeCustom(name + "_road", { shape: roadShape, path: path, rotationFunction: rotationFunc, sideOrientation: Mesh.DOUBLESIDE, updatable: false }, this.scene);
        road.material = roadMat;
        
        const leftWall = MeshBuilder.ExtrudeShapeCustom(name + "_lwall", { shape: leftWallShape, path: path, rotationFunction: rotationFunc, sideOrientation: Mesh.DOUBLESIDE, updatable: false }, this.scene);
        leftWall.material = this.materials["border"];

        const rightWall = MeshBuilder.ExtrudeShapeCustom(name + "_rwall", { shape: rightWallShape, path: path, rotationFunction: rotationFunc, sideOrientation: Mesh.DOUBLESIDE, updatable: false }, this.scene);
        rightWall.material = this.materials["border"];

        const merged = Mesh.MergeMeshes([road, leftWall, rightWall], true, true, undefined, true, true);
        if (merged) merged.isVisible = false;
        return merged as Mesh;
    }

    public initializeBaseMeshes(): void {
        const s = BlockRegistry.GRID_SIZE;
        const h = BlockRegistry.HEIGHT_STEP;

        const pathStraight = [new Vector3(0, 0, -s/2), new Vector3(0, 0, s/2)];
        this.baseMeshes["straight"] = this.createExtrudedBlock("base_straight", pathStraight, this.materials["road"]);
        this.baseMeshes["start"] = this.createExtrudedBlock("base_start", pathStraight, this.materials["start"]);
        this.baseMeshes["finish"] = this.createExtrudedBlock("base_finish", pathStraight, this.materials["finish"]);

        const pathTurn: Vector3[] = [];
        for(let i=0; i<=24; i++) {
            const angle = Math.PI - (i / 24) * (Math.PI / 2);
            const px = s/2 + (s/2) * Math.cos(angle);
            const pz = -s/2 + (s/2) * Math.sin(angle);
            pathTurn.push(new Vector3(px, 0, pz));
        }
        this.baseMeshes["turn"] = this.createExtrudedBlock("base_turn", pathTurn, this.materials["road"]);

        const pathRamp = [new Vector3(0, 0, -s/2), new Vector3(0, h, s/2)];
        this.baseMeshes["ramp"] = this.createExtrudedBlock("base_ramp", pathRamp, this.materials["road"]);

        this.baseMeshes["checkpoint"] = this.createExtrudedBlock("base_checkpoint", pathStraight, this.materials["road"]);

        // --- Loop de loop ---
        // Built as a full torus-like tube: a circle in the YZ plane,
        // extended across the road width (X axis). The circle center sits
        // at (0, loopR, 0) so the bottom touches y=0 where the flat road
        // approaches from z<0 and exits toward z>0.
        const loopR = 7;       // radius = grid half-size, fills cell exactly
        const loopSegs = 64;   // segments around the circle
        const widthSegs = 8;   // segments across road width
        const hw = (BlockRegistry.GRID_SIZE - 2) / 2;  // road half-width = 6

        const tubePath: Vector3[] = [];
        for (let i = 0; i <= loopSegs; i++) {
            const phi = (i / loopSegs) * 2 * Math.PI;
            const py = loopR - loopR * Math.cos(phi);
            const pz = loopR * Math.sin(phi);
            tubePath.push(new Vector3(0, py, pz));
        }

        const loopTube = MeshBuilder.CreateTube("base_loop", {
            path: tubePath,
            radius: hw,
            tessellation: widthSegs + 1,
            sideOrientation: Mesh.DOUBLESIDE,
            cap: Mesh.NO_CAP
        }, this.scene);

        // Rotate so the tube's axis runs along X (road width), not along Z
        loopTube.rotate(new Vector3(1, 0, 0), Math.PI / 2);
        loopTube.bakeCurrentTransformIntoVertices();

        loopTube.material = this.materials["road"];
        loopTube.isVisible = false;
        this.baseMeshes["loop"] = loopTube;

        // --- Banked Turn ---
        const bankedRotFunc = (i: number) => {
            const rotMax = -Math.PI / 4; // 45 degrees, tilts outside edge UP
            return rotMax * Math.sin((i / 24) * Math.PI);
        };
        this.baseMeshes["banked_turn"] = this.createExtrudedCustomBlock("base_banked_turn", pathTurn, this.materials["road"], bankedRotFunc);

        // --- Twists for Wallrides ---
        const pathTwist: Vector3[] = [];
        const twistSteps = 10;
        for (let i = 0; i <= twistSteps; i++) {
            pathTwist.push(new Vector3(0, 0, -s/2 + s * (i / twistSteps)));
        }

        const entryTwistLFunc = (i: number) => -(Math.PI / 2) * (i / twistSteps);
        this.baseMeshes["entry_twist_l"] = this.createExtrudedCustomBlock("base_entry_twist_l", pathTwist, this.materials["road"], entryTwistLFunc);

        const entryTwistRFunc = (i: number) => (Math.PI / 2) * (i / twistSteps);
        this.baseMeshes["entry_twist_r"] = this.createExtrudedCustomBlock("base_entry_twist_r", pathTwist, this.materials["road"], entryTwistRFunc);

        const exitTwistLFunc = (i: number) => -(Math.PI / 2) * (1.0 - (i / twistSteps));
        this.baseMeshes["exit_twist_l"] = this.createExtrudedCustomBlock("base_exit_twist_l", pathTwist, this.materials["road"], exitTwistLFunc);

        const exitTwistRFunc = (i: number) => (Math.PI / 2) * (1.0 - (i / twistSteps));
        this.baseMeshes["exit_twist_r"] = this.createExtrudedCustomBlock("base_exit_twist_r", pathTwist, this.materials["road"], exitTwistRFunc);

        // --- Quarter-Pipe Wall Ride Blocks ---
        // Curved surface: flat on one side, arcs up to a vertical wall on the other
        this.baseMeshes["quarter_pipe_l"] = this.createQuarterPipe("base_quarter_pipe_l", this.materials["road"], false);
        this.baseMeshes["quarter_pipe_r"] = this.createQuarterPipe("base_quarter_pipe_r", this.materials["road"], true);

        // --- Half-Pipe Block (walls on BOTH sides) ---
        // Full U-shape: both edges curve up to vertical walls
        this.baseMeshes["half_pipe"] = this.createHalfPipe("base_half_pipe", this.materials["road"]);

        // Keep old names for backward compatibility with existing track data
        this.baseMeshes["half_pipe_l"] = this.baseMeshes["quarter_pipe_l"];
        this.baseMeshes["half_pipe_r"] = this.baseMeshes["quarter_pipe_r"];

        // --- Boost Pad ---
        const boostPadVisual = MeshBuilder.CreateBox("base_boostVisual", { width: s * 0.6, depth: s * 0.3, height: 0.15 }, this.scene);
        boostPadVisual.position.y = 0.2;
        boostPadVisual.bakeCurrentTransformIntoVertices();
        boostPadVisual.material = this.materials["boost"];
        boostPadVisual.isVisible = false;
        this.baseMeshes["boostVisual"] = boostPadVisual;
        this.baseMeshes["boost"] = this.baseMeshes["straight"];
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

        const shapeType = PhysicsShapeType.MESH;
        new PhysicsAggregate(instance, shapeType, { mass: 0, restitution: 0.1, friction: 0.8 }, this.scene);

        return instance;
    }

    public createWallInstance(_x: number, _y: number, _z: number, _blockRotationDeg: number, _localEdge: string, _blockType: string): InstancedMesh {
        // Obsolete: Edge walls are natively generated in the extruded track profiles.
        return null as any;
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