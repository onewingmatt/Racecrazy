import { Mesh, MeshBuilder, Scene, Vector3, Quaternion, Ray } from "@babylonjs/core";
import { PhysicsAggregate, PhysicsShapeType, PhysicsBody } from "@babylonjs/core/Physics/v2";

export interface ArcadeCarConfig {
    mass: number;

    // Engine & Speed
    accelerationForce: number;
    brakingForce: number;
    reverseForce: number;
    maxSpeedKmh: number;

    // Steering
    baseTurnSpeed: number;
    highSpeedTurnFactor: number;
    turnSpeedRampKmh: number;

    // Grip & Handling
    lateralGrip: number;
    downforceFactor: number;

    // Air Control
    airPitchForce: number;
    airRollForce: number;
    autoLevelForce: number;

    // Suspension / Ground Detection
    groundCheckDistance: number;
}

const DEFAULT_CONFIG: ArcadeCarConfig = {
    mass: 1200,

    accelerationForce: 30000,
    brakingForce: 45000,
    reverseForce: 15000,
    maxSpeedKmh: 180,

    baseTurnSpeed: 3.5,
    highSpeedTurnFactor: 0.4,
    turnSpeedRampKmh: 120,

    lateralGrip: 0.95,
    downforceFactor: 150,

    airPitchForce: 8000,
    airRollForce: 8000,
    autoLevelForce: 6000,

    groundCheckDistance: 0.8
};

export class ArcadeCar {
    public mesh: Mesh;
    public body: PhysicsBody;
    private config: ArcadeCarConfig;

    private currentSpeedMs = 0;
    private steerAngle = 0;
    private isGrounded = false;

    constructor(private scene: Scene, config?: Partial<ArcadeCarConfig>) {
        this.config = { ...DEFAULT_CONFIG, ...config };

        if (!this.scene.getPhysicsEngine()) {
             throw new Error("Physics engine must be initialized before creating ArcadeCar.");
        }

        this.mesh = MeshBuilder.CreateBox("car", { width: 1.8, depth: 3.5, height: 1.2 }, this.scene);

        const aggregate = new PhysicsAggregate(this.mesh, PhysicsShapeType.BOX, {
            mass: this.config.mass,
            friction: 0.5,
            restitution: 0.1
        }, this.scene);
        this.body = aggregate.body;

        this.body.setAngularDamping(2.0);
        this.body.setLinearDamping(0.05);
    }

    public update(_dt: number, forward: boolean, back: boolean, left: boolean, right: boolean): void {
        const vel = this.body.getLinearVelocity();
        this.currentSpeedMs = vel.length();
        const currentSpeedKmh = this.getSpeedKmh();

        this.checkGrounded();

        // Ensure we have an up to date world matrix
        this.mesh.computeWorldMatrix(true);
        const transform = this.mesh.getWorldMatrix();

        // Extract direction vectors from the car's rotation matrix
        const upVec = Vector3.TransformNormal(Vector3.Up(), transform);
        const forwardVec = Vector3.TransformNormal(Vector3.Forward(), transform);
        const rightVec = Vector3.TransformNormal(Vector3.Right(), transform);

        if (this.isGrounded) {
            this.handleGrounded(_dt, forward, back, left, right, vel, forwardVec, rightVec, upVec, currentSpeedKmh);
        } else {
            this.handleAirborne(_dt, forward, back, left, right, upVec, rightVec, forwardVec);
        }
    }

    private checkGrounded(): void {
        const pos = this.mesh.getAbsolutePosition();

        this.mesh.computeWorldMatrix(true);
        const downVec = Vector3.TransformNormal(Vector3.Down(), this.mesh.getWorldMatrix()).normalize();

        const origin = pos.clone();

        // create picking ray
        const ray = new Ray(origin, downVec, this.config.groundCheckDistance);

        // This picks any mesh. To avoid picking the car itself, we filter.
        const pickResult = this.scene.pickWithRay(ray, (mesh) => mesh !== this.mesh);

        this.isGrounded = pickResult?.hit ?? false;
    }

    private applyTorque(body: PhysicsBody, torque: Vector3): void {
         body.applyAngularImpulse(torque.scale(1/60));
    }

    private handleGrounded(_dt: number, forward: boolean, back: boolean, left: boolean, right: boolean, vel: Vector3, forwardVec: Vector3, rightVec: Vector3, upVec: Vector3, currentSpeedKmh: number): void {
        // --- STEERING ---
        let steerMultiplier = 1.0;
        if (currentSpeedKmh > 10) {
            const speedRatio = Math.min(1.0, currentSpeedKmh / this.config.turnSpeedRampKmh);
            steerMultiplier = 1.0 - (1.0 - this.config.highSpeedTurnFactor) * speedRatio;
        } else if (currentSpeedKmh < 1) {
             steerMultiplier = 0;
        }

        const turnSpeed = this.config.baseTurnSpeed * steerMultiplier;

        if (left) this.steerAngle = -turnSpeed;
        else if (right) this.steerAngle = turnSpeed;
        else this.steerAngle = 0;

        if (this.steerAngle !== 0) {
            const dotForward = Vector3.Dot(vel, forwardVec);
            const reverseFactor = dotForward < -0.1 ? -1 : 1;

            const angVel = this.body.getAngularVelocity();
            const yawChange = upVec.scale(this.steerAngle * reverseFactor);

            this.body.setAngularVelocity(angVel.add(yawChange.scale(0.5)));
        }

        // --- ACCELERATION / BRAKING ---
        const maxSpeedMs = this.config.maxSpeedKmh / 3.6;

        if (forward && this.currentSpeedMs < maxSpeedMs) {
            const forceRamp = 1.0 - (this.currentSpeedMs / maxSpeedMs);
            const appliedForce = this.config.accelerationForce * Math.max(0.1, forceRamp);
            this.body.applyForce(forwardVec.scale(appliedForce), this.mesh.getAbsolutePosition());
        }

        if (back) {
            const dotForward = Vector3.Dot(vel, forwardVec);
            if (dotForward > 1) {
                const brakeForce = vel.clone().normalize().scale(-this.config.brakingForce);
                this.body.applyForce(brakeForce, this.mesh.getAbsolutePosition());
            } else {
                this.body.applyForce(forwardVec.scale(-this.config.reverseForce), this.mesh.getAbsolutePosition());
            }
        }

        // --- GRIP (Cancel lateral velocity) ---
        const latVel = Vector3.Dot(vel, rightVec);
        if (Math.abs(latVel) > 0.1) {
            const gripImpulse = rightVec.scale(-latVel * this.config.mass * this.config.lateralGrip);
            this.body.applyImpulse(gripImpulse, this.mesh.getAbsolutePosition());
        }

        // --- DOWNFORCE ---
        if (currentSpeedKmh > 50) {
            const df = -this.config.downforceFactor * (currentSpeedKmh / 50);
            this.body.applyForce(upVec.scale(df), this.mesh.getAbsolutePosition());
        }
    }

    private handleAirborne(_dt: number, forward: boolean, back: boolean, left: boolean, right: boolean, upVec: Vector3, rightVec: Vector3, forwardVec: Vector3): void {
        // --- AIR CONTROL ---
        if (forward) {
             this.applyTorque(this.body, rightVec.scale(this.config.airPitchForce));
        } else if (back) {
             this.applyTorque(this.body, rightVec.scale(-this.config.airPitchForce));
        }

        if (left) {
             this.applyTorque(this.body, forwardVec.scale(this.config.airRollForce));
        } else if (right) {
             this.applyTorque(this.body, forwardVec.scale(-this.config.airRollForce));
        }

        // --- AUTO LEVELING ---
        const worldUp = Vector3.Up();
        const alignTorqueDir = Vector3.Cross(upVec, worldUp);
        if (alignTorqueDir.lengthSquared() > 0.001) {
            this.applyTorque(this.body, alignTorqueDir.scale(this.config.autoLevelForce));
        }
    }

    public getSpeedKmh(): number {
        return this.currentSpeedMs * 3.6;
    }

    public setPosition(pos: Vector3, rotationDeg: number): void {
        this.mesh.position = pos.clone();
        const rad = rotationDeg * (Math.PI / 180);
        this.mesh.rotationQuaternion = Quaternion.FromEulerAngles(0, rad, 0);

        this.body.setLinearVelocity(Vector3.Zero());
        this.body.setAngularVelocity(Vector3.Zero());

        this.body.disablePreStep = false;
    }
}