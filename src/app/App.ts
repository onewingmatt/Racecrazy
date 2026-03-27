import { Vector3, Quaternion } from "@babylonjs/core";
import { Renderer } from "../rendering/Renderer";
import { PhysicsEngine } from "../physics/PhysicsEngine";
import { BlockRegistry } from "../track/BlockRegistry";
import { TrackParser } from "../track/TrackParser";
import { ArcadeCar } from "../gameplay/ArcadeCar";
import { RaceManager, RaceState } from "../gameplay/RaceManager";
import { InputManager } from "../core/InputManager";
import { GameLoop } from "../core/GameLoop";
import { UIOverlay } from "../ui/UIOverlay";
import { PlayerFrameSnapshot, CarSnapshot, RaceProgressionSnapshot } from "../gameplay/Snapshot";
import { GhostManager } from "../gameplay/GhostManager";
import { GhostCar } from "../rendering/GhostCar";

// Sample Track Data
import trackData from "../data/track.json";

export class App {
    private renderer: Renderer;
    private physics: PhysicsEngine;
    private registry: BlockRegistry;
    private parser: TrackParser;
    private car!: ArcadeCar;
    private ghostCar!: GhostCar;
    private raceManager: RaceManager;
    private ghostManager: GhostManager;
    private inputManager: InputManager;
    private gameLoop: GameLoop;
    private ui: UIOverlay;

    private parsedTrack: any;

    // Ghost recording buffer for current run
    private ghostBuffer: PlayerFrameSnapshot[] = [];
    private isGhostEnabled: boolean = true;

    constructor() {
        this.renderer = new Renderer();
        this.physics = new PhysicsEngine(this.renderer.scene);
        this.registry = new BlockRegistry(this.renderer.scene);
        this.parser = new TrackParser(this.registry);

        this.raceManager = new RaceManager();
        this.ghostManager = new GhostManager();
        this.inputManager = new InputManager();
        this.ui = new UIOverlay();

        // 60Hz physics and gameplay loop
        this.gameLoop = new GameLoop(
            (dt) => this.fixedUpdate(dt),
            (alpha) => this.renderUpdate(alpha),
            60
        );
    }

    public async initialize(): Promise<void> {
        await this.physics.initialize();
        this.registry.initializeBaseMeshes();

        // Load Track
        this.parsedTrack = this.parser.parse(trackData as any);

        // Load best local ghost for this track if it exists
        this.ghostManager.loadGhost(this.parsedTrack.name);

        // Initialize Cars
        this.car = new ArcadeCar(this.renderer.scene);
        this.ghostCar = new GhostCar(this.renderer.scene);

        // Wait for next frame before setting up physics constraints so Babylon initializes Havok properly
        this.renderer.scene.onBeforeRenderObservable.addOnce(() => {
            this.resetRace();
        });

        // Setup Triggers (Checkpoints & Finish)
        this.setupTriggers();

        this.gameLoop.start();

        // Start Render Loop
        this.renderer.engine.runRenderLoop(() => {
            this.renderer.render();
        });
    }

    private setupTriggers(): void {
        this.parsedTrack.checkpoints.forEach((cp: any) => {
            cp.mesh.onCollide = (collidedMesh: any) => {
                if (collidedMesh === this.car.mesh && this.raceManager.state === RaceState.RACING) {
                    if (this.raceManager.hitCheckpoint(cp.id)) {
                        this.ui.showMessage(`CHECKPOINT ${cp.id + 1}!`);
                    }
                }
            };
        });

        if (this.parsedTrack.finishVolume) {
            this.parsedTrack.finishVolume.onCollide = (collidedMesh: any) => {
                if (collidedMesh === this.car.mesh && this.raceManager.state === RaceState.RACING) {
                    if (this.raceManager.hitFinish()) {
                        this.ui.showMessage("FINISH!");
                        this.ui.updateBestTime(this.raceManager.formatTime(this.raceManager.bestTime!));

                        // Check if we should save this run as a new ghost
                        if (this.raceManager.raceTime === this.raceManager.bestTime) {
                            this.ghostManager.saveGhost(this.parsedTrack.name, this.raceManager.raceTime, this.ghostBuffer);
                        }
                    }
                }
            };
        }
    }

    private resetRace(): void {
        this.car.setPosition(this.parsedTrack.startPosition, this.parsedTrack.startRotationDeg);
        this.raceManager.startRace(this.parsedTrack.checkpoints.length);

        // Prepare Ghost logic
        this.ghostBuffer = []; // Clear recorded ghost frames on restart
        this.ghostManager.resetPlayback();

        if (this.raceManager.bestTime) {
            this.ui.updateBestTime(this.raceManager.formatTime(this.raceManager.bestTime));
        }

        this.updateGhostVisibility();
    }

    private createSnapshot(timestampMs: number): PlayerFrameSnapshot {
        // Extract plain data from Babylon structures.
        // This is safe to JSON stringify and send over network or save.
        const pos = this.car.mesh.getAbsolutePosition();
        const rot = this.car.mesh.rotationQuaternion || Quaternion.Identity();
        const linVel = this.car.body.getLinearVelocity();
        const angVel = this.car.body.getAngularVelocity();

        const carState: CarSnapshot = {
            position: { x: pos.x, y: pos.y, z: pos.z },
            rotation: { x: rot.x, y: rot.y, z: rot.z, w: rot.w },
            linearVelocity: { x: linVel.x, y: linVel.y, z: linVel.z },
            angularVelocity: { x: angVel.x, y: angVel.y, z: angVel.z }
        };

        const raceStateName =
            this.raceManager.state === RaceState.READY ? "READY" :
            this.raceManager.state === RaceState.RACING ? "RACING" : "FINISHED";

        const raceState: RaceProgressionSnapshot = {
            state: raceStateName,
            currentCheckpointId: this.raceManager.currentCheckpointId,
            totalCheckpoints: this.raceManager.maxCheckpoints,
            raceTimeMs: this.raceManager.raceTime
        };

        return {
            timestampMs,
            car: carState,
            progression: raceState
        };
    }

    private updateGhostVisibility(): void {
        const hasData = this.ghostManager.hasGhost();
        this.ui.updateGhostStatus(this.isGhostEnabled, hasData);

        if (hasData && this.isGhostEnabled && this.raceManager.state !== RaceState.FINISHED) {
            this.ghostCar.show();
        } else {
            this.ghostCar.hide();
        }
    }

    private fixedUpdate(dt: number): void {
        if (this.inputManager.isRestartDown) {
            this.resetRace();
        }

        if (this.inputManager.isGhostToggleDown) {
            this.isGhostEnabled = !this.isGhostEnabled;
            this.updateGhostVisibility();
        }

        // Auto-start race when accelerating
        if (this.raceManager.state === RaceState.READY &&
            (this.inputManager.isForwardDown || this.inputManager.isBackDown)) {
            this.raceManager.beginRacing();
        }

        // Only allow car control if not finished
        if (this.raceManager.state !== RaceState.FINISHED) {
            this.car.update(
                dt,
                this.inputManager.isForwardDown,
                this.inputManager.isBackDown,
                this.inputManager.isLeftDown,
                this.inputManager.isRightDown
            );
        } else {
            // Apply neutral inputs when finished so car coasts
            this.car.update(dt, false, false, false, false);
            this.ghostCar.hide(); // Hide ghost when finished
        }

        this.physics.step(dt);
        this.raceManager.update();
        this.inputManager.resetPerFrameInputs();

        // Fallback simple manual trigger check (since Havok trigger events can be flaky)
        this.checkManualTriggers();

        // Record ghost snapshot if racing
        if (this.raceManager.state !== RaceState.FINISHED) {
            this.ghostBuffer.push(this.createSnapshot(this.raceManager.raceTime));
        }
    }

    private checkManualTriggers(): void {
        if (this.raceManager.state !== RaceState.RACING) return;

        const carPos = this.car.mesh.getAbsolutePosition();

        for (const cp of this.parsedTrack.checkpoints) {
            if (this.isInVolume(carPos, cp.mesh)) {
                if (this.raceManager.hitCheckpoint(cp.id)) {
                    this.ui.showMessage(`CHECKPOINT ${cp.id + 1}!`);
                }
            }
        }

        if (this.parsedTrack.finishVolume && this.isInVolume(carPos, this.parsedTrack.finishVolume)) {
             if (this.raceManager.hitFinish()) {
                this.ui.showMessage("FINISH!");
                this.ui.updateBestTime(this.raceManager.formatTime(this.raceManager.bestTime!));

                // Check if we should save this run as a new ghost
                if (this.raceManager.raceTime === this.raceManager.bestTime) {
                    this.ghostManager.saveGhost(this.parsedTrack.name, this.raceManager.raceTime, this.ghostBuffer);
                }
            }
        }
    }

    private isInVolume(pos: Vector3, volume: any): boolean {
        // Very rudimentary AABB check for trigger volumes
        const volPos = volume.getAbsolutePosition();
        const dist = Vector3.Distance(pos, volPos);
        return dist < 8; // Roughly within 10x10 block size radius
    }

    private renderUpdate(_alpha: number): void {
        this.renderer.camera.lockedTarget = this.car.mesh;

        // Dynamic FOV for speed sense
        this.renderer.updateCameraForSpeed(this.car.getSpeedKmh());

        // Update Ghost Car visuals
        if (this.isGhostEnabled && this.ghostManager.hasGhost() && this.raceManager.state === RaceState.RACING) {
            const playback = this.ghostManager.getPlaybackFrames(this.raceManager.raceTime);
            if (playback.frameA && playback.frameB) {
                this.ghostCar.updateInterpolated(playback.frameA.car, playback.frameB.car, playback.alpha);
            }
        }

        // Update UI
        this.ui.updateSpeed(this.car.getSpeedKmh());
        this.ui.updateTimer(this.raceManager.formatTime(this.raceManager.raceTime));

        // Show status message if Ready or Finished
        if (this.raceManager.state === RaceState.READY) {
            this.ui.showPersistentMessage("READY\n< PRESS W / UP >");
        } else if (this.raceManager.state === RaceState.FINISHED) {
            this.ui.showPersistentMessage(`FINISHED: ${this.raceManager.formatTime(this.raceManager.raceTime)}\n< PRESS R TO RESTART >`);
        } else {
            this.ui.hidePersistentMessage();
        }

        // Show progress string (CP: 1/3)
        const cpString = `${this.raceManager.currentCheckpointId + 1} / ${this.raceManager.maxCheckpoints}`;
        this.ui.updateCheckpointProgress(cpString);
    }
}