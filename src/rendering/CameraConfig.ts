export interface CameraConfig {
    name: string;
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

export const CAMERA_MODES: CameraConfig[] = [
    {
        name: "CHASE",
        radius: 6.5,
        heightOffset: 2.2,
        cameraAcceleration: 0.1,
        maxCameraSpeed: 30,
        baseFov: 1.0,
        maxFov: 1.3,
        fovSpeedThreshold: 150,
    },
    {
        name: "FAR",
        radius: 12.0,
        heightOffset: 5.0,
        cameraAcceleration: 0.06,
        maxCameraSpeed: 20,
        baseFov: 1.1,
        maxFov: 1.4,
        fovSpeedThreshold: 200,
    },
    {
        name: "COCKPIT",
        radius: 1.5,
        heightOffset: 1.4,
        cameraAcceleration: 0.18,
        maxCameraSpeed: 40,
        baseFov: 0.75,
        maxFov: 1.0,
        fovSpeedThreshold: 180,
    },
];
