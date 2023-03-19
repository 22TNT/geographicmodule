import { Grid} from "./grid";

export type Frame = {
    id: string,
    windSpeed: number,
    windDirection: number,
    windFunction: () => void,
    timeOfDay: number,
    tick: number,
    grid: Grid,
}
