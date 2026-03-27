import { Mesh, MeshBuilder, Scene, Vector3, Quaternion } from "@babylonjs/core";
import { PhysicsAggregate, PhysicsShapeType, PhysicsBody } from "@babylonjs/core/Physics/v2";

export class ArcadeCar {
    public mesh: Mesh;
    public body: PhysicsBody;

    private engineForce = 1500;
    private brakingForce = 100;
    private maxSpeed = 50; // Roughly 180 km/h
    private turnSpeed = 2.5;

    // Physics body params
    private mass = 1000;

    // Internal state
    private currentSpeed = 0;
    private steerAngle = 0;

    constructor(private scene: Scene) {
        this.mesh = MeshBuilder.CreateBox("car", { width: 1.8, depth: 3.5, height: 1.2 }, this.scene);

        // Slightly raise center of mass logic if needed, but for arcade, center is fine.
        const aggregate = new PhysicsAggregate(this.mesh, PhysicsShapeType.BOX, { mass: this.mass, friction: 0.1, restitution: 0.1 }, this.scene);
        this.body = aggregate.body;

        // Arcade physics locks rotation X and Z so it doesn't flip easily.
        this.body.setAngularDamping(0.8);
        this.body.setLinearDamping(0.1);

        // Lock rotation around X and Z for purely arcade "hover/slide" behavior
        // Using mass properties in Havok (V2)
        const massProps = this.body.getMassProperties();
        if (massProps) {
            // High inertia on X and Z axes to resist flipping
            if (massProps.inertia) {
                massProps.inertia.x *= 100;
                massProps.inertia.z *= 100;
            }
            this.body.setMassProperties(massProps);
        }
    }

    public update(dt: number, forward: boolean, back: boolean, left: boolean, right: boolean): void {
        const vel = this.body.getLinearVelocity();
        this.currentSpeed = vel.length();

        // Steering logic
        if (left) this.steerAngle += this.turnSpeed * dt;
        if (right) this.steerAngle -= this.turnSpeed * dt;

        // Snap steering back
        if (!left && !right) {
            this.steerAngle *= 0.8;
        }

        // Apply visual and physical rotation around Y
        const currentRot = this.mesh.rotationQuaternion || Quaternion.FromEulerAngles(0, 0, 0);
        const euler = currentRot.toEulerAngles();

        // Simple arcade turn: rotate the car directly.
        // In a true physics controller we'd apply torques, but direct rotation manipulation
        // feels snappier for arcade logic.
        if (this.currentSpeed > 1) { // Only turn if moving
            const turnFactor = (forward ? 1 : (back ? -1 : 1));
            euler.y += this.steerAngle * dt * turnFactor;
        }

        this.mesh.rotationQuaternion = Quaternion.FromEulerAngles(euler.x, euler.y, euler.z);

        // Forward vector
        const forwardVec = new Vector3(Math.sin(euler.y), 0, Math.cos(euler.y));

        // Acceleration
        if (forward && this.currentSpeed < this.maxSpeed) {
            this.body.applyImpulse(forwardVec.scale(this.engineForce * dt), this.mesh.getAbsolutePosition());
        }

        // Braking / Reverse
        if (back) {
            if (Vector3.Dot(vel, forwardVec) > 0) {
                // Braking
                const brakeVec = vel.clone().normalize().scale(-this.brakingForce * dt);
                this.body.applyImpulse(brakeVec, this.mesh.getAbsolutePosition());
            } else {
                // Reverse
                this.body.applyImpulse(forwardVec.scale(-this.engineForce * 0.5 * dt), this.mesh.getAbsolutePosition());
            }
        }

        // Artificial grip (cancel lateral velocity)
        const rightVec = new Vector3(Math.cos(euler.y), 0, -Math.sin(euler.y));
        const latVel = Vector3.Dot(vel, rightVec);
        const gripForce = rightVec.scale(-latVel * this.mass * 0.9); // High grip
        this.body.applyImpulse(gripForce.scale(dt), this.mesh.getAbsolutePosition());
    }

    public getSpeedKmh(): number {
        return this.currentSpeed * 3.6; // Convert m/s to km/h
    }

    public setPosition(pos: Vector3, rotationDeg: number): void {
        this.mesh.position = pos.clone();
        const rad = rotationDeg * (Math.PI / 180);
        this.mesh.rotationQuaternion = Quaternion.FromEulerAngles(0, rad, 0);

        // Reset velocity
        this.body.setLinearVelocity(Vector3.Zero());
        this.body.setAngularVelocity(Vector3.Zero());

        // Important: Update physics body transform directly
        this.body.disablePreStep = false; // Ensure it reads from the transform node next frame
    }
}