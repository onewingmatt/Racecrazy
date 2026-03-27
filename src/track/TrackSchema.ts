export interface TrackBlock {
    type: string;
    x: number;
    y: number;
    z: number;
    rot: number; // In degrees
}

export interface TrackData {
    name: string;
    blocks: TrackBlock[];
}
