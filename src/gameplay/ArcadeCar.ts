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
    groundRaySpread: number;  // How far apart the 4 corner rays are (in local space)
}

const DEFAULT_CONFIG: ArcadeCarConfig = {
    mass: 1000,

    accelerationForce: 48000,
    brakingForce: 55000,
    reverseForce: 20000,
    maxSpeedKmh: 280,

    baseTurnSpeed: 2.8,
    highSpeedTurnFactor: 0.55,
    turnSpeedRampKmh: 200,
    lowSpeedSteerRampKmh: 80,
    steeringSmoothing: 20,

    // Grip — TM has strong lateral bite but not rail-sharp
    lateralGrip: 0.92,
    downforceFactor: 150,
    lowSpeedSteerSmoothing: 15.0,
    highSpeedSteerSmoothing: 30.0,

    // Air control: only pitch and roll for corrective input, no yaw spin
    airPitchForce: 3000,
    airRollForce: 2000,
    airYawForce: 0,
    autoLevelForce: 8000,

    groundCheckDistance: 0.6,
    groundRaySpread: 1.0,  // 1m spread gives us corners for the 1.8m-wide car
};

export class ArcadeCar {
    public mesh: Mesh;
    public body: PhysicsBody;
    private config: ArcadeCarConfig;

    private currentSpeedMs = 0;
    private steerAngle = 0;
    private targetSteerAngle = 0;
    private isGrounded = false;

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

        // Ensure we have an up to date world matrix
        this.mesh.computeWorldMatrix(true);
        const transform = this.mesh.getWorldMatrix();

        this.checkGrounded();

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

    /**
     * Multi-ray ground check using 4 rays at the corners of the car bounding box.
     * Grounded only if at least 2 of 4 rays hit — prevents false triggers on ramp transitions
     * where a single corner ray might find ground even though the car is partially airborne.
     */
    private checkGrounded(): void {
        const spread = this.config.groundRaySpread;
        const halfSpread = spread * 0.5;
        const dist = this.config.groundCheckDistance;

        // Corner offsets in local space: front-left, front-right, back-left, back-right
        const corners = [
            [ halfSpread, halfSpread],  // front
            [-halfSpread, halfSpread],  // front
            [ halfSpread,-halfSpread],  // back
            [-halfSpread,-halfSpread],  // back
        ];

        const worldMatrix = this.mesh.getWorldMatrix();

        // Get the car's local down direction (accounts for pitch/roll)
        Vector3.TransformNormalToRef(Vector3.Down(), worldMatrix, this._downVec);
        this._downVec.normalize();

        let hits = 0;

        for (let i = 0; i < corners.length; i++) {
            const [dx, dz] = corners[i];
            // Transform local corner offset to world space, then add to car position
            this._cornerLocal.set(dx, 0, dz);
            Vector3.TransformCoordinatesToRef(this._cornerLocal, worldMatrix, this._cornerWorld);

            this._groundRay.origin.set(this._cornerWorld.x, this._cornerWorld.y, this._cornerWorld.z);
            this._groundRay.direction.copyFrom(this._downVec);
            this._groundRay.length = dist;

            const pickResult = this.scene.pickWithRay(this._groundRay, (mesh) => mesh !== this.mesh);

            if (pickResult?.hit) {
                hits++;
            }
        }

        // Require at least 2 corners grounded to consider the car grounded
        this.isGrounded = hits >= 2;
    }

    private applyTorque(body: PhysicsBody, torque: Vector3): void {
         torque.scaleToRef(1/60, this._tempVec1);
         body.applyAngularImpulse(this._tempVec1);
    }

    /**
     * Returns a speed-dependent steering smoothing factor.
     * Low speed → less smoothing (snappier response).
     * High speed → more smoothing (filters twitchy inputs for stability).
     */
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

        // Linearly interpolate current steer angle towards target to filter twitchy micro-inputs
        const smoothing = this.getSteerSmoothing(currentSpeedKmh);
        this.steerAngle += (this.targetSteerAngle - this.steerAngle) * Math.min(1.0, _dt * smoothing);

        // Direct yaw-rate control for Trackmania "snap-to-straight" feel
        const dotForward = Vector3.Dot(vel, forwardVec);
        const reverseFactor = dotForward < -0.1 ? -1 : 1;

        // Desired yaw angular velocity based on steering input
        const targetYawVel = this.steerAngle * reverseFactor;

        this.body.getAngularVelocityToRef(this._angVel);
        const currentYawVel = Vector3.Dot(this._angVel, upVec);

        // Calculate the difference between current and target yaw rate
        const yawError = targetYawVel - currentYawVel;

        // Directly inject the missing angular velocity to perfectly match the target every frame.
        // This completely eliminates any "boat-like" pendulum effect and stops spinning instantly when key released.
        // We use a blend factor (0.5 to 1.0) so it doesn't violently snap the physics engine, but feels instant.
        upVec.scaleToRef(yawError * 0.8, this._tempVec1);
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

        // --- GRIP (Cancel lateral velocity) ---
        const latVel = Vector3.Dot(vel, rightVec);
        if (Math.abs(latVel) > 0.1) {
            // Apply lateral grip impulse slightly behind the center of mass to create a weather-vane stabilizing effect
            forwardVec.scaleToRef(-0.4, this._tempVec1); // offset distance
            pos.addToRef(this._tempVec1, this._gripPos);

            rightVec.scaleToRef(-latVel * this.config.mass * this.config.lateralGrip, this._gripImpulse);
            this.body.applyImpulse(this._gripImpulse, this._gripPos);
        }

        // --- DOWNFORCE ---
        // Strong downforce at speed for stability; TM cars feel planted
        if (currentSpeedKmh > 80) {
            const df = -this.config.downforceFactor * ((currentSpeedKmh - 80) / 50);
            upVec.scaleToRef(df, this._tempVec1);
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
        // TM Nations uses left/right for gentle roll correction in air — no yaw torque
        if (left) {
             forwardVec.scaleToRef(this.config.airRollForce, this._tempVec1);
             this.applyTorque(this.body, this._tempVec1);
        } else if (right) {
             forwardVec.scaleToRef(-this.config.airRollForce, this._tempVec1);
             this.applyTorque(this.body, this._tempVec1);
        }

        // --- AUTO LEVELING ---
        // Stronger auto-level so the car returns to stable flight quickly
        Vector3.CrossToRef(upVec, this._worldUp, this._alignTorqueDir);
        this._alignTorqueDir.scaleToRef(this.config.autoLevelForce, this._tempVec1);
        this.applyTorque(this.body, this._tempVec1);
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

        this.steerAngle = 0;
        this.targetSteerAngle = 0;

        this.body.disablePreStep = false;
    }

    /**
     * Applies a sudden forward impulse to simulate a boost pad hit.
     * Adds to current velocity rather than replacing it, so existing speed compounds.
     * @param forwardDir The forward direction of the boost pad
     * @param boostSpeedMs The additional speed to add in m/s (default ~30 m/s = 108 km/h)
     */
    public applyBoost(forwardDir: Vector3, boostSpeedMs: number = 30): void {
        this.body.getLinearVelocityToRef(this._vel);
        const currentSpeed = this._vel.length();
        const maxSpeedMs = this.config.maxSpeedKmh / 3.6;
        const targetSpeed = Math.min(currentSpeed + boostSpeedMs, maxSpeedMs * 1.15); // allow slight over-max on boost

        // Blend towards the target velocity along the boost pad direction
        const newSpeed = Math.min(targetSpeed, maxSpeedMs * 1.15);
        forwardDir.normalize().scaleToRef(newSpeed, this._tempVec1);

        this.body.setLinearVelocity(this._tempVec1);
    }
}