import { State} from "./state";

export type Node = {
    lat: number,
    lng: number,
    contaminations: State[],
}
