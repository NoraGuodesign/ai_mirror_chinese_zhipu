
export interface Achievement {
  id: string;
  text: string;
  date: string;
}

export enum MirrorStatus {
  STANDBY = 'STANDBY',
  ACTIVE = 'ACTIVE',
  PROCESSING = 'PROCESSING'
}

export type GestureType = 'heart' | 'victory' | 'thumbs_up' | null;

export interface PerceptionData {
  presence: boolean;
  eyeFocus: boolean;
  gesture: GestureType;
}
