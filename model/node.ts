import { State} from "./state";

export type Node = {
    id: string,
    lat: number,
    lng: number,
    length: number,
    contaminations: State[],
}
