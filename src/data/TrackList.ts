import track01 from "./tracks/01_starter.json";
import track02 from "./tracks/02_technical.json";
import track03 from "./tracks/03_speed.json";
import track04 from "./tracks/04_curvy.json";
import track05 from "./tracks/05_jump.json";
import track06 from "./tracks/06_maze.json";
import track07 from "./tracks/07_mixed.json";
import track08 from "./tracks/08_long_jump.json";
import track09 from "./tracks/09_spiral.json";
import track10 from "./tracks/10_finale.json";
import { TrackData } from "../track/TrackSchema";

export const TrackList: TrackData[] = [
    track01 as TrackData,
    track02 as TrackData,
    track03 as TrackData,
    track04 as TrackData,
    track05 as TrackData,
    track06 as TrackData,
    track07 as TrackData,
    track08 as TrackData,
    track09 as TrackData,
    track10 as TrackData
];
