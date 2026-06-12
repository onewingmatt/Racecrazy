export interface TrackBlock {
    type: string;
    x: number;
    y: number;
    z: number;
    rot: number; // In degrees
}

export interface MedalTimes {
    author: number; // The "developer" time
    gold: number;
    silver: number;
    bronze: number;
}

export interface TrackMetadata {
    archetype?: string;
    intendedLesson?: string;
    difficultyTier?: string;
}

export interface TrackData {
    id: string; // Unique identifier for saves
    name: string;
    medals?: MedalTimes;
    metadata?: TrackMetadata;
    blocks: TrackBlock[];
}
