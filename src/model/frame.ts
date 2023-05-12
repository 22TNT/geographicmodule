import { Node} from "./node";

export type Frame = {
    id: string,
    windSpeed: number,
    windDirection: number,
    timeOfDay: number,
    tick: number,
    map: Node[][],
}
