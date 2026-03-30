import { TrackData } from "../track/TrackSchema";
import { RaceManager, MedalType } from "../gameplay/RaceManager";

export class MenuUI {
    private container: HTMLDivElement;
    private menuContainer: HTMLDivElement;
    private trackListElement: HTMLDivElement;

    private onTrackSelectedCallback: ((trackIndex: number) => void) | null = null;

    constructor() {
        this.container = document.createElement("div");
        this.container.style.position = "absolute";
        this.container.style.top = "0";
        this.container.style.left = "0";
        this.container.style.width = "100%";
        this.container.style.height = "100%";
        this.container.style.backgroundColor = "rgba(0, 0, 0, 0.85)";
        this.container.style.display = "flex";
        this.container.style.justifyContent = "center";
        this.container.style.alignItems = "center";
        this.container.style.fontFamily = "Impact, 'Arial Black', sans-serif";
        this.container.style.zIndex = "100"; // Above everything

        this.menuContainer = document.createElement("div");
        this.menuContainer.style.backgroundColor = "#222";
        this.menuContainer.style.padding = "40px";
        this.menuContainer.style.borderRadius = "10px";
        this.menuContainer.style.border = "4px solid #4DA6FF";
        this.menuContainer.style.textAlign = "center";
        this.menuContainer.style.minWidth = "50vw";
        this.menuContainer.style.maxHeight = "80vh";
        this.menuContainer.style.overflowY = "auto";

        const title = document.createElement("h1");
        title.innerText = "SELECT TRACK";
        title.style.color = "white";
        title.style.marginTop = "0";
        title.style.fontSize = "48px";
        title.style.textShadow = "2px 2px 0 #000";
        this.menuContainer.appendChild(title);

        this.trackListElement = document.createElement("div");
        this.trackListElement.style.display = "flex";
        this.trackListElement.style.flexDirection = "column";
        this.trackListElement.style.gap = "15px";

        this.menuContainer.appendChild(this.trackListElement);
        this.container.appendChild(this.menuContainer);
        document.body.appendChild(this.container);
    }

    public setOnTrackSelected(callback: (trackIndex: number) => void) {
        this.onTrackSelectedCallback = callback;
    }

    public show(tracks: TrackData[], raceManager: RaceManager) {
        this.container.style.display = "flex";
        this.trackListElement.innerHTML = ""; // Clear existing

        tracks.forEach((track, index) => {
            const btn = document.createElement("button");
            btn.style.padding = "20px";
            btn.style.fontSize = "24px";
            btn.style.fontFamily = "inherit";
            btn.style.backgroundColor = "#333";
            btn.style.color = "white";
            btn.style.border = "2px solid #555";
            btn.style.borderRadius = "5px";
            btn.style.cursor = "pointer";
            btn.style.display = "flex";
            btn.style.justifyContent = "space-between";
            btn.style.alignItems = "center";
            btn.style.transition = "background-color 0.2s, border-color 0.2s, transform 0.1s";

            btn.onmouseenter = () => {
                btn.style.backgroundColor = "#444";
                btn.style.borderColor = "#4DA6FF";
            };
            btn.onmouseleave = () => {
                btn.style.backgroundColor = "#333";
                btn.style.borderColor = "#555";
            };
            btn.onmousedown = () => btn.style.transform = "scale(0.98)";
            btn.onmouseup = () => btn.style.transform = "scale(1)";

            btn.onclick = () => {
                if (this.onTrackSelectedCallback) {
                    this.onTrackSelectedCallback(index);
                }
            };

            const nameSpan = document.createElement("span");
            nameSpan.innerText = track.name;

            const infoSpan = document.createElement("span");
            infoSpan.style.fontSize = "18px";
            infoSpan.style.display = "flex";
            infoSpan.style.alignItems = "center";
            infoSpan.style.gap = "10px";

            // Try to load best time for this track
            const bestTimeKey = `trackmania_clone_best_time_${track.id}`;
            const stored = localStorage.getItem(bestTimeKey);

            if (stored) {
                const bestTime = parseFloat(stored);
                let medalType = MedalType.NONE;

                if (track.medals) {
                    if (bestTime <= track.medals.author) medalType = MedalType.AUTHOR;
                    else if (bestTime <= track.medals.gold) medalType = MedalType.GOLD;
                    else if (bestTime <= track.medals.silver) medalType = MedalType.SILVER;
                    else if (bestTime <= track.medals.bronze) medalType = MedalType.BRONZE;
                }

                const timeStr = raceManager.formatTime(bestTime);
                infoSpan.innerText = `BEST: ${timeStr}`;

                if (medalType !== MedalType.NONE) {
                    const medalIndicator = document.createElement("div");
                    medalIndicator.style.width = "20px";
                    medalIndicator.style.height = "20px";
                    medalIndicator.style.borderRadius = "50%";
                    medalIndicator.style.backgroundColor = RaceManager.getMedalColor(medalType);
                    medalIndicator.title = RaceManager.getMedalName(medalType);
                    medalIndicator.style.border = "2px solid #000";
                    infoSpan.appendChild(medalIndicator);
                }
            } else {
                infoSpan.innerText = "UNPLAYED";
                infoSpan.style.color = "#888";
            }

            btn.appendChild(nameSpan);
            btn.appendChild(infoSpan);
            this.trackListElement.appendChild(btn);
        });
    }

    public hide() {
        this.container.style.display = "none";
    }

    public isVisible(): boolean {
        return this.container.style.display !== "none";
    }
}
