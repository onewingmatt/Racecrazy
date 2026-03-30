export interface TrackBlock {
    type: string;
    x: number;
    y: number;
    z: number;
    rot: number; // In degrees
}

export interface BlockMetadata {
    category: "flat" | "curve" | "banked" | "ramp" | "stunt";
    elevationChange: number; // in HEIGHT_STEP units
    bankAngle: number; // in degrees
    wallBehavior: "flat" | "curved" | "sloped" | "none";
    collisionHint: "box" | "convex_hull" | "mesh";
    supportsInvert?: boolean; // Groundwork for loops
}

export interface MedalTimes {
    author: number; // The "developer" time
    gold: number;
    silver: number;
    bronze: number;
}

export interface TrackData {
    id: string; // Unique identifier for saves
    name: string;
    medals?: MedalTimes;
    blocks: TrackBlock[];
}
