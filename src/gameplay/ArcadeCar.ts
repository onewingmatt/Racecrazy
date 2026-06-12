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
    lowSpeedSteerRampKmh: number;
    steeringSmoothing: number;

    // Grip & Handling
    lateralGrip: number;
    downforceFactor: number;
    lowSpeedSteerSmoothing: number;
    highSpeedSteerSmoothing: number;

    // Air Control
    airPitchForce: number;
    airRollForce: number;
    airYawForce: number;
    autoLevelForce: number;

    // Suspension / Ground Detection
    groundCheckDistance: number;
    groundRaySpread: number;

    // Flip Recovery
    flipThreshold: number;
    flipRecoveryTime: number;
}

const DEFAULT_CONFIG: ArcadeCarConfig = {
    mass: 1000,

    accelerationForce: 48000,
    brakingForce: 55000,
    reverseForce: 20000,
    maxSpeedKmh: 280,

    baseTurnSpeed: 2.5,
    highSpeedTurnFactor: 0.55,
    turnSpeedRampKmh: 200,
    lowSpeedSteerRampKmh: 100,
    steeringSmoothing: 20,

    lateralGrip: 0.92,
    downforceFactor: 150,
    lowSpeedSteerSmoothing: 10.0,
    highSpeedSteerSmoothing: 24.0,

    airPitchForce: 3000,
    airRollForce: 2000,
    airYawForce: 0,
    autoLevelForce: 8000,

    groundCheckDistance: 0.6,
    groundRaySpread: 1.0,

    flipThreshold: 0.0,       // upVec·worldUp < 0 = upside-down
    flipRecoveryTime: 2.5,    // 2.5s of being flipped triggers respawn
};

export class ArcadeCar {
    public mesh: Mesh;
    public body: PhysicsBody;
    private config: ArcadeCarConfig;

    private currentSpeedMs = 0;
    private steerAngle = 0;
    private targetSteerAngle = 0;
    private isGrounded = false;

    // Flip recovery state
    public isFlipped = false;
    public flipRecoveryTimer = 0;
    private _lastGroundedPos = Vector3.Zero();
    private _lastGroundedRot = Quaternion.Identity();

    // Pre-allocated vectors for hot-paths
    private _upVec = Vector3.Zero();
    private _forwardVec = Vector3.Zero();
    private _rightVec = Vector3.Zero();
    private _downVec = Vector3.Zero();
    private _vel = Vector3.Zero();
    private _angVel = Vector3.Zero();
    private _brakeForce = Vector3.Zero();
    private _gripImpulse = Vector3.Zero();
    private _alignTorqueDir = Vector3.Zero();
    private _tempVec1 = Vector3.Zero();
    private _gripPos = Vector3.Zero();
    private _worldUp = Vector3.Up();
    private _groundRay = new Ray(Vector3.Zero(), Vector3.Zero(), 0);
    private _cornerLocal = Vector3.Zero();
    private _cornerWorld = Vector3.Zero();
    private _supportDirection = Vector3.Down();
    private _hasSupportDirection = false;
    private _wallHitSide = 0; // -1 = left wall, 1 = right wall, 0 = none

    constructor(private scene: Scene, config?: Partial<ArcadeCarConfig>) {
        this.config = { ...DEFAULT_CONFIG, ...config };

        if (!this.scene.getPhysicsEngine()) {
             throw new Error("Physics engine must be initialized before creating ArcadeCar.");
        }

        this.mesh = MeshBuilder.CreateBox("car", { width: 1.8, depth: 3.5, height: 1.2 }, this.scene);

        const aggregate = new PhysicsAggregate(this.mesh, PhysicsShapeType.BOX, {
            mass: this.config.mass,
            friction: 0.02,
            restitution: 0.1
        }, this.scene);
        this.body = aggregate.body;

        this.body.setAngularDamping(8.0);
        this.body.setLinearDamping(0.002);
    }

    public update(_dt: number, forward: boolean, back: boolean, left: boolean, right: boolean): void {
        this.body.getLinearVelocityToRef(this._vel);
        this.currentSpeedMs = this._vel.length();
        const currentSpeedKmh = this.getSpeedKmh();

        // Track last grounded position for respawn
        if (this.isGrounded) {
            this.mesh.getAbsolutePosition().toArray(this._lastGroundedPos.asArray());
            const q = this.mesh.rotationQuaternion || Quaternion.Identity();
            this._lastGroundedRot.copyFrom(q);
        }

        // Ensure we have an up to date world matrix
        this.mesh.computeWorldMatrix(true);
        const transform = this.mesh.getWorldMatrix();

        this.checkGrounded();

        // Extract direction vectors from the car's rotation matrix
        Vector3.TransformNormalToRef(Vector3.Up(), transform, this._upVec);
        Vector3.TransformNormalToRef(Vector3.Forward(), transform, this._forwardVec);
        Vector3.TransformNormalToRef(Vector3.Right(), transform, this._rightVec);

        // --- Flip Detection ---
        const upDot = Vector3.Dot(this._upVec, this._worldUp);
        const wasFlipped = this.isFlipped;
        this.isFlipped = upDot < this.config.flipThreshold && !this.isGrounded;

        if (this.isFlipped) {
            this.flipRecoveryTimer += _dt;
        } else {
            this.flipRecoveryTimer = Math.max(0, this.flipRecoveryTimer - _dt * 3);
        }

        // If flipped too long, reset to last grounded position
        if (this.flipRecoveryTimer >= this.config.flipRecoveryTime) {
            this._resetToLastSafePose();
            return;
        }

        // Only update flip state if it changed (so we can show a UI message)
        if (this.isFlipped && !wasFlipped) {
            // flipped state changed - could trigger UI
        }

        if (this.isGrounded) {
            this.handleGrounded(_dt, forward, back, left, right, this._vel, this._forwardVec, this._rightVec, this._upVec, currentSpeedKmh);
        } else {
            this.handleAirborne(_dt, forward, back, left, right, this._upVec, this._rightVec, this._forwardVec);
        }
    }

    /**
     * Multi-ray ground check using 4 rays at the corners of the car bounding box.
     * Grounded only if at least 2 of 4 rays hit.
     * For loop-de-loops, also casts "ceiling" rays (in car's "up" direction)
     * to detect inverted track surfaces.
     * For wall riding, also casts side rays to detect vertical surfaces.
     */
    private checkGrounded(): void {
        const spread = this.config.groundRaySpread;
        const halfSpread = spread * 0.5;
        const dist = this.config.groundCheckDistance;

        const corners = [
            [ halfSpread, halfSpread],
            [-halfSpread, halfSpread],
            [ halfSpread,-halfSpread],
            [-halfSpread,-halfSpread],
        ];

        const worldMatrix = this.mesh.getWorldMatrix();

        Vector3.TransformNormalToRef(Vector3.Down(), worldMatrix, this._downVec);
        this._downVec.normalize();
        Vector3.TransformNormalToRef(Vector3.Up(), worldMatrix, this._upVec);
        this._upVec.normalize();

        // Also get forward/right vectors for side ray detection
        Vector3.TransformNormalToRef(Vector3.Forward(), worldMatrix, this._forwardVec);
        this._forwardVec.normalize();
        Vector3.TransformNormalToRef(Vector3.Right(), worldMatrix, this._rightVec);
        this._rightVec.normalize();

        let surfaceHits = 0;
        let ceilingHits = 0;
        let wallHits = 0;
        this._hasSupportDirection = false;
        this._supportDirection.copyFrom(this._downVec);
        this._wallHitSide = 0; // -1 = left wall, 1 = right wall, 0 = none

        for (let i = 0; i < corners.length; i++) {
            const [dx, dz] = corners[i];
            this._cornerLocal.set(dx, 0, dz);
            Vector3.TransformCoordinatesToRef(this._cornerLocal, worldMatrix, this._cornerWorld);

            // Down ray: detects normal ground
            this._groundRay.origin.set(this._cornerWorld.x, this._cornerWorld.y, this._cornerWorld.z);
            this._groundRay.direction.copyFrom(this._downVec);
            this._groundRay.length = dist;

            let pickResult = this.scene.pickWithRay(this._groundRay, (mesh) => mesh !== this.mesh);
            if (pickResult?.hit) {
                surfaceHits++;
                this._supportDirection.copyFrom(this._downVec);
                this._hasSupportDirection = true;
                continue;
            }

            // Ceiling ray: detects inverted track (loop tops, etc.)
            this._groundRay.origin.set(this._cornerWorld.x, this._cornerWorld.y, this._cornerWorld.z);
            this._groundRay.direction.copyFrom(this._upVec);
            this._groundRay.length = dist * 2;

            pickResult = this.scene.pickWithRay(this._groundRay, (mesh) => mesh !== this.mesh);
            if (pickResult?.hit) {
                surfaceHits++;
                ceilingHits++;
                this._supportDirection.copyFrom(this._upVec);
                this._hasSupportDirection = true;
            }
        }

        // Additional check for wall riding - cast rays to the side
        // Only check if not already grounded (or even if grounded, for wall riding surfaces)
        if (surfaceHits < 2) {
            // Check left side
            this._groundRay.origin.set(this.mesh.position.x, this.mesh.position.y + 0.5, this.mesh.position.z);
            this._groundRay.direction.copyFrom(this._rightVec.scale(-1)); // left
            this._groundRay.length = dist * 1.5;

            let pickResult = this.scene.pickWithRay(this._groundRay, (mesh) => mesh !== this.mesh);
            if (pickResult?.hit) {
                this._wallHitSide = -1;
                wallHits++;
                this._supportDirection.copyFrom(this._rightVec);
                this._supportDirection.scaleInPlace(-1);
                this._hasSupportDirection = true;
            }

            // Check right side
            this._groundRay.origin.set(this.mesh.position.x, this.mesh.position.y + 0.5, this.mesh.position.z);
            this._groundRay.direction.copyFrom(this._rightVec);
            this._groundRay.length = dist * 1.5;

            pickResult = this.scene.pickWithRay(this._groundRay, (mesh) => mesh !== this.mesh);
            if (pickResult?.hit) {
                this._wallHitSide = 1;
                wallHits++;
                this._supportDirection.copyFrom(this._rightVec);
                this._hasSupportDirection = true;
            }
        }

        this.isGrounded = surfaceHits >= 2 || ceilingHits >= 1 || wallHits >= 1;
    }

    private applyTorque(body: PhysicsBody, torque: Vector3): void {
         torque.scaleToRef(1/60, this._tempVec1);
         body.applyAngularImpulse(this._tempVec1);
    }

    private getSteerSmoothing(currentSpeedKmh: number): number {
        if (currentSpeedKmh <= this.config.lowSpeedSteerRampKmh) {
            return this.config.lowSpeedSteerSmoothing;
        }
        if (currentSpeedKmh >= this.config.turnSpeedRampKmh) {
            return this.config.highSpeedSteerSmoothing;
        }
        const t = (currentSpeedKmh - this.config.lowSpeedSteerRampKmh) /
                  (this.config.turnSpeedRampKmh - this.config.lowSpeedSteerRampKmh);
        return this.config.lowSpeedSteerSmoothing +
               (this.config.highSpeedSteerSmoothing - this.config.lowSpeedSteerSmoothing) * t;
    }

    private handleGrounded(_dt: number, forward: boolean, back: boolean, left: boolean, right: boolean, vel: Vector3, forwardVec: Vector3, rightVec: Vector3, upVec: Vector3, currentSpeedKmh: number): void {
        // --- STEERING ---
        let steerMultiplier = 1.0;
        if (currentSpeedKmh < this.config.lowSpeedSteerRampKmh) {
            steerMultiplier = Math.max(0.01, currentSpeedKmh / this.config.lowSpeedSteerRampKmh);
        } else {
            const speedRatio = Math.min(1.0, (currentSpeedKmh - this.config.lowSpeedSteerRampKmh) / (this.config.turnSpeedRampKmh - this.config.lowSpeedSteerRampKmh));
            steerMultiplier = 1.0 - (1.0 - this.config.highSpeedTurnFactor) * speedRatio;
        }
        const turnSpeed = this.config.baseTurnSpeed * steerMultiplier;

        if (left) this.targetSteerAngle = -turnSpeed;
        else if (right) this.targetSteerAngle = turnSpeed;
        else this.targetSteerAngle = 0;

        const smoothing = this.getSteerSmoothing(currentSpeedKmh);
        this.steerAngle += (this.targetSteerAngle - this.steerAngle) * Math.min(1.0, _dt * smoothing);

        // Direct yaw-rate control
        const dotForward = Vector3.Dot(vel, forwardVec);
        const reverseFactor = dotForward < -0.1 ? -1 : 1;
        const targetYawVel = this.steerAngle * reverseFactor;

        this.body.getAngularVelocityToRef(this._angVel);
        const currentYawVel = Vector3.Dot(this._angVel, upVec);
        const yawError = targetYawVel - currentYawVel;

        upVec.scaleToRef(yawError * 0.6, this._tempVec1);
        this._angVel.addInPlace(this._tempVec1);
        this.body.setAngularVelocity(this._angVel);

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

        // --- GRIP ---
        const latVel = Vector3.Dot(vel, rightVec);
        if (Math.abs(latVel) > 0.1) {
            forwardVec.scaleToRef(-0.05, this._tempVec1);  // nearly at center of mass
            pos.addToRef(this._tempVec1, this._gripPos);

            rightVec.scaleToRef(-latVel * this.config.mass * this.config.lateralGrip, this._gripImpulse);
            this.body.applyImpulse(this._gripImpulse, this._gripPos);
        }

        const supportDirection = this._hasSupportDirection ? this._supportDirection : this._downVec;

        // Press the car into the detected surface so loops and wall rides stay attached.
        const adhesionScale = this._wallHitSide !== 0 ? 35 : 30;
        supportDirection.scaleToRef(this.config.mass * adhesionScale, this._tempVec1);
        this.body.applyForce(this._tempVec1, pos);

        // Nudge the car's up vector toward the opposite of the support direction.
        // This keeps the chassis aligned with inverted and side-facing track sections.
        Vector3.CrossToRef(supportDirection, upVec, this._alignTorqueDir);
        const alignScale = this._wallHitSide !== 0 ? this.config.autoLevelForce * 1.25 : this.config.autoLevelForce * 0.6;
        this._alignTorqueDir.scaleToRef(alignScale, this._tempVec1);
        this.applyTorque(this.body, this._tempVec1);

        // --- DOWNFORCE ---
        // Redirect downforce toward detected surface orientation. When wall-riding,
        // pushing along -upVec would shove the car away from the wall.
        if (currentSpeedKmh > 80) {
            const df = this.config.downforceFactor * ((currentSpeedKmh - 80) / 50);
            this._wallHitSide !== 0
                ? supportDirection.scaleToRef(df, this._tempVec1)   // push into wall
                : upVec.scaleToRef(-df, this._tempVec1);            // push into ground
            this.body.applyForce(this._tempVec1, pos);
        }
    }

    private handleAirborne(_dt: number, forward: boolean, back: boolean, left: boolean, right: boolean, upVec: Vector3, rightVec: Vector3, forwardVec: Vector3): void {
        // --- AIR PITCH ---
        if (forward) {
             rightVec.scaleToRef(this.config.airPitchForce, this._tempVec1);
             this.applyTorque(this.body, this._tempVec1);
        } else if (back) {
             rightVec.scaleToRef(-this.config.airPitchForce, this._tempVec1);
             this.applyTorque(this.body, this._tempVec1);
        }

        // --- AIR ROLL ---
        if (left) {
             forwardVec.scaleToRef(this.config.airRollForce, this._tempVec1);
             this.applyTorque(this.body, this._tempVec1);
        } else if (right) {
             forwardVec.scaleToRef(-this.config.airRollForce, this._tempVec1);
             this.applyTorque(this.body, this._tempVec1);
        }

        // --- AUTO LEVELING ---
        Vector3.CrossToRef(upVec, this._worldUp, this._alignTorqueDir);
        this._alignTorqueDir.scaleToRef(this.config.autoLevelForce, this._tempVec1);
        this.applyTorque(this.body, this._tempVec1);
    }

    /**
     * Hard-reset the car to the last known grounded pose.
     * Used for flip recovery and manual respawn.
     */
    private _resetToLastSafePose(): void {
        const pos = this._lastGroundedPos.clone();
        pos.y += 1.0;

        this.mesh.position = pos;
        this.mesh.rotationQuaternion = this._lastGroundedRot.clone();

        this.body.setLinearVelocity(Vector3.Zero());
        this.body.setAngularVelocity(Vector3.Zero());

        this.steerAngle = 0;
        this.targetSteerAngle = 0;
        this.flipRecoveryTimer = 0;
        this.isFlipped = false;
    }

    public getSpeedKmh(): number {
        return this.currentSpeedMs * 3.6;
    }

    public setPosition(pos: Vector3, rotationDeg: number): void {
        const rad = rotationDeg * (Math.PI / 180);
        this.mesh.position = pos.clone();
        this.mesh.rotationQuaternion = Quaternion.FromEulerAngles(0, rad, 0);

        this.body.setLinearVelocity(Vector3.Zero());
        this.body.setAngularVelocity(Vector3.Zero());

        this.steerAngle = 0;
        this.targetSteerAngle = 0;
        this.flipRecoveryTimer = 0;
        this.isFlipped = false;
        this._lastGroundedPos = pos.clone();
        this._lastGroundedRot = Quaternion.FromEulerAngles(0, rad, 0);

        this.body.disablePreStep = false;
    }

    /**
     * Applies a sudden forward impulse to simulate a boost pad hit.
     */
    public applyBoost(forwardDir: Vector3, boostSpeedMs: number = 30): void {
        this.body.getLinearVelocityToRef(this._vel);
        const currentSpeed = this._vel.length();
        const maxSpeedMs = this.config.maxSpeedKmh / 3.6;
        const targetSpeed = Math.min(currentSpeed + boostSpeedMs, maxSpeedMs * 1.15);

        forwardDir.normalize().scaleToRef(targetSpeed, this._tempVec1);
        this.body.setLinearVelocity(this._tempVec1);
    }
}
