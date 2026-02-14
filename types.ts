
export type ComponentType = 'SEC' | 'RSO' | 'CG';

export interface MechanicalComponent {
  id: string;
  type: ComponentType;
  x?: number; // percentage from left
  y?: number; // percentage from top
}

export interface GroupData {
  id: string;
  name: string;
  components: MechanicalComponent[];
  xRange?: [number, number]; // [start%, end%]
}

export interface TransmissionParams {
  rodete: number;
  engrenagemSecador: number;
  soprador: number;
  cilindroGuia: number;
}

export interface GroupInput {
  id: string;
  inputRPM: number;
}
