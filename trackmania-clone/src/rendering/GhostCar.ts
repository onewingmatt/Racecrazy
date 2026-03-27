import { Mesh, MeshBuilder, Scene, StandardMaterial, Color3, Vector3, Quaternion } from "@babylonjs/core";
import { CarSnapshot } from "../gameplay/Snapshot";

export class GhostCar {
    private mesh: Mesh;
    private isVisible: boolean = false;

    // Reusable math objects for performance
    private vecA = new Vector3();
    private vecB = new Vector3();
    private quatA = new Quaternion();
    private quatB = new Quaternion();
    private resultVec = new Vector3();
    private resultQuat = new Quaternion();

    constructor(private scene: Scene) {
        // Build visually distinct placeholder geometry (same size as ArcadeCar but different material)
        this.mesh = MeshBuilder.CreateBox("ghost_car", { width: 1.8, depth: 3.5, height: 1.2 }, this.scene);

        const ghostMat = new StandardMaterial("ghostMat", this.scene);
        ghostMat.diffuseColor = new Color3(0.2, 0.6, 1.0); // Neon blue
        ghostMat.emissiveColor = new Color3(0.1, 0.3, 0.5); // Slight glow
        ghostMat.alpha = 0.5; // Translucent
        ghostMat.disableLighting = true; // Make it pop like a hologram

        this.mesh.material = ghostMat;

        // Critical: Do NOT add physics aggregate so it cannot collide with player
        // It's purely a visual rendering component.

        this.hide();
    }

    public show(): void {
        this.isVisible = true;
        this.mesh.isVisible = true;
    }

    public hide(): void {
        this.isVisible = false;
        this.mesh.isVisible = false;
    }

    /**
     * Interpolates smoothly between two snapshot frames and updates the visual mesh.
     * Prevents choppy movement if the snapshot recording rate is lower than the render framerate.
     */
    public updateInterpolated(frameA: CarSnapshot, frameB: CarSnapshot, alpha: number): void {
        if (!this.isVisible) return;

        // Populate reusable vectors
        this.vecA.copyFromFloats(frameA.position.x, frameA.position.y, frameA.position.z);
        this.vecB.copyFromFloats(frameB.position.x, frameB.position.y, frameB.position.z);

        this.quatA.copyFromFloats(frameA.rotation.x, frameA.rotation.y, frameA.rotation.z, frameA.rotation.w);
        this.quatB.copyFromFloats(frameB.rotation.x, frameB.rotation.y, frameB.rotation.z, frameB.rotation.w);

        // Lerp position
        Vector3.LerpToRef(this.vecA, this.vecB, alpha, this.resultVec);
        this.mesh.position.copyFrom(this.resultVec);

        // Slerp rotation (Spherical linear interpolation for smooth quaternion rotation)
        Quaternion.SlerpToRef(this.quatA, this.quatB, alpha, this.resultQuat);
        this.mesh.rotationQuaternion = this.resultQuat;
    }
}