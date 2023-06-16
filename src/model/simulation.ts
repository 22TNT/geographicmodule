import { Frame} from "./frame";
import { Node} from "./node";
import {State} from "./state";
import {Material} from "./material";
import {ContaminationSource} from "./contaminationsource";
import {nanoid} from "nanoid";
import {Wind} from "./wind";
import {cloneDeep} from "lodash";

export class Simulation {
    frames: Frame[] = [];
    sources: ContaminationSource[] = [];
    winds = new Map<number, Wind>().set(0, {direction: 0, speed: 0});
    startLat: number;
    startLng: number;
    endLat: number;
    endLng: number;
    length: number;
    grid_length: number;
    grid_width: number;
    id: string;

    public keyFinder(val: number) {
        let maxKey = -1;
        let keys: number[] = [...this.winds.keys()].sort((a, b) => (a-b));
        keys.forEach(key => {
            if (maxKey < 0 || val >= key) {
                maxKey = Math.max(maxKey, key);
            }
        });
        return maxKey;
    }

    public haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
        function toRad(x: number): number {
            return x * Math.PI / 180;
        }

        const R = 6378137; // m
        const latD = toRad(lat2 - lat1);
        const lngD = toRad(lng2 - lng1);
        const a = Math.sin(latD / 2) * Math.sin(latD / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(lngD / 2) * Math.sin(lngD / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c; // meters
    }

    public getOffsetCoords(lat: number, lng: number, easternOffset: number, southernOffset: number): [number, number] {
        const R = 6378.137; // km
        const m = (1 / ((Math.PI/180) * R)) / 1000; // 1 meter in degrees
        const new_lat = lat + (southernOffset * m);
        const new_lng = lng + (m * easternOffset) / Math.cos(lat * (Math.PI / 180));

        return ([new_lat, new_lng]);
    }

    private setupMap(
        startLat: number,
        startLng: number,
        gridLength: number,
        gridWidth: number,
        length: number,
    ): Node[][] {
        let map : Node[][] = [];
        for (let i = 0; i<gridLength; i++) {
            map[i] = [];
        }
        let currentLat = startLat;
        let currentLng = startLng;
        for (let i=0; i<=gridLength; i++) {
            for (let j=0; j<gridWidth; j++) {
                map[i][j] = {
                    lat: currentLat,
                    lng: currentLng,
                    contaminations: [],
                };
                currentLng = this.getOffsetCoords(currentLat, currentLng, length, 0)[1];
            }
            currentLng = startLng;
            currentLat = this.getOffsetCoords(currentLat, currentLng, 0, length)[0];
        }
        return map;
    }

    constructor(startLat: number, startLng: number, endLat:number, endLng: number, length: number, ) {
        this.id = nanoid();
        this.startLat = startLat;
        this.startLng = startLng;
        this.endLat = endLat;
        this.endLng = endLng;
        this.length = length;
        this.grid_length = this.haversineDistance(startLat, startLng, endLat, startLng) / length;
        this.grid_width = this.haversineDistance(startLat, startLng, startLat, endLng) / length;
        this.frames.push({
            id: nanoid(),
            tick: 0,
            timeOfDay: 0,
            windSpeed: 0,
            windDirection: 0,
            map: this.setupMap(startLat, startLng, this.grid_length, this.grid_width, length),
            }
        );
    };

    public nextFrame(): void {
        let frame: Frame = cloneDeep(this.frames.slice(-1)[0]);
        frame.tick+=1;
        frame.id=nanoid();
        const wind: Wind = this.winds.get(this.keyFinder(frame.tick));
        frame.windDirection = wind.direction % 360;
        frame.windSpeed = wind.speed;
        frame.timeOfDay = (frame.timeOfDay+1)%1440; // 1440 = minutes in a day

        // do contamination propagation stuff

        let direction;
        let dir_code = "";
        if (0 <= frame.windDirection && frame.windDirection < 90) {
            direction = frame.windDirection;
            dir_code = "NE";
        }
        else if (90 <= frame.windDirection && frame.windDirection < 180) {
            direction = 180 - frame.windDirection;
            dir_code = "SE";
        }
        else if (180 <= frame.windDirection && frame.windDirection < 270) {
            direction = 180 + frame.windDirection;
            dir_code = "SW";
        }
        else if (270 <= frame.windDirection && frame.windDirection < 360) {
            direction = 360 - frame.windDirection;
            dir_code = "NW";
        }
        /*
        else {
            throw "Unreachable";
        }
        */
        if (frame.windDirection === 0) {
            dir_code = "N";
        }
        else if (frame.windDirection === 90) {
            dir_code = "E";
        }
        else if (frame.windDirection === 180) {
            dir_code = "S";
        }
        else if (frame.windDirection === 270) {
            dir_code = "W";
        }

        const newton = (
            frame: Frame,
            i: number,
            j: number,
            source: ContaminationSource,
            windTick: number,
            velocity_x: number,
            velocity_y: number
        ) => {
            const c = (
                (
                    (source.power)
                    / (Math.pow(2*Math.PI, 3/2)
                        * source.dispersionVertical
                        * source.dispersionHorizontal
                        * source.dispersionHorizontal)
                )
                * Math.exp(
                    - (
                        Math.pow(
                            this.haversineDistance(frame.map[i][j].lat, source.lng, source.lat, source.lng)
                            - velocity_x*windTick*60,
                            2)
                        / 2*source.dispersionHorizontal*source.dispersionHorizontal
                    )
                )
                * Math.exp(
                    - (
                        Math.pow(
                            this.haversineDistance(source.lat, frame.map[i][j].lng, source.lat, source.lng)
                            - velocity_y*windTick*60,
                            2)
                        / 2*source.dispersionHorizontal*source.dispersionHorizontal
                    )
                )
                * (
                    Math.exp(
                        - (
                            Math.pow(
                                MAP_HEIGHT - source.height,
                                2
                            )
                            / 2*source.dispersionVertical*source.dispersionVertical
                        )
                    )
                    + Math.exp(
                        - (
                            Math.pow(
                                MAP_HEIGHT + source.height,
                                2
                            )
                            / 2*source.dispersionVertical*source.dispersionVertical
                        )
                    )
                )
            )
            if (c > 0) {
                frame.map[i][j].contaminations.push({
                    material: source.material,
                    levelOfContamination: c,
                })
            }
        }

        const getIJOfSource = (frame: Frame, source: ContaminationSource): [number, number] => {
            let source_i = frame.map.length-1;
            let source_j = frame.map[0].length-1;
            for (let i=0; i<frame.map.length-1; i++) {
                if (frame.map[i][0].lat <= source.lat && source.lat < frame.map[i+1][0].lat) {
                    source_i = i;
                    break;
                }
            }
            for (let j=0; j<frame.map[source_i].length-1; j++) {
                if (frame.map[source_i][j].lng <= source.lng && source.lng < frame.map[source_i][j+1].lng) {
                    source_j = j;
                    break;
                }
            }

            return [source_i, source_j];
        }

        const velocity_y = Math.sin(direction * (Math.PI/180)) * wind.speed;
        const velocity_x = Math.cos(direction * (Math.PI/180)) * wind.speed;
        const MAP_HEIGHT = 0;
        const windTick = frame.tick - Math.max(this.keyFinder(frame.tick), 1) + 1;
        this.sources.forEach((source:ContaminationSource) => {
            let i_min, i_max, j_min, j_max;
            const src_i = getIJOfSource(frame, source)[0];
            const src_j = getIJOfSource(frame, source)[1];

            if (dir_code === "N") {
                i_min = src_i;
                i_max = frame.map.length-1;
                j_min = 0;
                j_max = frame.map[0].length-1;
            }
            else if (dir_code === "S") {
                i_min = 0;
                i_max = src_i;
                j_min = 0;
                j_max = frame.map[0].length-1;
            }
            else if (dir_code === "E") {
                i_min = 0;
                i_max = frame.map.length-1;
                j_min = src_j;
                j_max = frame.map[0].length-1;
            }
            else if (dir_code === "W") {
                i_min = 0;
                i_max = frame.map.length-1;
                j_min = 0;
                j_max = src_j;
            }
            else if (dir_code === "NE") {
                i_min = src_i;
                i_max = frame.map.length-1;
                j_min = src_j;
                j_max = frame.map[0].length-1;
            }
            else if (dir_code === "SE") {
                i_min = 0;
                i_max = src_i;
                j_min = src_j;
                j_max = frame.map[0].length-1;
            }
            else if (dir_code === "SW") {
                i_min = 0;
                i_max = src_i;
                j_min = 0;
                j_max = src_j;
            }
            else if (dir_code === "NW") {
                i_min = src_i;
                i_max = frame.map.length-1;
                j_min = 0;
                j_max = src_j;
            }
            for (let i=i_min; i<i_max; i++) {
                for (let j=j_min; j<j_max; j++) {
                    newton(frame, i, j, source, windTick, velocity_x, velocity_y);
                }
            }

        });
        this.frames.push(frame);
    }

    public addSource(lat: number,
                     lng: number,
                     height: number,
                     material: Material,
                     power: number,
                     dispH: number,
                     dispV: number,
                     ): void {
        this.sources.push({
            lat: lat,
            lng: lng,
            height: height,
            material: material,
            power: power,
            dispersionHorizontal: dispH,
            dispersionVertical: dispV,
        });
    }

    public addWind(tick: number, wind:Wind): void {
        this.winds.set(tick, wind);
    }

    public addContamination(lat: number, lng: number, state: State): void {
        let frame: Frame = {...this.frames.slice(-1)[0]};
        for (let i=0; i<frame.map.length; i++) {
            const node = frame.map[i][0];
            if (node.lat <= lat && lat < this.getOffsetCoords(node.lat, node.lng, this.length, this.length)[0]){
                for (let j=0; j<frame.map[i].length; j++) {
                    const node = frame.map[i][j];
                    if (node.lng <= lng && lng < this.getOffsetCoords(node.lat, node.lng, this.length, this.length)[1])
                    {
                        this.frames[this.frames.length-1].map[i][j].contaminations.push(state);
                        return;
                    }
                }
            }
        }
        throw Error("incorrect coordinates");
    };
}
