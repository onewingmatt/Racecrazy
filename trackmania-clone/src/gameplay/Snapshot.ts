/**
 * Serializable data structures designed specifically for local ghost recording,
 * remote multiplayer syncing, and replay.
 *
 * These types intentionally avoid importing any Babylon.js or Havok classes
 * (like Vector3 or Quaternion) to ensure they can be easily stringified to JSON,
 * sent over a network, or saved to a backend without massive dependency overhead.
 */

export interface Vector3Data {
    x: number;
    y: number;
    z: number;
}

export interface QuaternionData {
    x: number;
    y: number;
    z: number;
    w: number;
}

/**
 * A discrete snapshot of the vehicle's physical state.
 * Useful for interpolating ghosts or correcting multiplayer clients.
 */
export interface CarSnapshot {
    position: Vector3Data;
    rotation: QuaternionData;
    linearVelocity: Vector3Data;
    angularVelocity: Vector3Data;
}

/**
 * The high-level state of a player's race progression.
 * Useful for validating lap times or displaying leaderboards mid-race.
 */
export interface RaceProgressionSnapshot {
    state: "READY" | "RACING" | "FINISHED";
    currentCheckpointId: number;
    totalCheckpoints: number;
    raceTimeMs: number;
}

/**
 * A complete frame snapshot combining time, progression, and physics state.
 * This is the object that would be pushed to an array for a local Ghost replay
 * or sent at a fixed tick rate over WebRTC/WebSockets.
 */
export interface PlayerFrameSnapshot {
    /**
     * The timestamp of the snapshot.
     * For ghosts, this should be relative to race start (e.g. 1500ms).
     * For live multiplayer, this might be a server tick or epoch time.
     */
    timestampMs: number;

    car: CarSnapshot;
    progression: RaceProgressionSnapshot;
}
