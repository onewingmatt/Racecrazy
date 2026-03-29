import starterTrack from "./tracks/01_starter.json";
import technicalTrack from "./tracks/02_technical.json";
import speedTrack from "./tracks/03_speed.json";
import { TrackData } from "../track/TrackSchema";

export const TrackList: TrackData[] = [
    starterTrack as TrackData,
    technicalTrack as TrackData,
    speedTrack as TrackData
];
