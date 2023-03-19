import { Grid} from "./grid";

export type Frame = {
    id: string,
    windSpeed: number,
    windDirection: number,
    windFunction: () => [number, number],
    timeOfDay: number,
    tick: number,
    grid: Grid,
}
