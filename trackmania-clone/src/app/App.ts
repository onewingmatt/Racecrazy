import { Vector3 } from "@babylonjs/core";
import { Renderer } from "../rendering/Renderer";
import { PhysicsEngine } from "../physics/PhysicsEngine";
import { BlockRegistry } from "../track/BlockRegistry";
import { TrackParser } from "../track/TrackParser";
import { ArcadeCar } from "../gameplay/ArcadeCar";
import { RaceManager } from "../gameplay/RaceManager";
import { InputManager } from "../core/InputManager";
import { GameLoop } from "../core/GameLoop";
import { UIOverlay } from "../ui/UIOverlay";

// Sample Track Data
import trackData from "../data/track.json";

export class App {
    private renderer: Renderer;
    private physics: PhysicsEngine;
    private registry: BlockRegistry;
    private parser: TrackParser;
    private car!: ArcadeCar;
    private raceManager: RaceManager;
    private inputManager: InputManager;
    private gameLoop: GameLoop;
    private ui: UIOverlay;

    private parsedTrack: any;

    constructor() {
        this.renderer = new Renderer();
        this.physics = new PhysicsEngine(this.renderer.scene);
        this.registry = new BlockRegistry(this.renderer.scene);
        this.parser = new TrackParser(this.registry);

        this.raceManager = new RaceManager();
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

        // Initialize Car
        this.car = new ArcadeCar(this.renderer.scene);

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
                if (collidedMesh === this.car.mesh && this.raceManager.isRacing) {
                    if (this.raceManager.hitCheckpoint(cp.id)) {
                        this.ui.showMessage("CHECKPOINT!");
                    }
                }
            };
        });

        if (this.parsedTrack.finishVolume) {
            this.parsedTrack.finishVolume.onCollide = (collidedMesh: any) => {
                if (collidedMesh === this.car.mesh && this.raceManager.isRacing) {
                    if (this.raceManager.hitFinish()) {
                        this.ui.showMessage("FINISH!");
                        this.ui.updateBestTime(this.raceManager.formatTime(this.raceManager.bestTime!));
                    }
                }
            };
        }
    }

    private resetRace(): void {
        this.car.setPosition(this.parsedTrack.startPosition, this.parsedTrack.startRotationDeg);
        this.raceManager.startRace(this.parsedTrack.checkpoints.length + (this.parsedTrack.finishVolume ? 1 : 0));

        if (this.raceManager.bestTime) {
            this.ui.updateBestTime(this.raceManager.formatTime(this.raceManager.bestTime));
        }
    }

    private fixedUpdate(dt: number): void {
        if (this.inputManager.isRestartDown) {
            this.resetRace();
        }

        this.car.update(
            dt,
            this.inputManager.isForwardDown,
            this.inputManager.isBackDown,
            this.inputManager.isLeftDown,
            this.inputManager.isRightDown
        );

        this.physics.step(dt);
        this.raceManager.update();
        this.inputManager.resetPerFrameInputs();

        // Simple manual trigger check (since Babylon Havok trigger events can be tricky)
        this.checkManualTriggers();
    }

    // Fallback manual trigger collision check using simple bounding box intersections.
    private checkManualTriggers(): void {
        if (!this.raceManager.isRacing) return;

        const carPos = this.car.mesh.getAbsolutePosition();

        for (const cp of this.parsedTrack.checkpoints) {
            if (this.isInVolume(carPos, cp.mesh)) {
                if (this.raceManager.hitCheckpoint(cp.id)) {
                    this.ui.showMessage("CHECKPOINT!");
                }
            }
        }

        if (this.parsedTrack.finishVolume && this.isInVolume(carPos, this.parsedTrack.finishVolume)) {
             if (this.raceManager.hitFinish()) {
                this.ui.showMessage("FINISH!");
                this.ui.updateBestTime(this.raceManager.formatTime(this.raceManager.bestTime!));
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
        // Camera Follow (simple smoothing)
        this.renderer.camera.lockedTarget = this.car.mesh;

        // Update UI
        this.ui.updateSpeed(this.car.getSpeedKmh());
        this.ui.updateTimer(this.raceManager.formatTime(this.raceManager.raceTime));
    }
}