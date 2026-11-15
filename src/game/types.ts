export type CarCategory = 'supercar' | 'coupe' | 'sedan' | 'hypercar' | 'racecar';

export type GameMode = 'circuit' | 'timetrial' | 'freedrive';

export type CameraMode = 'third_person' | 'cockpit' | 'bumper';

export type TimeOfDayMode = 'dynamic' | 'day' | 'afternoon';

export type ScreenState =
  | 'intro'
  | 'menu'
  | 'garage'
  | 'settings'
  | 'playing'
  | 'paused'
  | 'results'
  | 'quit';

export interface PaintColor {
  id: string;
  name: string;
  hex: string;
  accentHex: string;
}

export interface CarSpec {
  id: string;
  name: string;
  category: CarCategory;
  categoryLabel: string;
  description: string;
  // Display stats (0-100)
  stats: {
    topSpeed: number;
    acceleration: number;
    handling: number;
    braking: number;
  };
  // Physics tuning
  physics: {
    maxSpeedKmh: number;
    engineForce: number;
    brakeForce: number;
    turnRate: number;
    lateralGrip: number;
    driftGrip: number;
    downforce: number;
    mass: number;
    nitroBoost: number;
    suspensionStiffness: number;
  };
  dimensions: {
    width: number;
    height: number;
    length: number;
    wheelRadius: number;
    wheelWidth: number;
    wheelbase: number;
    trackWidth: number;
    cockpitOffset: [number, number, number];
    bumperOffset: [number, number, number];
  };
}

export interface GameSettings {
  timeOfDay: TimeOfDayMode;
  laps: number;
  volume: number;
  muted: boolean;
  touchControls: 'auto' | 'on' | 'off';
  highQuality: boolean;
}

export interface RaceStanding {
  id: string;
  name: string;
  carName: string;
  isPlayer: boolean;
  position: number;
  lap: number;
  totalProgress: number;
  finished: boolean;
  finishTimeMs: number;
  bestLapMs: number;
}

export interface TelemetryData {
  speedKmh: number;
  rpm: number;
  maxRpm: number;
  gear: number; // -1 reverse, 0 neutral, 1..6 forward
  nitro: number; // 0..100
  isNitroActive: boolean;
  isDrifting: boolean;
  isBraking: boolean;
  lap: number;
  totalLaps: number;
  position: number;
  totalRacers: number;
  raceTimeMs: number;
  currentLapMs: number;
  bestLapMs: number;
  countdown: number; // 3, 2, 1, 0 (GO), -1 (racing)
  checkpointIndex: number;
  totalCheckpoints: number;
  cameraMode: CameraMode;
  timeOfDayLabel: string;
  wrongWay: boolean;
  standings: RaceStanding[];
  minimapRacers: Array<{
    x: number;
    z: number;
    isPlayer: boolean;
    color: string;
  }>;
  trackOutline: Array<{ x: number; z: number }>;
  raceFinished: boolean;
  isVictory: boolean;
}

export interface ControlInputs {
  throttle: boolean;
  brake: boolean;
  left: boolean;
  right: boolean;
  handbrake: boolean;
  nitro: boolean;
}
