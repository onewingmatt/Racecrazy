import { Vector3, Quaternion, Mesh } from "@babylonjs/core";
import { Vector3, Quaternion, InstancedMesh, AbstractMesh } from "@babylonjs/core";
import { Renderer } from "../rendering/Renderer";
import { PhysicsEngine } from "../physics/PhysicsEngine";
import { BlockRegistry } from "../track/BlockRegistry";
import { TrackParser, ParsedTrack } from "../track/TrackParser";
import { ArcadeCar } from "../gameplay/ArcadeCar";
import { RaceManager, RaceState } from "../gameplay/RaceManager";
import { InputManager } from "../core/InputManager";
import { GameLoop } from "../core/GameLoop";
import { UIOverlay } from "../ui/UIOverlay";
import { MenuUI } from "../ui/MenuUI";
import { ResultsUI } from "../ui/ResultsUI";
import { PlayerFrameSnapshot, CarSnapshot, RaceProgressionSnapshot } from "../gameplay/Snapshot";
import { GhostManager } from "../gameplay/GhostManager";
import { GhostCar } from "../rendering/GhostCar";
import { TrackList } from "../data/TrackList";

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
    private menuUI: MenuUI;
    private resultsUI: ResultsUI;
    private boostVisuals: { mesh: any; baseScale: number }[] = [];

    private parsedTrack: ParsedTrack | null = null;
    private currentTrackIndex: number = 0;

    // Ghost recording buffer for current run
    private ghostBuffer: PlayerFrameSnapshot[] = [];
    private isGhostEnabled: boolean = true;

    // Boost pad cooldown: track last raceTime each pad was triggered to prevent double-hits
    private boostPadCooldownMs: number[] = [];

    // Boost pad animation
    private _boostPhase = 0;

    constructor() {
        this.renderer = new Renderer();
        this.physics = new PhysicsEngine(this.renderer.scene);
        this.registry = new BlockRegistry(this.renderer.scene);
        this.parser = new TrackParser(this.registry);

        this.raceManager = new RaceManager();
        this.ghostManager = new GhostManager();
        this.inputManager = new InputManager();
        this.ui = new UIOverlay();
        this.menuUI = new MenuUI();
        this.resultsUI = new ResultsUI();

        this.menuUI.setOnTrackSelected((index) => {
            this.loadTrack(index);
        });

        this.resultsUI.setCallbacks(
            () => { // Restart
                this.resultsUI.hide();
                this.resetRace();
            },
            () => { // Menu
                this.resultsUI.hide();
                this.menuUI.show(TrackList, this.raceManager);
            },
            () => { // Next Track
                this.resultsUI.hide();
                const nextIndex = (this.currentTrackIndex + 1) % TrackList.length;
                this.loadTrack(nextIndex);
            }
        );

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

        // Initialize Cars once
        this.car = new ArcadeCar(this.renderer.scene);
        this.ghostCar = new GhostCar(this.renderer.scene);

        // Show the menu instead of immediately loading a track
        this.menuUI.show(TrackList, this.raceManager);

        this.gameLoop.start();

        // Start Render Loop
        this.renderer.engine.runRenderLoop(() => {
            this.renderer.render();
        });
    }

    private loadTrack(index: number) {
        this.currentTrackIndex = index;
        const trackData = TrackList[index];

        // Clean up previous track if it exists
        if (this.parsedTrack) {
            // Dispose blocks
            this.parsedTrack.blocks.forEach(b => b.dispose());
            // Dispose checkpoints
            this.parsedTrack.checkpoints.forEach(cp => cp.mesh.dispose());
            // Dispose finish
            if (this.parsedTrack.finishVolume) {
                this.parsedTrack.finishVolume.dispose();
            }
            // Dispose boost visuals
            this.boostVisuals.forEach(bv => bv.mesh.dispose());
            this.boostVisuals = [];
        }

        // Safely dispose of all track and wall instances
        const meshesToDispose = this.renderer.scene.meshes.filter(m =>
            m instanceof InstancedMesh && (m.name.startsWith("inst_") || m.name.startsWith("wall_"))
        );

        meshesToDispose.forEach(m => {
            if (m.physicsBody) {
                m.physicsBody.dispose();
            }
            m.dispose();
        });

        this.parsedTrack = this.parser.parse(trackData);
        this.menuUI.hide();
        this.resultsUI.hide();

        // Track boost pad visual meshes for animation
        this.boostVisuals = this.renderer.scene.meshes
            .filter(m => m.name.startsWith("boost_vis_"))
            .map(m => ({ mesh: m, baseScale: 1.0 }));

        // Load best local ghost for this track if it exists
        this.ghostManager.loadGhost(this.parsedTrack.id);

        this.resetRace();
    }

    private resetRace(): void {
        if (!this.parsedTrack) return;

        this.resultsUI.hide();

        this.car.setPosition(this.parsedTrack.startPosition, this.parsedTrack.startRotationDeg);
        this.raceManager.startRace(this.parsedTrack.id, this.parsedTrack.checkpoints.length, this.parsedTrack.medals);

        // Store start position for respawn
        const startPos = [
            this.parsedTrack.startPosition.x,
            this.parsedTrack.startPosition.y,
            this.parsedTrack.startPosition.z
        ];
        this.raceManager.setStartPosition(startPos, this.parsedTrack.startRotationDeg);

        // Prepare Ghost logic
        this.ghostBuffer = []; // Clear recorded ghost frames on restart
        this.ghostManager.resetPlayback();

        // Reset boost pad cooldowns
        this.boostPadCooldownMs = new Array(this.parsedTrack.boostPads.length).fill(-99999);

        if (this.raceManager.bestTime) {
            this.ui.updateBestTime(this.raceManager.formatTime(this.raceManager.bestTime));
        } else {
            this.ui.updateBestTime(null);
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
        if (this.menuUI.isVisible()) return;

        // Poll gamepad before reading input flags so it can override keyboard state
        this.inputManager.pollGamepad();

        if (this.inputManager.isRestartDown && !this.resultsUI.isVisible()) {
            // During race: respawn to last checkpoint. When finished or ready: full reset
            if (this.raceManager.state === RaceState.RACING) {
                this.respawnToCheckpoint();
            } else if (this.raceManager.state === RaceState.FINISHED) {
                this.resetRace();
            } else {
                this.resetRace();
            }
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
        if (this.raceManager.state !== RaceState.FINISHED && !this.resultsUI.isVisible()) {
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

        // Check boost pads
        this.checkBoostPads();

        // Update countdown
        if (this.raceManager.state === RaceState.READY) {
            const countVal = this.raceManager.updateCountdown(dt);
            if (countVal === 3) this.ui.showCountdown("3", "#FFFFFF");
            else if (countVal === 2) this.ui.showCountdown("2", "#FFEE44");
            else if (countVal === 1) this.ui.showCountdown("1", "#FFAA00");
            else if (countVal === 0) {
                this.ui.showCountdown("GO!", "#44FF44");
                setTimeout(() => this.ui.hideCountdown(), 600);
            }
        }

        // Update flip recovery UI
        if (this.car.isFlipped && this.raceManager.state === RaceState.RACING) {
            const pct = Math.min(1, this.car.flipRecoveryTimer / 2.5);
            this.ui.updateFlipRecovery(pct);
        } else if (this.raceManager.state === RaceState.RACING) {
            this.ui.hideFlipRecovery();
        }

        // Record ghost snapshot if racing
        if (this.raceManager.state !== RaceState.FINISHED) {
            this.ghostBuffer.push(this.createSnapshot(this.raceManager.raceTime));
        }
    }

    private checkManualTriggers(): void {
        if (!this.parsedTrack || this.raceManager.state !== RaceState.RACING) return;

        const carPos = this.car.mesh.getAbsolutePosition();

        for (const cp of this.parsedTrack.checkpoints) {
            if (this.isInVolume(carPos, cp.mesh)) {
                if (this.raceManager.hitCheckpoint(cp.id)) {
                    // Store position for respawn
                    const cpWorldPos = cp.mesh.getAbsolutePosition();
                    this.raceManager.addCheckpointPosition(cp.id, [cpWorldPos.x, cpWorldPos.y, cpWorldPos.z], cp.mesh.rotation.y * (180 / Math.PI));
                    this.ui.showMessage(`CHECKPOINT ${cp.id + 1}!`);
                }
            }
        }

        if (this.parsedTrack.finishVolume && this.isInVolume(carPos, this.parsedTrack.finishVolume)) {
             if (this.raceManager.hitFinish()) {
                this.ui.showMessage("FINISH!");
                this.ui.updateBestTime(this.raceManager.formatTime(this.raceManager.bestTime!));

                this.resultsUI.show(this.raceManager);

                // Check if we should save this run as a new ghost
                if (this.raceManager.raceTime === this.raceManager.bestTime) {
                    this.ghostManager.saveGhost(this.parsedTrack.id, this.raceManager.raceTime, this.ghostBuffer);
                }
            }
        }
    }

    /**
     * Respawn the car to the last checkpoint (or start line).
     * TM Nations style: keeps race time, returns to last checkpoint.
     */
    private respawnToCheckpoint(): void {
        const respawn = this.raceManager.getRespawnPosition();
        if (!respawn) return;

        const pos = new Vector3(respawn.position[0], respawn.position[1] + 1, respawn.position[2]);
        this.car.setPosition(pos, respawn.rotationDeg);

        // Reset ghost from this point forward (don't let pre-respawn frames contaminate)
        // Actually in TM Nations the ghost continues normally, so keep recording

        this.ui.showMessage("RESPAWN");
    }

    private isInVolume(pos: Vector3, volume: Mesh): boolean {
    private isInVolume(pos: Vector3, volume: AbstractMesh): boolean {
        // Very rudimentary AABB check for trigger volumes
        const volPos = volume.getAbsolutePosition();
        const dist = Vector3.Distance(pos, volPos);
        return dist < 12; // Adjusted for 14x14 block size radius
    }

    private checkBoostPads(): void {
        if (!this.parsedTrack || this.raceManager.state === RaceState.FINISHED) return;

        const carPos = this.car.mesh.getAbsolutePosition();
        const pads = this.parsedTrack.boostPads;
        const triggerRadius = BlockRegistry.GRID_SIZE * 0.5; // ~7m
        const cooldownTime = 2000; // 2 seconds cooldown per pad

        for (let i = 0; i < pads.length; i++) {
            const pad = pads[i];
            const dist = Vector3.Distance(carPos, pad.position);

            if (dist < triggerRadius && (this.raceManager.raceTime - this.boostPadCooldownMs[i]) > cooldownTime) {
                this.car.applyBoost(pad.forwardVec);
                this.boostPadCooldownMs[i] = this.raceManager.raceTime;
                this.ui.showMessage("BOOST!");
            }
        }
    }

    /**
     * Pulse boost pad emissive color and scale to make them visually obvious.
     */
    private animateBoostPads(): void {
        if (this.boostVisuals.length === 0) return;

        this._boostPhase += 0.016 * 4; // ~4Hz pulse
        const pulse = 0.6 + 0.4 * Math.sin(this._boostPhase);
        const s = 0.9 + 0.1 * Math.sin(this._boostPhase);

        for (const bv of this.boostVisuals) {
            const mat = bv.mesh.material as any;
            if (mat && mat.emissiveColor) {
                mat.emissiveColor.set(0.8 * pulse, 0.4 * pulse, 0.0);
            }
            bv.mesh.scaling.set(s, s, s);
        }
    }

    private renderUpdate(_alpha: number): void {
        if (this.menuUI.isVisible() && !this.parsedTrack) return;

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

        // Pulse boost pad visuals
        this.animateBoostPads();

        // Update UI
        this.ui.updateSpeed(this.car.getSpeedKmh());
        this.ui.updateTimer(this.raceManager.formatTime(this.raceManager.raceTime));

        // Show status message if Ready or Finished
        if (this.raceManager.state === RaceState.READY && !this.menuUI.isVisible()) {
            this.ui.showPersistentMessage("READY\n< PRESS W / UP >");
        } else if (this.raceManager.state === RaceState.FINISHED && !this.resultsUI.isVisible()) {
             this.ui.showPersistentMessage(`FINISHED: ${this.raceManager.formatTime(this.raceManager.raceTime)}\n< PRESS R TO RESTART >`);
        } else {
            this.ui.hidePersistentMessage();
        }

        // Show progress string (CP: 1/3)
        const cpString = `${this.raceManager.currentCheckpointId + 1} / ${this.raceManager.maxCheckpoints}`;
        this.ui.updateCheckpointProgress(cpString);
    }
}
