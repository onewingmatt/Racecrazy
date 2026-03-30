import { RaceManager, MedalType } from "../gameplay/RaceManager";

export class ResultsUI {
    private container: HTMLDivElement;
    private titleElement: HTMLHeadingElement;
    private timeElement: HTMLDivElement;
    private bestTimeElement: HTMLDivElement;
    private medalElement: HTMLDivElement;

    private onRestartCallback: (() => void) | null = null;
    private onNextTrackCallback: (() => void) | null = null;
    private onMenuCallback: (() => void) | null = null;

    constructor() {
        this.container = document.createElement("div");
        this.container.style.position = "absolute";
        this.container.style.top = "50%";
        this.container.style.left = "50%";
        this.container.style.transform = "translate(-50%, -50%)";
        this.container.style.backgroundColor = "rgba(0, 0, 0, 0.9)";
        this.container.style.border = "4px solid #FFCC00";
        this.container.style.borderRadius = "10px";
        this.container.style.padding = "40px";
        this.container.style.display = "none";
        this.container.style.flexDirection = "column";
        this.container.style.alignItems = "center";
        this.container.style.fontFamily = "Impact, 'Arial Black', sans-serif";
        this.container.style.color = "white";
        this.container.style.zIndex = "50";
        this.container.style.boxShadow = "0px 10px 30px rgba(0,0,0,0.8)";

        this.titleElement = document.createElement("h1");
        this.titleElement.innerText = "FINISH!";
        this.titleElement.style.margin = "0 0 20px 0";
        this.titleElement.style.fontSize = "64px";
        this.titleElement.style.color = "#FFD700";
        this.container.appendChild(this.titleElement);

        this.timeElement = document.createElement("div");
        this.timeElement.style.fontSize = "48px";
        this.container.appendChild(this.timeElement);

        this.bestTimeElement = document.createElement("div");
        this.bestTimeElement.style.fontSize = "24px";
        this.bestTimeElement.style.color = "#AAAAAA";
        this.bestTimeElement.style.margin = "10px 0 20px 0";
        this.container.appendChild(this.bestTimeElement);

        this.medalElement = document.createElement("div");
        this.medalElement.style.fontSize = "32px";
        this.medalElement.style.margin = "10px 0 30px 0";
        this.medalElement.style.padding = "10px 20px";
        this.medalElement.style.borderRadius = "5px";
        this.medalElement.style.border = "2px solid #000";
        this.medalElement.style.fontWeight = "bold";
        this.container.appendChild(this.medalElement);

        const buttonContainer = document.createElement("div");
        buttonContainer.style.display = "flex";
        buttonContainer.style.gap = "20px";

        const createBtn = (text: string, onClick: () => void, color: string) => {
            const btn = document.createElement("button");
            btn.innerText = text;
            btn.style.padding = "15px 30px";
            btn.style.fontSize = "24px";
            btn.style.fontFamily = "inherit";
            btn.style.backgroundColor = color;
            btn.style.color = "white";
            btn.style.border = "none";
            btn.style.borderRadius = "5px";
            btn.style.cursor = "pointer";
            btn.style.transition = "transform 0.1s";

            btn.onmousedown = () => btn.style.transform = "scale(0.95)";
            btn.onmouseup = () => btn.style.transform = "scale(1)";
            btn.onmouseleave = () => btn.style.transform = "scale(1)";
            btn.onclick = onClick;

            return btn;
        };

        buttonContainer.appendChild(createBtn("RESTART", () => this.onRestartCallback?.(), "#FF3333"));
        buttonContainer.appendChild(createBtn("MENU", () => this.onMenuCallback?.(), "#555555"));
        buttonContainer.appendChild(createBtn("NEXT TRACK", () => this.onNextTrackCallback?.(), "#4DA6FF"));

        this.container.appendChild(buttonContainer);
        document.body.appendChild(this.container);
    }

    public setCallbacks(onRestart: () => void, onMenu: () => void, onNextTrack: () => void) {
        this.onRestartCallback = onRestart;
        this.onMenuCallback = onMenu;
        this.onNextTrackCallback = onNextTrack;
    }

    public show(raceManager: RaceManager) {
        const timeStr = raceManager.formatTime(raceManager.raceTime);
        this.timeElement.innerText = `TIME: ${timeStr}`;

        if (raceManager.bestTime) {
            this.bestTimeElement.innerText = `BEST: ${raceManager.formatTime(raceManager.bestTime)}`;
        } else {
            this.bestTimeElement.innerText = "BEST: --:--.---";
        }

        const earnedMedal = raceManager.getEarnedMedal(raceManager.raceTime);
        if (earnedMedal !== MedalType.NONE) {
            this.medalElement.innerText = `${RaceManager.getMedalName(earnedMedal)} MEDAL`;
            this.medalElement.style.backgroundColor = RaceManager.getMedalColor(earnedMedal);
            this.medalElement.style.display = "block";
            this.medalElement.style.color = "#000";
        } else {
            this.medalElement.style.display = "none";
        }

        this.container.style.display = "flex";
    }

    public hide() {
        this.container.style.display = "none";
    }

    public isVisible(): boolean {
        return this.container.style.display !== "none";
    }
}
