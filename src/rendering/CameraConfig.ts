export interface CameraConfig {
    /** Target distance behind the car */
    radius: number;
    /** Target height above the car */
    heightOffset: number;
    /** How quickly the camera catches up to the car's rotation (0 = static, 1 = instant) */
    cameraAcceleration: number;
    /** Maximum speed the camera can move to catch up */
    maxCameraSpeed: number;

    /** Base Field of View (in radians) */
    baseFov: number;
    /** Maximum Field of View at top speed (in radians) */
    maxFov: number;
    /** Speed (km/h) at which maxFov is reached */
    fovSpeedThreshold: number;
}

export const DEFAULT_CAMERA_CONFIG: CameraConfig = {
    radius: 6.5,          // Closer to the car
    heightOffset: 2.2,    // Lower to the track, looking forward
    cameraAcceleration: 0.1, // Smooth but responsive
    maxCameraSpeed: 30,

    baseFov: 1.0,         // ~57 degrees
    maxFov: 1.3,          // ~74 degrees for speed effect
    fovSpeedThreshold: 150
};