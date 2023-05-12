import { Material } from './material';

export type ContaminationSource = {
    material: Material,
    height: number,
    lat: number,
    lng: number,
    dispersionHorizontal: number,
    dispersionVertical: number,
    power: number,
}
