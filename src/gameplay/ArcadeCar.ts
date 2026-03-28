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

    // Pre-allocated vectors for hot-paths
    private _upVec = Vector3.Zero();
    private _forwardVec = Vector3.Zero();
    private _rightVec = Vector3.Zero();
    private _downVec = Vector3.Zero();
    private _vel = Vector3.Zero();
    private _angVel = Vector3.Zero();
    private _yawChange = Vector3.Zero();
    private _brakeForce = Vector3.Zero();
    private _gripImpulse = Vector3.Zero();
    private _alignTorqueDir = Vector3.Zero();
    private _tempVec1 = Vector3.Zero();
    private _worldUp = Vector3.Up();
    private _groundRay = new Ray(Vector3.Zero(), Vector3.Zero(), 0);

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
        this.body.getLinearVelocityToRef(this._vel);
        this.currentSpeedMs = this._vel.length();
        const currentSpeedKmh = this.getSpeedKmh();

        this.checkGrounded();

        // Ensure we have an up to date world matrix
        this.mesh.computeWorldMatrix(true);
        const transform = this.mesh.getWorldMatrix();

        // Extract direction vectors from the car's rotation matrix
        Vector3.TransformNormalToRef(Vector3.Up(), transform, this._upVec);
        Vector3.TransformNormalToRef(Vector3.Forward(), transform, this._forwardVec);
        Vector3.TransformNormalToRef(Vector3.Right(), transform, this._rightVec);

        if (this.isGrounded) {
            this.handleGrounded(_dt, forward, back, left, right, this._vel, this._forwardVec, this._rightVec, this._upVec, currentSpeedKmh);
        } else {
            this.handleAirborne(_dt, forward, back, left, right, this._upVec, this._rightVec, this._forwardVec);
        }
    }

    private checkGrounded(): void {
        const pos = this.mesh.getAbsolutePosition();

        this.mesh.computeWorldMatrix(true);
        Vector3.TransformNormalToRef(Vector3.Down(), this.mesh.getWorldMatrix(), this._downVec);
        this._downVec.normalize();

        // update picking ray
        this._groundRay.origin.copyFrom(pos);
        this._groundRay.direction.copyFrom(this._downVec);
        this._groundRay.length = this.config.groundCheckDistance;

        // This picks any mesh. To avoid picking the car itself, we filter.
        const pickResult = this.scene.pickWithRay(this._groundRay, (mesh) => mesh !== this.mesh);

        this.isGrounded = pickResult?.hit ?? false;
    }

    private applyTorque(body: PhysicsBody, torque: Vector3): void {
         torque.scaleToRef(1/60, this._tempVec1);
         body.applyAngularImpulse(this._tempVec1);
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

            this.body.getAngularVelocityToRef(this._angVel);
            upVec.scaleToRef(this.steerAngle * reverseFactor, this._yawChange);

            this._yawChange.scaleToRef(0.5, this._tempVec1);
            this._angVel.addInPlace(this._tempVec1);
            this.body.setAngularVelocity(this._angVel);
        }

        // --- ACCELERATION / BRAKING ---
        const maxSpeedMs = this.config.maxSpeedKmh / 3.6;
        const pos = this.mesh.getAbsolutePosition();

        if (forward && this.currentSpeedMs < maxSpeedMs) {
            const forceRamp = 1.0 - (this.currentSpeedMs / maxSpeedMs);
            const appliedForce = this.config.accelerationForce * Math.max(0.1, forceRamp);
            forwardVec.scaleToRef(appliedForce, this._tempVec1);
            this.body.applyForce(this._tempVec1, pos);
        }

        if (back) {
            const dotForward = Vector3.Dot(vel, forwardVec);
            if (dotForward > 1) {
                vel.normalizeToRef(this._brakeForce);
                this._brakeForce.scaleInPlace(-this.config.brakingForce);
                this.body.applyForce(this._brakeForce, pos);
            } else {
                forwardVec.scaleToRef(-this.config.reverseForce, this._tempVec1);
                this.body.applyForce(this._tempVec1, pos);
            }
        }

        // --- GRIP (Cancel lateral velocity) ---
        const latVel = Vector3.Dot(vel, rightVec);
        if (Math.abs(latVel) > 0.1) {
            rightVec.scaleToRef(-latVel * this.config.mass * this.config.lateralGrip, this._gripImpulse);
            this.body.applyImpulse(this._gripImpulse, pos);
        }

        // --- DOWNFORCE ---
        if (currentSpeedKmh > 50) {
            const df = -this.config.downforceFactor * (currentSpeedKmh / 50);
            upVec.scaleToRef(df, this._tempVec1);
            this.body.applyForce(this._tempVec1, pos);
        }
    }

    private handleAirborne(_dt: number, forward: boolean, back: boolean, left: boolean, right: boolean, upVec: Vector3, rightVec: Vector3, forwardVec: Vector3): void {
        // --- AIR CONTROL ---
        if (forward) {
             rightVec.scaleToRef(this.config.airPitchForce, this._tempVec1);
             this.applyTorque(this.body, this._tempVec1);
        } else if (back) {
             rightVec.scaleToRef(-this.config.airPitchForce, this._tempVec1);
             this.applyTorque(this.body, this._tempVec1);
        }

        if (left) {
             forwardVec.scaleToRef(this.config.airRollForce, this._tempVec1);
             this.applyTorque(this.body, this._tempVec1);
        } else if (right) {
             forwardVec.scaleToRef(-this.config.airRollForce, this._tempVec1);
             this.applyTorque(this.body, this._tempVec1);
        }

        // --- AUTO LEVELING ---
        Vector3.CrossToRef(upVec, this._worldUp, this._alignTorqueDir);
        if (this._alignTorqueDir.lengthSquared() > 0.001) {
            this._alignTorqueDir.scaleToRef(this.config.autoLevelForce, this._tempVec1);
            this.applyTorque(this.body, this._tempVec1);
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