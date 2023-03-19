import { Node} from "./node";

export type Grid = {
    id: string,
    startLat: number,
    startLng: number,
    map: Node[][],
}
